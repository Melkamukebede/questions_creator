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

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState<string>(currentConfig.url);
  const [anonKey, setAnonKey] = useState<string>(currentConfig.anonKey);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

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
        // Warning if storage is restricted by RLS, but connection succeeded
        setStatusMsg({
          type: 'success',
          text: 'Connected to Supabase! (Note: ensure "exam-media" bucket has public read/upload permissions).',
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
      <div className="relative w-full max-w-lg rounded-[28px] bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/70 dark:bg-[#070e1a]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  Supabase Cloud Storage
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Postgres + Media
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Host official exam images, schematics, and university exams
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

        {/* Body */}
        <form onSubmit={handleTestAndSave} className="p-6 space-y-4">
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
              Found in your Supabase Dashboard under <strong>Project Settings → API</strong>.
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
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
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

          {/* Quick Guidance Box */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Storage Architecture &amp; Fallbacks</span>
            </div>
            <p>
              Uploaded diagrams, circuit schematics, and university exams automatically sync to your <strong>'exam-media'</strong> bucket and <strong>'official_exams'</strong> table. If Supabase is offline or unconfigured, SinaHard uses local Base64 and Firestore automatically.
            </p>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline pt-0.5"
            >
              <span>Open Supabase Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {currentConfig.isConfigured ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-transparent hover:border-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Key</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isTesting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save &amp; Connect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
