import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  KeyRound,
  FolderArchive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../services/db';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const { user } = useAuth();
  const isAdmin = Boolean(user && !user.isAnonymous && user.uid !== 'guest' && isUserAdmin(user));

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [bucketName, setBucketName] = useState('exam-media');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.supabaseUrl || '');
      setSupabaseAnonKey(cfg.supabaseAnonKey || '');
      setBucketName(cfg.bucketName || 'exam-media');
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict Admin Gate: Non-admin users cannot access cloud config
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#0c182b] border border-red-500/30 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
            Restricted Configuration
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
            Cloud storage configuration is strictly restricted to administrator accounts.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveSuccess(false);

    // Temporarily save to test with latest values
    saveSupabaseConfig({
      supabaseUrl,
      supabaseAnonKey,
      bucketName,
    });

    try {
      const res = await testSupabaseConnection();
      setTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Connection error: ${msg}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    saveSupabaseConfig({
      supabaseUrl,
      supabaseAnonKey,
      bucketName,
    });
    setSaveSuccess(true);
    setTestResult({
      success: true,
      message: 'Supabase configuration saved successfully!',
    });
    onConfigSaved?.();
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleReset = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setBucketName('exam-media');
    setTestResult({
      success: false,
      message: 'Configuration cleared. App is running in Local Storage mode.',
    });
    onConfigSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-white/10 bg-zinc-50/70 dark:bg-[#070e1a]/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Supabase Media &amp; Cloud Storage
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  No Card Required
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                100% Free Tier (1 GB storage) for official exam diagrams &amp; media
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick Guide Accordion */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>How to get free Supabase credentials without a credit card (2 min)</span>
              </div>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-1 text-xs text-zinc-600 dark:text-zinc-300 space-y-2 border-t border-emerald-500/15">
                <p className="leading-relaxed">
                  Supabase gives you <strong>1 GB storage</strong>, <strong>2 GB bandwidth</strong>, and <strong>50,000 active users</strong> on its Free Tier with <strong>NO credit card required</strong>:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <li>
                    Visit{' '}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      supabase.com <ExternalLink className="w-2.5 h-2.5" />
                    </a>{' '}
                    and sign up with GitHub or Google/email (zero billing details needed).
                  </li>
                  <li>Click <strong>New Project</strong> (e.g. name it <code className="bg-zinc-100 dark:bg-black/30 px-1 py-0.5 rounded">sinahard-exams</code>).</li>
                  <li>In your Supabase project, go to <strong>Storage</strong> in the left sidebar and click <strong>New Bucket</strong>.</li>
                  <li>Name it <code className="bg-zinc-100 dark:bg-black/30 px-1 py-0.5 rounded">exam-media</code> and toggle <strong>Public bucket</strong> to <strong>ON</strong>.</li>
                  <li>Go to <strong>Project Settings &gt; API</strong>, copy your <strong>Project URL</strong> and <strong>anon public key</strong>, and paste them below!</li>
                </ol>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Project URL</span>
                <span className="text-[10px] text-zinc-400 font-normal">e.g. https://xyzcompany.supabase.co</span>
              </label>
              <div className="relative">
                <Database className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Anon Public API Key</span>
                <span className="text-[10px] text-zinc-400 font-normal">Safe for frontend with RLS</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Storage Bucket Name</span>
                <span className="text-[10px] text-zinc-400 font-normal">Default: exam-media</span>
              </label>
              <div className="relative">
                <FolderArchive className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="exam-media"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>
          </div>

          {/* Test Status Feedback Box */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              )}
              <div className="leading-relaxed flex-1">{testResult.message}</div>
            </div>
          )}

          {/* Offline / Local Mode Note */}
          <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-[#070e1a]/60 border border-zinc-200/80 dark:border-white/10 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              If unconfigured or offline, Sinahard automatically stores diagrams using compressed local Base64 data URLs.
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/50 dark:bg-[#070e1a]/50 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-500 transition cursor-pointer"
          >
            Clear Config
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTesting || !supabaseUrl || !supabaseAnonKey}
              onClick={handleTestConnection}
              className="px-4 py-2 rounded-full border border-zinc-200 dark:border-white/15 bg-white dark:bg-[#0c182b] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#132238] transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs hover:shadow-emerald-500/20 active:scale-98 transition cursor-pointer flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
