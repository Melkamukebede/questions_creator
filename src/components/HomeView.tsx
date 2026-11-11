import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  HelpCircle,
  Award,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  Crown,
  Play,
  Clock,
  CheckCircle2,
  RotateCcw,
  Share2,
  FileText,
  Sparkles,
  Download,
  ChevronDown,
  School,
  UserCheck,
  ShieldCheck,
  PlusCircle,
  CloudUpload,
  Cloud,
  HardDrive,
  Edit,
  Trash2,
  FileDown,
  Layers,
  Flame,
  Database,
} from 'lucide-react';
import { Exam, ExamResult, UserSubscription, AppUser } from '../types';
import { PageTab } from './Navbar';
import { isUserSubscriptionActive, isUserTeacher } from '../services/db';
import { UserTierStatus } from '../services/subscriptionLimits';
import { SinahardLogo } from './SinahardLogo';
import { prefetchCreateWizard, prefetchPracticeModal } from '../services/prefetch';
import { useNotifications } from '../context/NotificationContext';
import {
  doesExamMatchStudentClass,
  isStudentClassLocked,
  formatClassLevelLabel,
} from '../utils/classLevelFilter';

export interface HomeViewProps {
  exams: Exam[];
  results: ExamResult[];
  onNavigate: (tab: PageTab) => void;
  onStartPractice: (exam: Exam) => void;
  onOpenPasteModal: () => void;
  onOpenProfessorModal: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenCuratedModal?: () => void;
  onOpenRegistrationModal?: () => void;
  onOpenNotificationsModal?: () => void;
  onOpenDatabaseUpload?: (exam: Exam) => void;
  onOpenDownloadCenter?: () => void;
  onOpenSupabaseConfig?: () => void;
  onOpenAdminOfficialStudio?: () => void;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (examId: string) => void;
  activeSubscription?: UserSubscription | null;
  userTier?: UserTierStatus;
  user?: AppUser | null;
  isAdmin?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export const HomeView: React.FC<HomeViewProps> = ({
  exams,
  results,
  onNavigate,
  onStartPractice,
  onOpenProfessorModal,
  onOpenSubscriptionModal,
  onOpenCuratedModal,
  onOpenRegistrationModal,
  onOpenNotificationsModal,
  onOpenDatabaseUpload,
  onOpenDownloadCenter,
  onOpenSupabaseConfig,
  onOpenAdminOfficialStudio,
  onEditExam,
  onDeleteExam,
  activeSubscription,
  userTier,
  user,
  isAdmin = false,
}) => {
  const isTeacher = Boolean(user && isUserTeacher(user));
  const isPremiumActive = isUserSubscriptionActive(activeSubscription || null);
  const { studyStreakDays, completedToday, dailyGoal } = useNotifications();
  const classLocked = isStudentClassLocked(user, isAdmin);

  const scopedExams = useMemo(() => {
    if (!classLocked) return exams;
    return exams.filter((e) => doesExamMatchStudentClass(e, user, isAdmin));
  }, [exams, classLocked, user, isAdmin]);

  // Student Metrics (scoped to registered class for students, all exams for Admin/Guest)
  const totalQuestions = scopedExams.reduce((acc, e) => acc + (e.questions?.length || 0), 0);
  const avgScore = results.length
    ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length)
    : 0;
  const passedCount = results.filter((r) => (r.percentage || 0) >= 70).length;
  const recentResults = results.slice(0, 4);

  // Teacher Filter for Created Exams (All | Pushed to Cloud | Local Storage)
  const [teacherExamFilter, setTeacherExamFilter] = useState<'all' | 'pushed' | 'local'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Helper to determine if an exam is pushed to cloud
  const isExamPushedToCloud = (e: Exam): boolean => {
    return Boolean(
      e.isUploadedToCloud ||
      e.cloudId ||
      e.isPushedToCloud ||
      e.metadata?.pushedToCloud ||
      e.cloudStorageEngine === 'firestore' ||
      e.sourceType === 'firestore'
    );
  };

  // Helper to determine if an exam was authored by teacher/user
  const isExamTeacherCreated = (e: Exam): boolean => {
    if (e.isDownloaded || e.sourceType === 'curated_catalog' || e.category === 'official') {
      return false;
    }
    return true;
  };

