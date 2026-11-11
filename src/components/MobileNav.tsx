import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Plus,
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
  examsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  onOpenDrawer,
  examsCount = 0,
}) => {
  const { unreadAlertsCount } = useNotifications();
  const { user } = useAuth();
  const isTeacher = Boolean(user && isUserTeacher(user));
  const isAdmin = isUserAdmin(user);

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-3 left-0 right-0 z-40 px-3 pointer-events-none select-none transition-all duration-300 font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div className="pointer-events-auto max-w-md mx-auto rounded-full floating-glass-bar px-2.5 py-1.5 flex items-center justify-between gap-1 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'home'
              ? 'text-slate-950 dark:text-white font-bold'
              : 'text-slate-600 dark:text-zinc-400 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all flex items-center justify-center relative ${
              activeTab === 'home'
                ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-xs border border-white/95'
                : 'bg-transparent'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* 2. Exams / Library */}
        <button
          type="button"
          onClick={() => onTabChange('files')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'files'
              ? 'text-slate-950 dark:text-white font-bold'
              : 'text-slate-600 dark:text-zinc-400 font-medium'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all flex items-center justify-center relative ${
              activeTab === 'files'
                ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-xs border border-white/95'
                : 'bg-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {examsCount > 0 && activeTab !== 'files' && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-sky-500 text-white text-[9px] font-bold tabular-nums flex items-center justify-center shadow-xs">
                {examsCount > 99 ? '99+' : examsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">{isTeacher ? 'School' : 'Exams'}</span>
        </button>

        {/* 3. Center Create Action */}
        <button
          type="button"
          onMouseEnter={prefetchCreateWizard}
          onTouchStart={prefetchCreateWizard}
          onClick={() => onTabChange('create')}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-0.5 px-1 rounded-2xl transition-all cursor-pointer active:scale-90 group"
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm relative ${
              activeTab === 'create'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 ring-2 ring-sky-400/50'
                : 'bg-white dark:bg-[#0f1d33] text-slate-900 dark:text-white border border-white/90 dark:border-white/15'
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span
            className={`text-[10px] tracking-tight ${
              activeTab === 'create'
                ? 'font-bold text-slate-950 dark:text-white'
                : 'font-medium text-slate-700 dark:text-zinc-300'
            }`}
          >
            Create
          </span>
        </button>

        {/* 4. Activity or Admin Hub */}
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onTabChange('admin-subs')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'admin-subs'
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-600 dark:text-zinc-400 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all flex items-center justify-center relative ${
                activeTab === 'admin-subs'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-xs border border-white/95'
                  : 'bg-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight">Admin</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onTabChange('results')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'results'
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-600 dark:text-zinc-400 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all flex items-center justify-center relative ${
                activeTab === 'results'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-xs border border-white/95'
                  : 'bg-transparent'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight">Activity</span>
          </button>
        )}

        {/* 5. Menu / Utilities Drawer */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
        >
          <div className="p-1.5 rounded-xl relative">
            <Menu className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
};

