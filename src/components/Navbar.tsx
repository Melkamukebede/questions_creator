import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  PlusCircle,
  Sun,
  Moon,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  CloudOff,
  GraduationCap,
  Sparkles,
  Menu,
  HelpCircle,
  ShieldCheck,
  UserPlus,
  Edit3,
  CheckCircle2,
  Lock,
  Download,
  Database,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { AuthNoticeModal } from './AuthNoticeModal';
import { isUserAdmin, isUserSubscriptionActive, isUserTeacher } from '../services/db';
import { UserSubscription } from '../types';
import { SinahardLogo } from './SinahardLogo';
import { AppCoin } from './AppCoin';
import { getUserCoins } from '../services/coinService';
import { isAppOffline, subscribeToNetworkState } from '../firebase';
import { prefetchCreateWizard } from '../services/prefetch';

export type PageTab = 'home' | 'files' | 'results' | 'create' | 'manual' | 'admin-subs' | 'shared-history';

interface NavbarProps {
  activeTab: PageTab;
  onTabChange: (tab: PageTab) => void;
  onOpenNotifications: () => void;
  onOpenDrawer: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenDownloadCenter?: () => void;
  onOpenSupabaseConfig?: () => void;
  onOpenAdminOfficialStudio?: () => void;
  activeSubscription: UserSubscription | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenNotifications,
  onOpenDrawer,
  onOpenSubscriptionModal,
  onOpenDownloadCenter,
  onOpenSupabaseConfig,
  onOpenAdminOfficialStudio,
  activeSubscription,
}) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const {
    user,
    signInWithGoogle,
    signOut,
    loading: authLoading,
    isSigningIn,
    popupBlocked,
    dismissPopupBlocked,
    openRegistrationModal,
    firstRegisteredEmail,
  } = useAuth();
  const { unreadAlertsCount } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [manualNoticeOpen, setManualNoticeOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  const isCloudSynced = Boolean(user && user.uid !== 'guest' && !user.isAnonymous);
  const isAdmin = isUserAdmin(user);
  const isTeacher = Boolean(user && isUserTeacher(user));
  const isPremiumActive = isUserSubscriptionActive(activeSubscription);

  // Coin and Tier State
  const [userCoins, setUserCoins] = useState<number>(() => getUserCoins(user, activeSubscription));

  React.useEffect(() => {
    setUserCoins(getUserCoins(user, activeSubscription));
    const handleCoinsChanged = (e: Event) => {
      const custom = e as CustomEvent<{ coins: number }>;
      if (custom.detail && typeof custom.detail.coins === 'number') {
        setUserCoins(custom.detail.coins);
      } else {
        setUserCoins(getUserCoins(user, activeSubscription));
      }
    };
    window.addEventListener('sinahard_coins_updated', handleCoinsChanged);
    return () => {
      window.removeEventListener('sinahard_coins_updated', handleCoinsChanged);
    };
  }, [user, activeSubscription]);

  // Offline state subscription
  const [isOffline, setIsOffline] = useState<boolean>(() => isAppOffline());
  React.useEffect(() => {
    return subscribeToNetworkState(setIsOffline);
  }, []);

  const isGuest = !user || user.uid === 'guest' || user.isAnonymous;
  const isStaff = Boolean(isAdmin || isTeacher);
  const isPro = !isOffline && (isStaff || isPremiumActive || userCoins >= 4);
  const isFree = !isGuest && !isPro;

  // Derive stable monogram initial from user displayName, email, or role
  const userMonogram = (
    user?.displayName ||
    user?.email ||
    (user?.role === 'teacher' ? 'T' : 'S')
  ).trim().charAt(0).toUpperCase() || 'U';

  const handleSignInClick = async () => {
    if (isSigningIn) return;
    const success = await signInWithGoogle();
    if (!success && popupBlocked) {
      // modal automatically triggered via popupBlocked
    }
  };

  return (
    <header className="sticky top-2 sm:top-3.5 z-40 w-full px-2 sm:px-4 lg:px-6 pointer-events-none transition-all duration-300 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="pointer-events-auto max-w-7xl mx-auto rounded-full floating-glass-bar px-3 sm:px-4 lg:px-5 h-15 sm:h-16 flex items-center justify-between gap-2 shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.55)]">
        {/* Brand with Dynamic Guest / Free / Pro Badge */}
        <div
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.25)] transition group-hover:scale-105">
            <SinahardLogo size="sm" idSuffix="navbar" />
          </div>
          <div className="flex flex-col">
            <span className="font-['Outfit',sans-serif] font-black text-base sm:text-lg tracking-tight text-zinc-900 dark:text-white flex items-center">
              SinaHard
              {isGuest ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    openRegistrationModal();
                  }}
                  className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 ml-1.5 cursor-pointer hover:border-zinc-400 dark:hover:border-white/20 transition"
                  title="Guest Mode (0 Coins) - Register to get 1 Free Coin"
                >
                  Guest
                </span>
              ) : isPro ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSubscriptionModal?.();
                  }}
                  className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ml-1.5 items-center gap-1 cursor-pointer hover:bg-amber-500/25 transition shadow-2xs"
                  title="Pro Scholar Plan Active"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  Pro
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSubscriptionModal?.();
                  }}
                  className="hidden sm:inline-flex text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 ml-1.5 cursor-pointer hover:bg-sky-500/25 transition shadow-2xs"
                  title="Free Registered Tier"
                >
                  Free
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Center Floating Glass Segmented Navigation */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-slate-200/45 dark:bg-white/[0.06] backdrop-blur-md border border-white/75 dark:border-white/10 text-xs shadow-2xs">
          {/* 1. Home Tab */}
          <button
            id="nav-tab-home"
            type="button"
            onClick={() => onTabChange('home')}
            className={`glass-pill-btn cursor-pointer ${
              activeTab === 'home'
                ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/95 shadow-xs font-bold'
                : 'text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          {/* 2. Exams / Library Tab */}
          <button
            id="nav-tab-files"
            type="button"
            onClick={() => onTabChange('files')}
            className={`glass-pill-btn cursor-pointer ${
              activeTab === 'files'
                ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/95 shadow-xs font-bold'
                : 'text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isTeacher ? 'My School Exams' : 'Exams'}</span>
          </button>

          {/* 3. Create Exam Tab */}
          <button
            id="nav-tab-create"
            type="button"
            onMouseEnter={prefetchCreateWizard}
            onTouchStart={prefetchCreateWizard}
            onClick={() => onTabChange('create')}
            className={`glass-pill-btn cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/95 shadow-xs font-bold'
                : 'text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isTeacher ? 'Create Class Exam' : 'Create'}</span>
          </button>

          {/* 4. Recent Activity Tab */}
          {!isTeacher && (
            <button
              id="nav-tab-results"
              type="button"
              onClick={() => onTabChange('results')}
              className={`glass-pill-btn cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/95 shadow-xs font-bold'
                  : 'text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Activity</span>
            </button>
          )}

          {/* 5. Admin Hub */}
          {isAdmin && (
            <button
              id="nav-tab-admin-subs"
              type="button"
              onClick={() => onTabChange('admin-subs')}
              className={`glass-pill-btn cursor-pointer ${
                activeTab === 'admin-subs'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/95 shadow-xs font-bold'
                  : 'text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Hub</span>
            </button>
          )}

          {/* Unified Download Exams Button */}
          {onOpenDownloadCenter && (
            <button
              id="nav-tab-download-center"
              type="button"
              onClick={onOpenDownloadCenter}
              className="glass-pill-btn cursor-pointer text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent"
              title="Download official and university exams for offline practice"
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Download Exams</span>
            </button>
          )}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Light / Dark Mode Toggle Button */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] text-zinc-800 dark:text-zinc-100 border border-white/80 dark:border-white/10 transition cursor-pointer shadow-xs active:scale-98 shrink-0"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-zinc-200" />
                <span className="hidden sm:inline ml-1.5">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-zinc-700" />
                <span className="hidden sm:inline ml-1.5">Dark</span>
              </>
            )}
          </button>

          {/* Drawer Menu Button (Desktop Only: Mobile uses bottom navigation bar) */}
          <button
            id="drawer-toggle-btn"
            type="button"
            onClick={onOpenDrawer}
            className="hidden md:flex relative items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] text-zinc-800 dark:text-zinc-100 border border-white/80 dark:border-white/10 transition cursor-pointer shadow-xs active:scale-98 shrink-0"
            title="Open Utilities & Tools Drawer"
            aria-label="Open Drawer Menu"
          >
            <Menu className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Menu</span>
            {unreadAlertsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-white animate-pulse" />
            )}
          </button>

          {/* Offline indicator badge */}
          {isOffline && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 shrink-0"
              title="Network unavailable: Free/Guest 20-question limit enforced for creation and practice."
            >
              <CloudOff className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Top Navigation Coin & Tier Pill Button (Guest / Free / Pro) */}
          <button
            id="navbar-coin-pill-btn"
            type="button"
            onClick={isGuest ? openRegistrationModal : (onOpenSubscriptionModal || openRegistrationModal)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shadow-xs active:scale-98 border shrink-0 ${
              isPro
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/35'
                : !isGuest
                ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-900 dark:text-sky-200 border-sky-500/30'
                : 'bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
            }`}
            title={
              isPro
                ? `Sinahard Pro • ${isStaff || isPremiumActive ? 'Unlimited Access' : `${userCoins} Coins`}`
                : !isGuest
                ? `Free Account • ${userCoins} Coin${userCoins === 1 ? '' : 's'} Available. Tap to view plans.`
                : 'Guest Mode • 0 Coins. Tap to register and claim 1 Free Coin!'
            }
          >
            <span className="hidden sm:inline text-[10px] font-extrabold uppercase tracking-wide">
              {isPro ? 'Pro' : isGuest ? 'Guest' : 'Free'}
            </span>
            <AppCoin size="xs" />
            <span className="font-mono font-extrabold text-[11px]">
              {isStaff || isPremiumActive ? '∞' : userCoins}
            </span>
          </button>

          {/* Firebase Authentication & Sync Status */}
          {authLoading && !user ? (
            <div className="w-8 h-8 rounded-full border-2 border-zinc-400/30 border-t-zinc-900 dark:border-t-white animate-spin" />
          ) : user && isCloudSynced ? (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:pl-2 sm:pr-3 sm:py-1.5 rounded-full border border-white/80 dark:border-white/10 bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] transition cursor-pointer shadow-xs active:scale-98 shrink-0"
              >
                {user.photoURL && !avatarImgError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || user.email || 'User'}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {userMonogram}
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-bold max-w-[100px] truncate text-zinc-900 dark:text-white">
                  {user.displayName || user.email?.split('@')[0] || (user.role === 'teacher' ? 'Teacher' : 'Student')}
                </span>
                {isAdmin ? (
                  <span className="hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                    Admin
                  </span>
                ) : user.role === 'teacher' ? (
                  <span className="hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Teacher
                  </span>
                ) : user.grade ? (
                  <span className="hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10">
                    G-{user.grade}
                  </span>
                ) : null}
                <Cloud className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-72 rounded-[28px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 shadow-2xl p-4 z-50 text-sm animate-in fade-in zoom-in-95 duration-150 space-y-3">
                  <div className="pb-3 border-b border-zinc-100 dark:border-white/10 space-y-2">
                    <div className="flex items-center gap-3">
                      {user.photoURL && !avatarImgError ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || user.email || 'User'}
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-200 dark:border-white/10"
                          onError={() => setAvatarImgError(true)}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {userMonogram}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-zinc-950 dark:text-white truncate text-sm">
                            {user.displayName || user.email?.split('@')[0] || 'User'}
                          </p>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shrink-0">
                            {isAdmin ? 'Admin' : user.role || 'Student'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      {user.role === 'teacher' ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {user.school || user.schoolName || 'School Affiliated'}
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10">
                            Grade {user.grade || '12'}
                          </span>
                          {user.stream && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                              {user.stream}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {(user.school || user.schoolName) && user.role !== 'teacher' && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5 line-clamp-1">
                        School: {user.school || user.schoolName} {user.region ? `(${user.region})` : ''}
                      </p>
                    )}
                    {firstRegisteredEmail && (
                      <div className="pt-1 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <Lock className="w-3 h-3 text-sky-500 shrink-0" />
                        <span className="truncate">Bound Account: <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{firstRegisteredEmail}</strong></span>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onTabChange('admin-subs');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl text-left text-zinc-950 dark:text-white bg-zinc-100 dark:bg-white/[0.08] hover:bg-zinc-200 dark:hover:bg-white/[0.12] flex items-center gap-2.5 cursor-pointer transition text-xs font-bold"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Admin Hub (Teachers & Payments)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      openRegistrationModal();
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-left text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer transition text-xs font-bold"
                  >
                    <Edit3 className="w-4 h-4 text-black dark:text-white" />
                    <span>Change Role & School Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 cursor-pointer transition text-xs font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex items-center gap-1.5 shrink-0">
              {user && !isCloudSynced && (
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="hidden sm:flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border border-white/80 dark:border-white/10 bg-white dark:bg-[#0c182b] hover:bg-zinc-50 dark:hover:bg-[#0f1d33] transition cursor-pointer shadow-xs active:scale-98 shrink-0"
                  title="Guest Mode Profile"
                >
                  <div className="w-5 h-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {user.displayName?.charAt(0) || 'G'}
                  </div>
                  <span className="text-xs font-bold max-w-[70px] truncate text-zinc-900 dark:text-white">
                    {user.displayName}
                  </span>
                </button>
              )}

              {/* Prominent, clean Register Button: fully visible and NEVER cut off or hidden on mobile */}
              <button
                id="register-btn-main"
                type="button"
                onClick={openRegistrationModal}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition cursor-pointer shadow-xs active:scale-98 shrink-0 whitespace-nowrap"
                title="Register your profile (Student or Teacher) & Claim 1 Free Coin"
              >
                <UserPlus className="w-3.5 h-3.5 text-white dark:text-zinc-950 shrink-0" />
                <span>Register</span>
              </button>

              {showUserMenu && user && !isCloudSynced && (
                <div className="absolute right-0 top-11 mt-1 w-72 rounded-[28px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 shadow-2xl p-4 z-50 text-sm space-y-3">
                  <div className="pb-3 border-b border-zinc-100 dark:border-white/10 space-y-1">
                    <p className="font-bold text-zinc-950 dark:text-white truncate">
                      {user.displayName}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      <CloudOff className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Local Mode • {user.role === 'teacher' ? 'Teacher' : `Grade ${user.grade || '12'}`}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      openRegistrationModal();
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-left text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer transition text-xs font-bold"
                  >
                    <UserPlus className="w-4 h-4 text-black dark:text-white" />
                    <span>Setup Student / Teacher Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setManualNoticeOpen(true);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04] flex items-center gap-2.5 cursor-pointer transition text-xs"
                  >
                    <UserIcon className="w-4 h-4 text-black dark:text-white" />
                    <span>Quick Guest Name Entry</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Auth Notice Modal when popups are blocked in iframe */}
      <AuthNoticeModal
        isOpen={popupBlocked || manualNoticeOpen}
        onClose={() => {
          dismissPopupBlocked();
          setManualNoticeOpen(false);
        }}
      />
    </header>
  );
};

