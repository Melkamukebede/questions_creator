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
  Copy,
  Check,
  CloudCheck,
  Code2,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  saveSupabaseConfigToCloud,
  clearSupabaseConfigFromCloud,
  testSupabaseConnection,
  getSupabaseSetupSql,
  initSupabaseFromCloud,
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
  const [isCloudLinked, setIsCloudLinked] = useState(false);
  const [linkedAt, setLinkedAt] = useState<string | undefined>(undefined);
  const [linkedBy, setLinkedBy] = useState<string | undefined>(undefined);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    bucketExists?: boolean;
    examsTableReady?: boolean;
    questionsTableReady?: boolean;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSqlSetup, setShowSqlSetup] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.supabaseUrl || '');
      setSupabaseAnonKey(cfg.supabaseAnonKey || '');
      setBucketName(cfg.bucketName || 'exam-media');
      setIsCloudLinked(Boolean(cfg.isCloudLinked));
      setLinkedAt(cfg.linkedAt);
      setLinkedBy(cfg.linkedBy);
      setTestResult(null);
      setSaveSuccess(false);

      // Refresh from Firestore in case it was linked from another device
      initSupabaseFromCloud().then((remoteCfg) => {
        if (remoteCfg && remoteCfg.isConfigured) {
          setSupabaseUrl(remoteCfg.supabaseUrl);
          setSupabaseAnonKey(remoteCfg.supabaseAnonKey);
          setBucketName(remoteCfg.bucketName || 'exam-media');
          setIsCloudLinked(Boolean(remoteCfg.isCloudLinked));
          setLinkedAt(remoteCfg.linkedAt);
          setLinkedBy(remoteCfg.linkedBy);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict Admin Gate: Non-admin users cannot modify cloud config
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="liquid-glass border border-rose-500/30 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
            Restricted Configuration
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
            One-time Supabase cloud linking is restricted to the administrator account. All student and teacher devices inherit the link automatically.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full liquid-glass-btn text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleCopySql = () => {
    const sql = getSupabaseSetupSql(bucketName || 'exam-media');
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveSuccess(false);

    // Temporarily save locally to test with latest values
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
        bucketExists: res.bucketExists,
        examsTableReady: res.examsTableReady,
        questionsTableReady: res.questionsTableReady,
      });
      if (!res.examsTableReady || !res.questionsTableReady) {
        setShowSqlSetup(true);
      }
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

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);

    try {
      const result = await saveSupabaseConfigToCloud(
        {
          supabaseUrl,
          supabaseAnonKey,
          bucketName,
        },
        user?.email || undefined
      );

      const updated = getSupabaseConfig();
      setIsCloudLinked(Boolean(updated.isCloudLinked));
      setLinkedAt(updated.linkedAt);
      setLinkedBy(updated.linkedBy);
      setSaveSuccess(true);

      setTestResult({
        success: true,
        message: result.cloudSynced
          ? 'One-Time Cloud Link active! Saved to Cloud Firestore (/admin_settings/supabase_config) so all devices stay connected permanently.'
          : 'Saved locally on this device.',
      });

      onConfigSaved?.();
      setTimeout(() => {
        onClose();
      }, 1100);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await clearSupabaseConfigFromCloud();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setBucketName('exam-media');
    setIsCloudLinked(false);
    setLinkedAt(undefined);
    setLinkedBy(undefined);
    setTestResult({
      success: false,
      message: 'One-Time Supabase cloud link cleared. App is running in Firebase + Local Storage mode.',
    });
    onConfigSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="liquid-glass rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] border border-white/70 dark:border-white/15">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  One-Time Supabase Link &amp; Question Bank
                </h3>
                {isCloudLinked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CloudCheck className="w-3 h-3" />
                    <span>Linked Across All Devices</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                    Link Once • Sync Everywhere
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Link your Supabase project once to permanently sync questions, exams &amp; diagram images across all devices.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full liquid-glass-btn text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Active One-Time Link Banner */}
          {isCloudLinked && supabaseUrl && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <CloudCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                    Permanent Cloud Link Active ({supabaseUrl.replace(/^https?:\/\//, '')})
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    All student &amp; teacher devices automatically connect via Cloud Firestore
                    {linkedAt ? ` • Linked ${new Date(linkedAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold text-[10px] shrink-0">
                Connected
              </span>
            </div>
          )}

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
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Anon Public API Key</span>
                <span className="text-[10px] text-zinc-400 font-normal">Project Settings &gt; API &gt; anon public</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Media Storage Bucket Name</span>
                <span className="text-[10px] text-zinc-400 font-normal">Default: exam-media</span>
              </label>
              <div className="relative">
                <FolderArchive className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="exam-media"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>
          </div>

          {/* Test Status Feedback Box */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                )}
                <div className="leading-relaxed flex-1 font-medium">{testResult.message}</div>
              </div>

              {(testResult.bucketExists !== undefined ||
                testResult.examsTableReady !== undefined ||
                testResult.questionsTableReady !== undefined) && (
                <div className="flex items-center gap-2 flex-wrap pt-1 pl-6">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      testResult.bucketExists
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Bucket ({bucketName || 'exam-media'}): {testResult.bucketExists ? 'Ready ✓' : 'Run SQL Setup'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      testResult.examsTableReady
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    official_exams table: {testResult.examsTableReady ? 'Ready ✓' : 'Run SQL Setup'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      testResult.questionsTableReady
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    exam_questions table: {testResult.questionsTableReady ? 'Ready ✓' : 'Run SQL Setup'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 1-Click SQL Schema & Storage Bucket Setup Accordion */}
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSqlSetup(!showSqlSetup)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>1-Click SQL Setup for Tables (`official_exams`, `exam_questions`) &amp; Storage Bucket</span>
              </div>
              {showSqlSetup ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSqlSetup && (
              <div className="px-4 pb-4 pt-2 space-y-2.5 border-t border-sky-500/15">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    Copy and run this once in your <strong>Supabase SQL Editor</strong> to create the question bank tables and public media bucket policies:
                  </p>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition shadow-2xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL Script</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-44 border border-zinc-800 leading-relaxed">
                  {getSupabaseSetupSql(bucketName || 'exam-media')}
                </pre>
              </div>
            )}
          </div>

          {/* Quick Guide Accordion */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>How to get free Supabase credentials (2 min)</span>
              </div>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showGuide && (
              <div className="px-4 pb-4 pt-1 text-xs text-zinc-600 dark:text-zinc-300 space-y-2 border-t border-emerald-500/15">
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <li>
                    Open{' '}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      supabase.com/dashboard <ExternalLink className="w-2.5 h-2.5" />
                    </a>{' '}
                    and create or select your project.
                  </li>
                  <li>Open <strong>SQL Editor</strong>, paste the <strong>1-Click SQL Setup</strong> script above, and click <strong>Run</strong>.</li>
                  <li>Go to <strong>Project Settings &gt; API</strong>, copy your <strong>Project URL</strong> and <strong>anon public key</strong>, paste them above, and click <strong>Link &amp; Save Permanently</strong>.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Offline / Fallback Note */}
          <div className="p-3 rounded-2xl liquid-glass-subtle text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Once linked here, the connection is stored in Cloud Firestore so you never need to re-enter credentials on any device.
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 sm:p-5 border-t border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] flex items-center justify-between gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-rose-500 transition cursor-pointer"
          >
            Unlink Cloud Config
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTesting || !supabaseUrl || !supabaseAnonKey}
              onClick={handleTestConnection}
              className="px-4 py-2 rounded-full liquid-glass-btn text-xs font-bold text-zinc-700 dark:text-zinc-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
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
              disabled={isSaving || !supabaseUrl || !supabaseAnonKey}
              onClick={handleSave}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs hover:shadow-emerald-500/20 active:scale-98 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Linked Permanently!</span>
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Linking...</span>
                </>
              ) : (
                <span>Link &amp; Save Permanently</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

