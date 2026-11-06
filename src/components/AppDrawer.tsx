import React, { useEffect } from 'react';
import {
  X,
  Bell,
  BookOpen,
  LogOut,
  Cloud,
  CloudOff,
  ChevronRight,
  ShieldCheck,
  Crown,
  CloudUpload,
  Send,
  Bot,
  Phone,
  Copy,
  Check,
  ExternalLink,
  School,
  CheckCircle2,
  Clock,
  Smartphone,
  Download,
  Share2,
  Lock,
  Database,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { UserSubscription } from '../types';
import { isUserAdmin, isUserTeacher } from '../services/db';
import { SinahardLogo } from './SinahardLogo';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNotificationsModal: () => void;
  onNavigateToManual?: () => void;
  onNavigateToAdminSubs?: () => void;
  onNavigateToSharedHistory?: () => void;
  onOpenDatabaseUpload?: () => void;
  onExportAllData?: () => void;
  onResetDefaultExams?: () => void;
  onOpenDownloadCenter?: () => void;
  onOpenCloudflareConfig?: () => void;
  onOpenAdminOfficialStudio?: () => void;
  activeSubscription: UserSubscription | null;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  onOpenNotificationsModal,
  onNavigateToManual,
  onNavigateToAdminSubs,
  onNavigateToSharedHistory,
  onOpenDatabaseUpload,
  onOpenSubscriptionModal,
  onOpenDownloadCenter,
  onOpenCloudflareConfig,
  onOpenAdminOfficialStudio,
}) => {
  const { user, signOut, firstRegisteredEmail } = useAuth();
  const isAdmin = Boolean(user && !user.isAnonymous && user.uid !== 'guest' && isUserAdmin(user));
  const { unreadAlertsCount, completedToday, dailyGoal, studyStreakDays } = useNotifications();
  const { isInstalled, installApp } = usePWAInstall();
  const [copiedPhone, setCopiedPhone] = React.useState(false);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText('+251918049806');
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      // fallback
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCloudSynced = Boolean(user && user.uid !== 'guest' && !user.isAnonymous);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div
          id="app-drawer-panel"
          className="relative w-screen max-w-sm bg-white/95 dark:bg-[#070e1a]/95 backdrop-blur-2xl border-l border-white/60 dark:border-white/10 shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-300 ease-out overflow-hidden"
        >
          {/* Subtle Atmospheric Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-zinc-400/5 dark:bg-zinc-700/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-12 -left-24 w-64 h-64 bg-zinc-400/5 dark:bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />

          {/* Drawer Header - Frosted Glass Bar */}
          <div className="relative px-5 py-4 border-b border-white/60 dark:border-white/10 flex items-center justify-between bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <SinahardLogo size="sm" idSuffix="drawer" />
              <div>
                <h3 className="font-bold text-sm font-['Outfit',sans-serif] text-zinc-900 dark:text-white">
                  Sinahard Menu
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Utilities, AI tools & settings
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="relative flex-1 overflow-y-auto p-5 space-y-4">
            {/* User Account / Profile Porcelain Card */}
            <div className="p-4 rounded-[22px] bg-white dark:bg-[#0c182b] border border-white/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || user.email || 'User'}
                    className="w-10 h-10 rounded-full border border-white/80 dark:border-white/20 object-cover shadow-2xs"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm border border-white/80 dark:border-white/10 shadow-2xs">
                    {(user?.displayName || user?.email || 'S').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                    {user?.displayName || 'Guest Student'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {isCloudSynced ? (
                      <>
                        <Cloud className="w-3 h-3 text-zinc-900 dark:text-white" />
                        <span className="text-zinc-900 dark:text-white font-medium">
                          Cloud Synced
                        </span>
                      </>
                    ) : (
                      <>
                        <CloudOff className="w-3 h-3 text-zinc-400" />
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          Local Guest Storage
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {firstRegisteredEmail && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-sky-500 shrink-0" />
                    <span>Bound Account:</span>
                  </span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">
                    {firstRegisteredEmail}
                  </span>
                </div>
              )}

              {isCloudSynced && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Specialized Tools & Utilities */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                Tools & Utilities
              </div>

              {/* For Teachers: Dedicated Teacher Verification & School Status Card */}
              {isUserTeacher(user) && (
                <div className="p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] border border-white/80 dark:border-white/10 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                        <School className="w-4 h-4 text-zinc-950 dark:text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white">
                          {user?.school || user?.schoolName || 'Ethiopian School'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {user?.teachingSubject ? `${user.teachingSubject} Teacher` : 'Teacher Account'}
                        </div>
                      </div>
                    </div>

                    {user?.isVerifiedTeacher ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/10">
                        <CheckCircle2 className="w-3 h-3 text-zinc-950 dark:text-white" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        <span>Pending Check</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Premium Ethiopian Birr Subscription Card (For Students/General Only) */}
              {!isUserTeacher(user) && !isUserAdmin(user) && (
                <button
                  id="drawer-premium-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSubscriptionModal();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                      <Crown className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Premium Subscription</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          ETB
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Telebirr, CBE & Chapa day/month plans
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Admin Check Panel (Melkamu / Admin - Teachers & Payments) */}
              {isUserAdmin(user) && onNavigateToAdminSubs && (
                <button
                  id="drawer-admin-subs-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToAdminSubs();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-zinc-950 dark:text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Admin Check Panel</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          Admin
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Verify teachers &amp; student payments
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Official Exam & Media Studio (Admin Only - Cloudflare R2 Cloud) */}
              {isUserAdmin(user) && onOpenAdminOfficialStudio && (
                <button
                  id="drawer-admin-official-studio-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminOfficialStudio();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Official Exam &amp; Media Studio</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          Admin Only
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Upload diagrams to Cloudflare R2 &amp; publish official exams
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Database Storage Uploader (Cloud Firestore - Teacher or Admin) */}
              {(isUserAdmin(user) || isUserTeacher(user)) && onOpenDatabaseUpload && (
                <button
                  id="drawer-db-upload-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDatabaseUpload();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                      <CloudUpload className="w-4 h-4 text-zinc-950 dark:text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Push to Cloud Firestore</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          {isUserAdmin(user) ? 'Admin' : 'Teacher'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Push exams and questions directly to Cloud Firestore
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Offline SQLite Download Center */}
              {onOpenDownloadCenter && (
                <button
                  id="drawer-download-center-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDownloadCenter();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold shadow-2xs">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Offline Download Center</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          SQLite .db
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Download multi-year university &amp; high school exam bundles
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Cloudflare R2 Cloud Storage Configuration (Admin Only) */}
              {isAdmin && onOpenCloudflareConfig && (
                <button
                  id="drawer-cloudflare-config-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCloudflareConfig();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold shadow-2xs">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Cloudflare R2 Media Storage</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          Cloud
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Manage Cloudflare R2 credentials for zero-egress diagrams
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Shared History Page Button */}
              {onNavigateToSharedHistory && (
                <button
                  id="drawer-shared-history-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSharedHistory();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                      <Share2 className="w-4 h-4 text-zinc-950 dark:text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Shared Exam History</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          Links &amp; Codes
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        View shared tests, access codes &amp; delete history
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Push & Study Notifications */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNotificationsModal();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-white/80 dark:border-white/10 flex items-center justify-center shadow-2xs">
                    <Bell className="w-4 h-4" />
                    {unreadAlertsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-900 dark:bg-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>Daily Target & Streak</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30">
                        🔥 {studyStreakDays}d streak
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Goal: {completedToday}/{dailyGoal} completed today
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Install Mobile App (PWA) Button */}
              {!isInstalled && (
                <button
                  id="drawer-install-app-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    installApp();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-gradient-to-r from-sky-500/10 via-blue-600/10 to-emerald-500/10 hover:from-sky-500/15 hover:to-emerald-500/15 border border-sky-500/30 text-left shadow-xs active:scale-98 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold shadow-2xs">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Install App (PC & Mobile)</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300">
                          Offline App
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Install on Windows, Mac, Android or iPhone
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:translate-y-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Contact Us & Community Support */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center justify-between">
                <span>Contact Us & Support</span>
                <span className="text-[10px] lowercase font-normal text-zinc-500">24/7 student help</span>
              </div>

              {/* Telegram Group */}
              <a
                id="drawer-contact-telegram-group"
                href="https://t.me/aplus012"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#229ED9]/15 dark:bg-[#229ED9]/25 text-[#229ED9] border border-[#229ED9]/30 flex items-center justify-center font-bold shadow-2xs">
                    <Send className="w-4 h-4 -translate-x-[1px] translate-y-[1px]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Telegram Group</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20">
                        @aplus012
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Join community discussions & updates
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
              </a>

              {/* Telegram Support Bot */}
              <a
                id="drawer-contact-support-bot"
                href="https://t.me/Frm2026_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] border border-white/80 dark:border-white/10 text-left shadow-xs active:scale-98 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center font-bold shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>Support Bot</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10">
                        @Frm2026_bot
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Automated support, Q&A & direct assistance
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-transform" />
              </a>

              {/* Phone Hotline with Direct Call & Copy */}
              <div
                id="drawer-contact-phone"
                className="p-3.5 rounded-[22px] bg-white dark:bg-[#0c182b] border border-white/80 dark:border-white/10 text-left shadow-xs transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shadow-2xs">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>Phone Hotline</span>
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Direct
                        </span>
                      </div>
                      <a
                        href="tel:+251918049806"
                        className="text-[12px] font-mono font-semibold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:underline block"
                      >
                        +251 918 049 806
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      title="Copy phone number"
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                          <span className="text-[11px] text-zinc-900 dark:text-white font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                    <a
                      href="tel:+251918049806"
                      className="p-2 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition cursor-pointer shadow-2xs"
                      title="Call +251918049806"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="px-5 py-4 border-t border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Sinahard Pro
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              v2.1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