  // Teacher's created exams list
  const teacherCreatedExams = useMemo(() => {
    return exams.filter(isExamTeacherCreated);
  }, [exams]);

  const teacherPushedCount = useMemo(() => {
    return teacherCreatedExams.filter(isExamPushedToCloud).length;
  }, [teacherCreatedExams]);

  const teacherLocalCount = useMemo(() => {
    return teacherCreatedExams.filter((e) => !isExamPushedToCloud(e)).length;
  }, [teacherCreatedExams]);

  const filteredTeacherExams = useMemo(() => {
    if (teacherExamFilter === 'pushed') {
      return teacherCreatedExams.filter(isExamPushedToCloud);
    }
    if (teacherExamFilter === 'local') {
      return teacherCreatedExams.filter((e) => !isExamPushedToCloud(e));
    }
    return teacherCreatedExams;
  }, [teacherCreatedExams, teacherExamFilter]);

  // Handle plain text export for teacher
  const handleExportExamAsTxt = (exam: Exam) => {
    try {
      const lines: string[] = [];
      lines.push(`================================================================`);
      lines.push(`Exam: ${exam.name}`);
      lines.push(`Subject: ${exam.subject || 'General'}`);
      lines.push(`Grade: ${exam.grade || '12'}`);
      if (exam.school) lines.push(`School: ${exam.school}`);
      if (exam.teacherName) lines.push(`Teacher: ${exam.teacherName}`);
      lines.push(`Questions: ${exam.questions?.length || 0}`);
      lines.push(`Duration: ${exam.timeLimit || 60} minutes`);
      lines.push(`Generated by Sinahard Ethiopian Exam System`);
      lines.push(`================================================================\n`);

      exam.questions.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q.text}`);
        q.options.forEach((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          lines.push(`   ${letter}) ${opt}`);
        });
        const correctIndex = typeof q.correct === 'number' ? q.correct : 0;
        const correctLetter = String.fromCharCode(65 + correctIndex);
        lines.push(`   Answer: ${correctLetter}`);
        if (q.explanation && q.explanation.trim()) {
          lines.push(`   Explanation: ${q.explanation.trim()}`);
        }
        lines.push('');
      });

      const textData = lines.join('\n');
      const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeFilename = (exam.name || 'exam')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      link.download = `${safeFilename}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportNotice(`Exported "${exam.name}" as .txt`);
      setTimeout(() => setExportNotice(null), 3000);
    } catch {
      setExportNotice('Failed to export text file');
      setTimeout(() => setExportNotice(null), 3000);
    }
  };

  // Features expanded/collapsed toggle state for students
  const [isFeaturesExpanded, setIsFeaturesExpanded] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sinahard_welcome_features_expanded');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const toggleFeatures = () => {
    setIsFeaturesExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sinahard_welcome_features_expanded', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const now = new Date();
  const dayName = now.toLocaleDateString(undefined, { weekday: 'short' });
  const monthName = now.toLocaleDateString(undefined, { month: 'short' });
  const dayNumber = now.getDate();
  const dateFormatted = `${dayName}, ${monthName} ${dayNumber}`;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5 sm:space-y-6 pb-20 max-w-5xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. ROLE-ADAPTIVE WORKSPACE BANNER (TEACHER OR ADMIN)
      ───────────────────────────────────────────────────────────── */}
      {(isTeacher || isAdmin) && (
        <motion.div
          variants={itemVariants}
          className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-7 overflow-hidden"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-zinc-400 font-medium">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Administrator Workspace</span>
                    </>
                  ) : (
                    <>
                      <School className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified Teacher Studio</span>
                    </>
                  )}
                </span>
                <span>·</span>
                <span>{dateFormatted}</span>
                {isTeacher && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      {user?.school || user?.schoolName || 'School Affiliated'}
                    </span>
                    {user?.teachingSubject && (
                      <>
                        <span>·</span>
                        <span>{user.teachingSubject}</span>
                      </>
                    )}
                  </>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white tracking-tight leading-snug">
                {isAdmin
                  ? 'National Curriculum & Exam Library Manager'
                  : `Welcome, Teacher ${user?.teacherName || user?.displayName || 'Educator'}`}
              </h1>

              {isTeacher ? (
                <div className="p-3.5 rounded-2xl liquid-glass-subtle grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed mt-1">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong className="text-slate-950 dark:text-white">Create:</strong> Draft MCQ exams with KaTeX math and step-by-step solutions.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong className="text-slate-950 dark:text-white">Publish:</strong> Share exams online for student access.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong className="text-slate-950 dark:text-white">Manage:</strong> Edit or export saved exams in My School.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Curate official university and secondary examinations, verify Ethiopian Birr subscriptions, and manage shared exam records.
                </p>
              )}
            </div>

            {/* Quick Action Button Group */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('admin-subs')}
                    className="px-4 py-2 rounded-full liquid-glass-subtle hover:bg-white dark:hover:bg-[#132238] text-slate-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Subscriptions & Teachers</span>
                  </button>
                  <button
                    type="button"
                    onMouseEnter={prefetchCreateWizard}
                    onTouchStart={prefetchCreateWizard}
                    onClick={() => onNavigate('create')}
                    className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-98 whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Curate Exam</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="teacher-my-school-btn"
                    type="button"
                    onClick={() => onNavigate('files')}
                    className="px-4 py-2 rounded-full liquid-glass-subtle hover:bg-white dark:hover:bg-[#132238] text-slate-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 active:scale-98 whitespace-nowrap shrink-0"
                  >
                    <School className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>My School</span>
                  </button>
                  <button
                    id="teacher-create-class-exam-btn"
                    type="button"
                    onMouseEnter={prefetchCreateWizard}
                    onTouchStart={prefetchCreateWizard}
                    onClick={() => onNavigate('create')}
                    className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-98 whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create Class Exam</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TEACHER-SPECIFIC DASHBOARD
      ───────────────────────────────────────────────────────────── */}
      {isTeacher ? (
        <>
          {exportNotice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-2xl liquid-glass-subtle text-slate-900 dark:text-white text-xs font-bold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{exportNotice}</span>
            </motion.div>
          )}

          {/* Teacher Metrics Strip */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-6"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div
                onClick={() => setTeacherExamFilter('all')}
                className={`p-4 rounded-2xl transition cursor-pointer liquid-glass-subtle ${
                  teacherExamFilter === 'all'
                    ? 'ring-2 ring-sky-500/40 dark:ring-sky-400/40'
                    : 'hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Created Exams
                  </span>
                  <BookOpen className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {teacherCreatedExams.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Authored by you</div>
              </div>

              <div
                onClick={() => setTeacherExamFilter('pushed')}
                className={`p-4 rounded-2xl transition cursor-pointer liquid-glass-subtle ${
                  teacherExamFilter === 'pushed'
                    ? 'ring-2 ring-sky-500/40 dark:ring-sky-400/40'
                    : 'hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Published Online
                  </span>
                  <CloudUpload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {teacherPushedCount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Shared with students</div>
              </div>

              <div
                onClick={() => setTeacherExamFilter('local')}
                className={`p-4 rounded-2xl transition cursor-pointer liquid-glass-subtle ${
                  teacherExamFilter === 'local'
                    ? 'ring-2 ring-sky-500/40 dark:ring-sky-400/40'
                    : 'hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Saved on Device
                  </span>
                  <HardDrive className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {teacherLocalCount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Private drafts</div>
              </div>

              <div
                onClick={() => onNavigate('files')}
                className="p-4 rounded-2xl liquid-glass-subtle hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    School
                  </span>
                  <School className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white truncate">
                  {user?.school || user?.schoolName || 'Affiliated'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Grade {user?.grade || '12'}</div>
              </div>
            </div>
          </motion.div>

          {/* Teacher Created Exams List */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-7 space-y-5"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-white/10">
              <div>
                <h2 className="text-lg font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                  My Created Class Exams
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  View, edit, test-run, or publish your exams online for students.
                </p>
              </div>

              <div className="flex items-center p-1 rounded-full bg-slate-200/50 dark:bg-[#0c182b] border border-white/80 dark:border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('all')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer whitespace-nowrap ${
                    teacherExamFilter === 'all'
                      ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({teacherCreatedExams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('pushed')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer whitespace-nowrap ${
                    teacherExamFilter === 'pushed'
                      ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Published ({teacherPushedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('local')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer whitespace-nowrap ${
                    teacherExamFilter === 'local'
                      ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  On Device ({teacherLocalCount})
                </button>
              </div>
            </div>

            {filteredTeacherExams.length === 0 ? (
              <div className="text-center py-10 px-6 rounded-2xl liquid-glass-subtle space-y-3">
                <BookOpen className="w-7 h-7 text-slate-400 dark:text-zinc-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-['Outfit',sans-serif]">
                  {teacherExamFilter === 'pushed'
                    ? 'No exams published online yet'
                    : teacherExamFilter === 'local'
                    ? 'No saved drafts found on device'
                    : 'You haven’t created any exams yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Compose your first exam, test-run it in active practice mode, and publish it for your students.
                </p>
                <button
                  type="button"
                  onMouseEnter={prefetchCreateWizard}
                  onTouchStart={prefetchCreateWizard}
                  onClick={() => onNavigate('create')}
                  className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-xs transition active:scale-98"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Class Exam</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredTeacherExams.map((exam) => {
                  const isPushed = isExamPushedToCloud(exam);
                  const questionsCount = exam.questions?.length || 0;
                  return (
                    <div
                      key={exam.id}
                      className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle flex flex-col justify-between space-y-3.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-medium tabular-nums">
                          <span className={isPushed ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'font-semibold'}>
                            {isPushed ? 'Published Online' : 'Saved on Device'}
                          </span>
                          <span>
                            {questionsCount} Qs · {exam.timeLimit || 60}m
                          </span>
                        </div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-950 dark:text-white font-['Outfit',sans-serif] line-clamp-1">
                          {exam.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                          {exam.subject || 'General'} · Grade {exam.grade || '12'}
                          {exam.school ? ` · ${exam.school}` : ''}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {onOpenDatabaseUpload && (
                            <button
                              type="button"
                              onClick={() => onOpenDatabaseUpload(exam)}
                              className="px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                            >
                              <CloudUpload className="w-3.5 h-3.5" />
                              <span>{isPushed ? 'Update Online' : 'Publish Online'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onMouseEnter={prefetchPracticeModal}
                            onTouchStart={prefetchPracticeModal}
                            onClick={() => onStartPractice(exam)}
                            className="px-3 py-1.5 rounded-full bg-white dark:bg-[#0c182b] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Test Run</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {onEditExam && (
                            <button
                              type="button"
                              onClick={() => onEditExam(exam)}
                              className="p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                              title="Edit exam questions"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportExamAsTxt(exam)}
                            className="p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                            title="Export as plain text"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          {onDeleteExam && (
                            <button
                              type="button"
                              onClick={() => onDeleteExam(exam.id)}
                              className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-700 dark:text-zinc-300 hover:text-rose-600 transition cursor-pointer"
                              title="Delete exam"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            STUDENT / GENERAL WORKSPACE:
            Streamlined 3-Layer Fluid Glass Workspace (Uncrowded & Fast)
        ───────────────────────────────────────────────────────────── */
        <>
          {/* 1. STREAMLINED WORKSPACE HEADER & QUICK ACTIONS */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-7 overflow-hidden space-y-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <SinahardLogo size="lg" idSuffix="welcome-hero" className="shrink-0 mt-0.5" />
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    <span className="text-sky-700 dark:text-sky-300 font-bold">
                      {classLocked ? formatClassLevelLabel(user?.grade) : 'Dual-Tier Repository'}
                    </span>
                    <span>·</span>
                    <span>{classLocked ? 'Registered Class Workspace' : 'University & Secondary'}</span>
                    <span>·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      100% Offline Ready
                    </span>
                    {classLocked && onOpenRegistrationModal && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={onOpenRegistrationModal}
                          className="text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer"
                        >
                          Change Class
                        </button>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold font-['Outfit',sans-serif] tracking-tight text-slate-950 dark:text-white leading-snug">
                    Bridging the Gap from Reading to Active Practice
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {classLocked
                      ? `Practice curated exams for ${formatClassLevelLabel(user?.grade)} with rendered KaTeX formulas, diagrams, and step-by-step explanations.`
                      : 'Practice official university Freshman & Senior archives (AAU, ASTU, Hawassa, Jimma) and secondary matriculation exams with rendered KaTeX formulas, diagrams, and zero internet requirement.'}
                  </p>
                </div>
              </div>

              {/* Primary Quick-Start Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('files')}
                  className="px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs hover:opacity-95 active:scale-98 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Explore Exams</span>
                </button>

                {(onOpenDownloadCenter || onOpenCuratedModal) && (
                  <button
                    type="button"
                    onClick={onOpenDownloadCenter || onOpenCuratedModal}
                    className="px-4 py-2.5 rounded-full liquid-glass-btn text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Download Exams</span>
                  </button>
                )}

                <button
                  type="button"
                  onMouseEnter={prefetchCreateWizard}
                  onTouchStart={prefetchCreateWizard}
                  onClick={() => onNavigate('create')}
                  className="px-4 py-2.5 rounded-full liquid-glass-btn text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Create Exam</span>
                </button>

                {isAdmin && onOpenSupabaseConfig && (
                  <button
                    type="button"
                    onClick={onOpenSupabaseConfig}
                    className="px-3.5 py-2 rounded-full liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer flex items-center gap-1.5 hover:bg-white dark:hover:bg-[#132238] whitespace-nowrap shrink-0"
                    title="Admin: Configure Supabase Cloud Storage"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Supabase Cloud</span>
                  </button>
                )}

                {isAdmin && onOpenAdminOfficialStudio && (
                  <button
                    type="button"
                    onClick={onOpenAdminOfficialStudio}
                    className="px-3.5 py-2 rounded-full liquid-glass-subtle text-xs font-bold text-emerald-700 dark:text-emerald-300 transition cursor-pointer flex items-center gap-1.5 hover:bg-white dark:hover:bg-[#132238] whitespace-nowrap shrink-0"
                    title="Admin: Author and publish official exams"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Official Studio</span>
                  </button>
                )}
              </div>
            </div>

            {/* Compact Collapsible Core Capabilities Bar */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap text-slate-600 dark:text-zinc-400">
                  <span className="font-bold text-slate-800 dark:text-zinc-200">Core Capabilities:</span>
                  <span>Active Timed Testing</span>
                  <span>·</span>
                  <span>Curated Curriculum</span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={onOpenProfessorModal}
                    className="font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
                  >
                    AI Prompt Studio
                  </button>
                  <span>·</span>
                  <span>Offline .txt Sharing</span>
                </div>
                <button
                  type="button"
                  onClick={toggleFeatures}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <span>{isFeaturesExpanded ? 'Hide Overview' : 'Platform Overview'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isFeaturesExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isFeaturesExpanded && (
                  <motion.div
                    key="expanded-features-grid"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                      <div className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                          <Play className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>1. Active Testing</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                          Transition from static PDFs to interactive, timed practice simulating real entrance exams.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                          <GraduationCap className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>2. Ethiopian Curriculum</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                          National prep for Grades 7–12 and University Freshman &amp; Senior courses with step-by-step math.
                        </p>
                      </div>

                      <div
                        onClick={onOpenProfessorModal}
                        className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5 cursor-pointer hover:border-sky-400/60 transition group"
                      >
                        <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold text-xs">
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>3. AI Prompt Studio</span>
                          </span>
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                            Open →
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                          Generate structured exam prompts or create questions directly in-app with balanced options.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                          <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>4. Peer Sharing</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                          Export and share complete tests in formatted plain .txt so study groups can practice offline.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 2. COMPACT STATS STRIP & DAILY STUDY STREAK */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-6 space-y-4"
          >
            {/* Compact Daily Study Streak Bar */}
            <div
              onClick={onOpenNotificationsModal}
              className="p-3.5 sm:px-5 sm:py-3.5 rounded-2xl liquid-glass-subtle hover:border-amber-400/50 dark:hover:border-amber-400/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <Flame className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-slate-950 dark:text-white font-['Outfit',sans-serif]">
                      {completedToday >= dailyGoal
                        ? `Daily Target Reached (${completedToday}/${dailyGoal} Exams)`
                        : `Daily Study Target: ${completedToday}/${dailyGoal} Completed`}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                      {studyStreakDays} Day{studyStreakDays === 1 ? '' : 's'} Streak
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Tap to configure daily practice goals, study reminders, and consistency alerts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-zinc-300">
                  {Math.min(100, Math.round((completedToday / Math.max(dailyGoal, 1)) * 100))}%
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#0c182b] text-slate-900 dark:text-white text-xs font-bold flex items-center gap-1.5 border border-slate-200/80 dark:border-white/10 shadow-2xs whitespace-nowrap">
                  <span>Streak &amp; Goal</span>
                  <ArrowRight className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                </span>
              </div>
            </div>

            {/* 4-Metric KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div
                onClick={() => onNavigate('files')}
                className="p-4 rounded-2xl liquid-glass-subtle hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Total Modules
                  </span>
                  <BookOpen className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {scopedExams.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {classLocked ? formatClassLevelLabel(user?.grade) : 'Curriculum sets'}
                </div>
              </div>

              <div
                onClick={() => onNavigate('files')}
                className="p-4 rounded-2xl liquid-glass-subtle hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Question Bank
                  </span>
                  <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {totalQuestions}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">MCQ questions</div>
              </div>

              <div
                onClick={() => onNavigate('results')}
                className="p-4 rounded-2xl liquid-glass-subtle hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Avg Mastery
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {avgScore}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  {passedCount} passed exams
                </div>
              </div>

              <div
                onClick={() => onNavigate('results')}
                className="p-4 rounded-2xl liquid-glass-subtle hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    Completed
                  </span>
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                  {results.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Recorded sessions</div>
              </div>
            </div>
          </motion.div>

          {/* 3. RECENT PRACTICE SESSIONS */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="font-['Outfit',sans-serif] font-bold text-base sm:text-lg text-slate-950 dark:text-white">
                  Recent Practice Sessions
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold tabular-nums">
                  · {results.length} total
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('results')}
                className="text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentResults.length === 0 ? (
              <div className="text-center py-8 px-6 rounded-2xl liquid-glass-subtle">
                <AlertCircle className="w-7 h-7 text-slate-400 dark:text-zinc-500 mx-auto mb-2 opacity-70" />
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  No completed practice sessions yet
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Select an exam from the repository to begin timed practice and track your mastery.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                {recentResults.map((r, index) => {
                  const isPassed = (r.percentage || 0) >= 70;
                  const diffMs = Date.now() - new Date(r.date).getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  const diffHr = Math.floor(diffMin / 60);
                  const diffDays = Math.floor(diffHr / 24);
                  const timeAgo =
                    diffMin < 1
                      ? 'Just now'
                      : diffMin < 60
                      ? `${diffMin}m ago`
                      : diffHr < 24
                      ? `${diffHr}h ago`
                      : diffDays === 1
                      ? 'Yesterday'
                      : diffDays < 7
                      ? `${diffDays}d ago`
                      : new Date(r.date).toLocaleDateString();

                  return (
                    <div
                      key={index}
                      onClick={() => onNavigate('results')}
                      className="py-3.5 flex items-center justify-between gap-4 hover:bg-white/50 dark:hover:bg-white/[0.03] px-3 rounded-xl transition cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-950 dark:text-white truncate">
                          {r.examTitle}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{timeAgo}</span>
                          <span>·</span>
                          <span>
                            {r.score}/{r.total} correct
                          </span>
                          <span>·</span>
                          <span>
                            {Math.floor((r.timeSpent || 0) / 60)}m {(r.timeSpent || 0) % 60}s
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums px-3 py-1 rounded-full shrink-0 ${
                          isPassed
                            ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.percentage}% {isPassed ? 'PASS' : 'REVIEW'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* 4. STREAMLINED SINAHARD COIN PLANS BAR */}
          <motion.div
            variants={itemVariants}
            className="rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl liquid-glass-subtle flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <h3 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                    {isPremiumActive ? 'Sinahard Pro Active' : 'Sinahard Coin Plans (ETB)'}
                  </h3>
                  <span className="text-slate-400">·</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    {isPremiumActive ? 'Pro Scholar' : 'From 29.9 ETB (4 Coins)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {isPremiumActive
                    ? 'Unlimited full exams, LaTeX math explanations, and offline practice passes.'
                    : 'Get 4 to 16 practice coins from 29.9 ETB, verified offline on your device.'}
                </p>
              </div>
            </div>

            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                className="px-5 py-2.5 rounded-full liquid-glass-btn font-bold text-xs flex items-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Crown className="w-4 h-4 text-amber-500" />
                <span>{isPremiumActive ? 'Plan Status' : 'Upgrade in ETB'}</span>
              </button>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default HomeView;

