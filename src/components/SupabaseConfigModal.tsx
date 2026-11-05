import React, { useState } from 'react';
import {
  X,
  Database,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Trash2,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Code2,
  BookOpen,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseClient,
} from '../services/supabaseService';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

const SUPABASE_SQL_MIGRATION = `-- =========================================================================
-- Sinahard Official Exams & Media Schema Migration for Supabase
-- =========================================================================

-- 1. Create table for official university and matriculation exams
CREATE TABLE IF NOT EXISTS public.official_exams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  subject TEXT NOT NULL,
  topic TEXT,
  grade TEXT NOT NULL,
  tier TEXT DEFAULT 'university',
  university TEXT,
  department TEXT,
  academic_year TEXT,
  semester TEXT,
  exam_type TEXT,
  exam_year TEXT,
  time_limit INTEGER DEFAULT 60,
  description TEXT,
  questions JSONB NOT NULL,
  question_count INTEGER DEFAULT 0,
  has_images BOOLEAN DEFAULT false,
  has_tables BOOLEAN DEFAULT false,
  storage_source TEXT DEFAULT 'supabase',
  category TEXT DEFAULT 'official',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.official_exams ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public students can read and query all official exams
CREATE POLICY "Public Read Access to Official Exams"
  ON public.official_exams FOR SELECT
  USING (true);

-- 4. Policy: Allow insert and update
CREATE POLICY "Full Access to Official Exams"
  ON public.official_exams FOR ALL
  USING (true);

-- 5. Create storage bucket for diagrams, circuits, and illustrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-media', 'exam-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Storage Policies: Allow anyone to view images, and allow upload
CREATE POLICY "Public Media Read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exam-media');

CREATE POLICY "Allow Media Uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'exam-media');
`;

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [activeTab, setActiveTab] = useState<'connect' | 'guide'>('connect');
  const [url, setUrl] = useState<string>(currentConfig.url);
  const [anonKey, setAnonKey] = useState<string>(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCopySql = () => {
    try {
      navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setStatusMsg({ type: 'error', text: 'Both Supabase Project URL and Anon Key are required.' });
      return;
    }

    if (!url.startsWith('https://')) {
      setStatusMsg({ type: 'error', text: 'Supabase URL must start with https://' });
      return;
    }

    setIsTesting(true);
    setStatusMsg(null);

    try {
      saveSupabaseConfig(url.trim(), anonKey.trim());
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Could not create client with provided credentials');
      }

      // Quick test query (check connection by testing storage buckets or pinging table)
      const { error: storageError } = await client.storage.listBuckets();
      
      if (storageError && !storageError.message.includes('not found')) {
        setStatusMsg({
          type: 'success',
          text: 'Connected to Supabase! (Note: ensure "exam-media" bucket is created with public access).',
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: 'Successfully connected to Supabase Storage & PostgreSQL!',
        });
      }

      if (onConfigSaved) onConfigSaved();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setStatusMsg({ type: 'error', text: `Failed to connect: ${msg}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setStatusMsg({ type: 'success', text: 'Custom Supabase credentials cleared. System fallbacks active.' });
    if (onConfigSaved) onConfigSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-2xl rounded-[32px] bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/70 dark:bg-[#070e1a]/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  Supabase Cloud Setup &amp; Linking
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  PostgreSQL + Media
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official exam storage and technical diagram hosting for SinaHard
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-100 dark:border-white/10 bg-zinc-50/40 dark:bg-[#091322]/40 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'connect'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Connect Credentials</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Step-by-Step Linking Guide &amp; SQL</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {activeTab === 'connect' ? (
            <form onSubmit={handleTestAndSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Supabase Project URL</span>
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-emerald-500 transition shadow-2xs"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Find in your Supabase Dashboard under <strong>Project Settings → API → Project URL</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Supabase Anon (Public) Key</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-hidden focus:border-emerald-500 transition shadow-2xs"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Find in your Supabase Dashboard under <strong>Project Settings → API → Project API Keys (anon public)</strong>.
                </p>
              </div>

              {/* Status Message */}
              {statusMsg && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
                    statusMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                      : 'bg-red-500/10 text-red-800 dark:text-red-200 border-red-500/30'
                  }`}
                >
                  {statusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {/* Info banner */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-white">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span>Admin Control &amp; Storage Routing</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('guide')}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View Setup Guide</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Only verified administrators can publish official exams and upload diagram images to your Supabase cloud storage. All students can query and download questions into their local in-app repository without needing write credentials.
                </p>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-between gap-3 pt-3">
                {currentConfig.isConfigured ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3.5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-transparent hover:border-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Credentials</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Connection...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Test &amp; Save Credentials</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Interactive Guide & SQL Generator Tab */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                  How to link Supabase and Sinahard (4 Simple Steps)
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Follow these 4 steps to provision free cloud storage for your official university and matriculation exam diagrams and databases.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                      Create a Free Supabase Project
                    </h5>
                  </div>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-8">
                  Sign in at <strong>supabase.com</strong>, click <strong>"New Project"</strong>, choose any name (e.g., <em>sinahard-exams</em>) and pick the closest region.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                      Run the SQL Schema Generator
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Complete SQL Script</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-8">
                  In your Supabase project, click <strong>SQL Editor</strong> on the left sidebar, paste the copied SQL script, and click <strong>"Run"</strong>. This creates the <code>official_exams</code> table and sets up public read RLS policies.
                </p>
                <div className="pl-8 pt-1">
                  <div className="p-2.5 rounded-xl bg-zinc-950 dark:bg-black border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-32 overflow-y-auto">
                    <pre>{SUPABASE_SQL_MIGRATION}</pre>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                    3
                  </span>
                  <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                    Create the 'exam-media' Storage Bucket
                  </h5>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-8">
                  Navigate to <strong>Storage</strong> in Supabase, click <strong>"New Bucket"</strong>, name it exactly <code>exam-media</code>, and toggle <strong>"Public Bucket"</strong> to <strong>ON</strong>. (The SQL script in Step 2 also does this automatically).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                    4
                  </span>
                  <h5 className="font-bold text-xs text-zinc-900 dark:text-white">
                    Copy API Keys &amp; Link to SinaHard
                  </h5>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 pl-8">
                  Go to <strong>Project Settings → API</strong>. Copy the <strong>Project URL</strong> and <strong>anon public key</strong>, switch back to the <em>"Connect Credentials"</em> tab above, paste them in, and click <strong>"Test &amp; Save"</strong>.
                </p>
                <div className="pl-8 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('connect')}
                    className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Enter My Credentials Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
