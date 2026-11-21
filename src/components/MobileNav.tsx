import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  PlusCircle,
  Menu,
  ShieldCheck,
} from 'lucide-react';
import { PageTab } from './Navbar';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin, isUserTeacher } from '../services/db';
import { prefetchCreateWizard } from '../services/prefetch';

interface MobileNavProps {
  activeTab: PageTab;
  onTabChange: (tab: PageTab) => void;
  onOpenDrawer: () => void;
  isDrawerOpen?: boolean;
  examsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  onOpenDrawer,
  isDrawerOpen = false,
  examsCount = 0,
}) => {
  const { unreadAlertsCount } = useNotifications();
  const { user } = useAuth();
  const isTeacher = Boolean(user && isUserTeacher(user));
  const isAdmin = isUserAdmin(user);

  const navButtonBase =
    'relative flex-1 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 py-1.5 md:py-2.5 px-2 md:px-4 rounded-full transition-colors duration-150 cursor-pointer select-none';

  const activePillStyle =
    'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 font-bold shadow-[0_2px_10px_rgba(0,0,0,0.12)] border border-white/95';

  const inactivePillStyle =
    'bg-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-white/45 dark:hover:bg-white/[0.06] font-semibold border border-transparent';

  return (
    <nav
      id="unified-bottom-nav"
      aria-label="Primary Bottom Navigation Dock"
      className="fixed bottom-3 sm:bottom-4 left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none select-none font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div className="pointer-events-auto max-w-md md:max-w-xl mx-auto rounded-full floating-glass-bar p-1.5 flex items-center justify-between gap-1 shadow-[0_14px_38px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_48px_rgba(0,0,0,0.65)] border border-white/80 dark:border-white/15">
        {/* 1. Home */}
        <button
          id="bottom-nav-home"
          type="button"
          onClick={() => onTabChange('home')}
          className={`${navButtonBase} ${
            activeTab === 'home' && !isDrawerOpen ? activePillStyle : inactivePillStyle
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs tracking-tight leading-none">Home</span>
        </button>

        {/* 2. Exams / Library */}
        <button
          id="bottom-nav-files"
          type="button"
          onClick={() => onTabChange('files')}
          className={`${navButtonBase} ${
            activeTab === 'files' && !isDrawerOpen ? activePillStyle : inactivePillStyle
          }`}
        >
          <div className="relative flex items-center justify-center">
            <BookOpen className="w-4 h-4 shrink-0" />
            {examsCount > 0 && activeTab !== 'files' && (
              <span className=" -top-1.5 -right-2.5 absolute min-w-3.5 h-3.5 px-1 rounded-full bg-sky-500 text-white text-[9px] font-extrabold tabular-nums flex items-center justify-center shadow-2xs">
                {examsCount > 99 ? '99+' : examsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] md:text-xs tracking-tight leading-none">
            {isTeacher ? 'School' : 'Exams'}
          </span>
        </button>

        {/* 3. Create Exam */}
        <button
          id="bottom-nav-create"
          type="button"
          onMouseEnter={prefetchCreateWizard}
          onTouchStart={prefetchCreateWizard}
          onClick={() => onTabChange('create')}
          className={`${navButtonBase} ${
            activeTab === 'create' && !isDrawerOpen ? activePillStyle : inactivePillStyle
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs tracking-tight leading-none">Create</span>
        </button>

        {/* 4. Activity or Admin Hub */}
        {isAdmin ? (
          <button
            id="bottom-nav-admin"
            type="button"
            onClick={() => onTabChange('admin-subs')}
            className={`${navButtonBase} ${
              activeTab === 'admin-subs' && !isDrawerOpen ? activePillStyle : inactivePillStyle
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="text-[10px] md:text-xs tracking-tight leading-none">Admin</span>
          </button>
        ) : !isTeacher ? (
          <button
            id="bottom-nav-results"
            type="button"
            onClick={() => onTabChange('results')}
            className={`${navButtonBase} ${
              activeTab === 'results' && !isDrawerOpen ? activePillStyle : inactivePillStyle
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="text-[10px] md:text-xs tracking-tight leading-none">Activity</span>
          </button>
        ) : null}

        {/* 5. Menu / Utilities Drawer */}
        <button
          id="bottom-nav-menu"
          type="button"
          onClick={onOpenDrawer}
          className={`${navButtonBase} ${
            isDrawerOpen ? activePillStyle : inactivePillStyle
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Menu className="w-4 h-4 shrink-0" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-500" />
            )}
          </div>
          <span className="text-[10px] md:text-xs tracking-tight leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
};
