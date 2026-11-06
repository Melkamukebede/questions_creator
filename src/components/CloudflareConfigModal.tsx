import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  Lock,
  Loader2,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  getCloudflareConfig,
  saveCloudflareConfig,
  testCloudflareConnection,
  CloudflareConfig,
} from '../services/cloudflareService';

interface CloudflareConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
  isAdmin: boolean;
}

export const CloudflareConfigModal: React.FC<CloudflareConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  isAdmin,
}) => {
  const [accountId, setAccountId] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [bucketName, setBucketName] = useState('sinahard-exams');
  const [publicDomain, setPublicDomain] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [currentConfig, setCurrentConfig] = useState<CloudflareConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const cfg = await getCloudflareConfig();
      setCurrentConfig(cfg);
      setAccountId(cfg.accountId || '');
      setBucketName(cfg.bucketName || 'sinahard-exams');
      setPublicDomain(cfg.publicDomain || '');
    } catch (err) {
      console.warn('Error loading Cloudflare config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-950 dark:text-white font-['Outfit',sans-serif]">
            Administrator Access Required
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Only verified administrators have permission to configure Cloudflare R2 cloud credentials.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await testCloudflareConnection();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message || 'Connected to Cloudflare R2 bucket successfully!',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Failed to connect. Please verify your credentials and bucket permissions.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim()) {
      setStatusMessage({ type: 'error', text: 'Cloudflare Account ID is required.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await saveCloudflareConfig({
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicDomain,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Cloudflare R2 configuration updated successfully!',
        });
        await loadConfig();
        onConfigSaved?.();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Failed to save configuration.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Clear Cloudflare R2 credentials from this browser session?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sinahard_cf_account_id');
        localStorage.removeItem('sinahard_cf_bucket');
        localStorage.removeItem('sinahard_cf_domain');
      }
      setAccountId('');
      setAccessKeyId('');
      setSecretAccessKey('');
      setBucketName('sinahard-exams');
      setPublicDomain('');
      setCurrentConfig(null);
      setStatusMessage({ type: 'info', text: 'Credentials cleared. Fallback to in-app Base64 storage active.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center shadow-xs">
                <Cloud className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white font-['Outfit',sans-serif]">
                Cloudflare R2 Storage Setup
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Zero egress fees for university circuit diagrams, mathematics figures, and official examination papers.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Callout Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                : 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Layers className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Active Engine Badge */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="space-y-0.5">
            <span className="font-extrabold uppercase text-[10px] text-zinc-400 tracking-wider">Storage Engine</span>
            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>Cloudflare R2 (S3 Protocol)</span>
              {currentConfig?.isConfigured ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-extrabold">
                  Active
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-bold">
                  Local Fallback Mode
                </span>
              )}
            </div>
          </div>

          <a
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-bold text-xs"
          >
            <span>Cloudflare Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300 block">
              Cloudflare Account ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. 8f2c3d4e5a6b7c8d9e0f1a2b3c4d5e6f"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <p className="text-[11px] text-zinc-400">
              Found on your Cloudflare dashboard under Account Home &gt; Overview (right sidebar).
            </p>
          </div>

          {/* R2 Access Key ID */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300 block">
              R2 Access Key ID
            </label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="e.g. 71a8bc... (leave blank to keep existing server secret)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          {/* R2 Secret Access Key */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300 block">
              R2 Secret Access Key
            </label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <p className="text-[11px] text-zinc-400">
              Generated from Cloudflare Dashboard &gt; R2 Object Storage &gt; Manage R2 API Tokens.
            </p>
          </div>

          {/* Bucket Name & Public Domain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 block">Bucket Name</label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="sinahard-exams"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 block">
                Public Custom Domain (Optional)
              </label>
              <input
                type="text"
                value={publicDomain}
                onChange={(e) => setPublicDomain(e.target.value)}
                placeholder="e.g. cdn.sinahard.edu.et"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-100 dark:border-white/10 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#0c182b] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>Test Connection</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
