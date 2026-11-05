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

  // Student Metrics (only used when student/admin)
  const totalQuestions = exams.reduce((acc, e) => acc + (e.questions?.length || 0), 0);
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
      className="space-y-6 sm:space-y-8 pb-20 max-w-5xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. ROLE-ADAPTIVE WORKSPACE BANNER
          Tailored to Teacher or Administrator.
          Eliminated "Active Practice Portal for Grade 12 Students" banner per user request.
      ───────────────────────────────────────────────────────────── */}
      {(isTeacher || isAdmin) && (
        <motion.div
          variants={itemVariants}
          className="rounded-[32px] sm:rounded-[36px] bg-white/70 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] overflow-hidden"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white text-xs font-bold border border-zinc-200 dark:border-white/10">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Administrator Workspace</span>
                    </>
                  ) : (
                    <>
                      <School className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Verified Teacher Studio</span>
                    </>
                  )}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">•</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{dateFormatted}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white tracking-tight leading-tight">
                {isAdmin
                  ? 'National Curriculum & Cloud Firestore Manager'
                  : `Welcome, Teacher ${user?.teacherName || user?.displayName || 'Educator'}`}
              </h1>

              {/* School affiliation badge for teachers */}
              {isTeacher && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-white">
                    <School className="w-3.5 h-3.5 text-black dark:text-white" />
                    <span>{user?.school || user?.schoolName || 'School Affiliated'}</span>
                  </span>
                  {user?.teachingSubject && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">
                        Subject: {user.teachingSubject}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black dark:text-white" />
                    <span>Admin Verified</span>
                  </span>
                </div>
              )}

              {/* Short & Brief Direction to use app for Verified Teacher */}
              {isTeacher ? (
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-black dark:text-white" />
                    <span>Quick Teacher Guide</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        <strong className="text-zinc-950 dark:text-white">Create Exam:</strong> Use smart paste or structured builder to draft MCQ tests with explanations.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        <strong className="text-zinc-950 dark:text-white">Push to Cloud:</strong> Publish your tests to Cloud Firestore for your students to access anytime.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        <strong className="text-zinc-950 dark:text-white">My School:</strong> Manage, edit, or export local storage drafts and published school tests.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Curate official university entrance examinations, review Ethiopian Birr subscriptions, and manage Cloud Firestore database records.
                </p>
              )}
            </div>

            {/* Quick Action Button Group */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('admin-subs')}
                    className="px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
                  >
                    <Award className="w-4 h-4 text-black dark:text-white" />
                    <span>Subscriptions & Teachers</span>
                  </button>
                  <button
                    type="button"
                    onMouseEnter={prefetchCreateWizard}
                    onTouchStart={prefetchCreateWizard}
                    onClick={() => onNavigate('create')}
                    className="px-5 py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4 text-white dark:text-zinc-950" />
                    <span>Curate Exam</span>
                  </button>
                </>
              ) : (
                <>
                  {/* My School Button */}
                  <button
                    id="teacher-my-school-btn"
                    type="button"
                    onClick={() => onNavigate('files')}
                    className="px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 active:scale-98"
                  >
                    <School className="w-4 h-4 text-black dark:text-white" />
                    <span>My School</span>
                  </button>
                  {/* Create Class Exam Button */}
                  <button
                    id="teacher-create-class-exam-btn"
                    type="button"
                    onMouseEnter={prefetchCreateWizard}
                    onTouchStart={prefetchCreateWizard}
                    onClick={() => onNavigate('create')}
                    className="px-5 py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-98"
                  >
                    <PlusCircle className="w-4 h-4 text-white dark:text-zinc-950" />
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
          {/* Export Toast Notification */}
          {exportNotice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4 text-white dark:text-zinc-950" />
              <span>{exportNotice}</span>
            </motion.div>
          )}

          {/* Teacher Metrics Bento */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/70 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Authored */}
              <div
                onClick={() => setTeacherExamFilter('all')}
                className={`p-5 sm:p-6 rounded-2xl transition cursor-pointer border ${
                  teacherExamFilter === 'all'
                    ? 'bg-zinc-100 dark:bg-[#0f1d33] border-zinc-400 dark:border-white/30'
                    : 'bg-zinc-50 dark:bg-[#0c182b] border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Created Exams
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-black dark:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <BookOpen className="w-4 h-4 text-black dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {teacherCreatedExams.length}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Authored by you</div>
              </div>

              {/* Pushed to Cloud */}
              <div
                onClick={() => setTeacherExamFilter('pushed')}
                className={`p-5 sm:p-6 rounded-2xl transition cursor-pointer border ${
                  teacherExamFilter === 'pushed'
                    ? 'bg-zinc-100 dark:bg-[#0f1d33] border-zinc-400 dark:border-white/30'
                    : 'bg-zinc-50 dark:bg-[#0c182b] border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Cloud Firestore
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-black dark:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <CloudUpload className="w-4 h-4 text-black dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {teacherPushedCount}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Pushed to database</div>
              </div>

              {/* Local Storage Drafts */}
              <div
                onClick={() => setTeacherExamFilter('local')}
                className={`p-5 sm:p-6 rounded-2xl transition cursor-pointer border ${
                  teacherExamFilter === 'local'
                    ? 'bg-zinc-100 dark:bg-[#0f1d33] border-zinc-400 dark:border-white/30'
                    : 'bg-zinc-50 dark:bg-[#0c182b] border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Local Storage
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-black dark:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <HardDrive className="w-4 h-4 text-black dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {teacherLocalCount}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Offline drafts</div>
              </div>

              {/* School Affiliation */}
              <div
                onClick={() => onNavigate('files')}
                className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    School
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-black dark:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <School className="w-4 h-4 text-black dark:text-white" />
                  </div>
                </div>
                <div className="text-base sm:text-lg font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white truncate">
                  {user?.school || user?.schoolName || 'Affiliated'}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Grade {user?.grade || '12'}</div>
              </div>
            </div>
          </motion.div>

          {/* SIMPLIFIED EXAMS DISPLAY FOR TEACHER: PUSHED TO CLOUD & LOCAL STORAGE */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/70 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] space-y-6"
          >
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-black dark:text-white" />
                  <h2 className="text-lg sm:text-xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                    My Created Class Exams
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Easily view, edit, practice, or push your exams to Cloud Firestore for your students.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center p-1 rounded-full bg-zinc-100 dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('all')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                    teacherExamFilter === 'all'
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  All Created ({teacherCreatedExams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('pushed')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1 ${
                    teacherExamFilter === 'pushed'
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <CloudUpload className="w-3 h-3 text-black dark:text-white" />
                  <span>Cloud ({teacherPushedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherExamFilter('local')}
                  className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1 ${
                    teacherExamFilter === 'local'
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <HardDrive className="w-3 h-3 text-black dark:text-white" />
                  <span>Local Drafts ({teacherLocalCount})</span>
                </button>
              </div>
            </div>

            {/* Exams List */}
            {filteredTeacherExams.length === 0 ? (
              <div className="text-center py-12 px-6 border border-dashed border-zinc-200 dark:border-white/10 rounded-3xl bg-zinc-50/50 dark:bg-[#0c182b]/50 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-[#0f1d33] border border-zinc-200 dark:border-white/10 mx-auto flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-black dark:text-white opacity-70" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif]">
                  {teacherExamFilter === 'pushed'
                    ? 'No exams pushed to Cloud Firestore yet'
                    : teacherExamFilter === 'local'
                    ? 'No local drafts found'
                    : 'You haven’t created any exams yet'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Click below to compose your first exam, test-run it in active practice mode, and sync it to the cloud.
                </p>
                <button
                  type="button"
                  onMouseEnter={prefetchCreateWizard}
                  onTouchStart={prefetchCreateWizard}
                  onClick={() => onNavigate('create')}
                  className="px-6 py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-xs transition active:scale-98"
                >
                  <PlusCircle className="w-4 h-4 text-white dark:text-zinc-950" />
                  <span>Create Class Exam</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTeacherExams.map((exam) => {
                  const isPushed = isExamPushedToCloud(exam);
                  const questionsCount = exam.questions?.length || 0;
                  return (
                    <div
                      key={exam.id}
                      className="p-5 rounded-2xl bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition flex flex-col justify-between space-y-4 shadow-2xs"
                    >
                      <div className="space-y-2">
                        {/* Status Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                              isPushed
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-[#0f1d33] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-white/10'
                            }`}
                          >
                            {isPushed ? (
                              <>
                                <CloudUpload className="w-3.5 h-3.5 text-black dark:text-white" />
                                <span>Pushed to Cloud Firestore</span>
                              </>
                            ) : (
                              <>
                                <HardDrive className="w-3.5 h-3.5 text-black dark:text-white" />
                                <span>Local Storage Draft</span>
                              </>
                            )}
                          </span>

                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            {questionsCount} Questions • {exam.timeLimit || 60}m
                          </span>
                        </div>

                        {/* Title & Metadata */}
                        <div>
                          <h3 className="font-bold text-base text-zinc-950 dark:text-white font-['Outfit',sans-serif] line-clamp-1">
                            {exam.name}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                            {exam.subject || 'General'} • Grade {exam.grade || '12'}
                            {exam.school ? ` • ${exam.school}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Action Button Bar with Black Icons */}
                      <div className="pt-3 border-t border-zinc-200/60 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {/* Push to Cloud Button */}
                          {onOpenDatabaseUpload && (
                            <button
                              type="button"
                              onClick={() => onOpenDatabaseUpload(exam)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                isPushed
                                  ? 'bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-[#132238] border border-zinc-200 dark:border-white/10'
                                  : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                              }`}
                              title={isPushed ? 'Update Cloud Firestore record' : 'Publish to Cloud Firestore'}
                            >
                              <CloudUpload className="w-3.5 h-3.5 text-black dark:text-white" />
                              <span>{isPushed ? 'Update Cloud' : 'Push to Cloud'}</span>
                            </button>
                          )}

                          {/* Test Run Practice Button */}
                          <button
                            type="button"
                            onMouseEnter={prefetchPracticeModal}
                            onTouchStart={prefetchPracticeModal}
                            onClick={() => onStartPractice(exam)}
                            className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                            title="Test-run this exam"
                          >
                            <Play className="w-3.5 h-3.5 text-black dark:text-white" />
                            <span>Test Run</span>
                          </button>
                        </div>

                        {/* Secondary Actions (Edit, Export, Delete) */}
                        <div className="flex items-center gap-1">
                          {onEditExam && (
                            <button
                              type="button"
                              onClick={() => onEditExam(exam)}
                              className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                              title="Edit exam questions"
                            >
                              <Edit className="w-4 h-4 text-black dark:text-white" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportExamAsTxt(exam)}
                            className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                            title="Export as plain text"
                          >
                            <FileDown className="w-4 h-4 text-black dark:text-white" />
                          </button>
                          {onDeleteExam && (
                            <button
                              type="button"
                              onClick={() => onDeleteExam(exam.id)}
                              className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/40 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 transition cursor-pointer"
                              title="Delete exam"
                            >
                              <Trash2 className="w-4 h-4 text-black dark:text-white" />
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
            STUDENT / ADMIN VIEW:
            Bridging the Gap, Student Bento Metrics, Results & Subscriptions
        ───────────────────────────────────────────────────────────── */
        <>
          {/* 2. WELCOME & 4 CORE POINTS OF SINAHARD */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/80 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="space-y-6">
              <div className="border-b border-zinc-100 dark:border-white/10 pb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <SinahardLogo size="xl" idSuffix="welcome-hero" className="shrink-0" />
                  <div className="space-y-2 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                      <span>Welcome to Sinahard Ethiopian Exam System</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold font-['Outfit',sans-serif] tracking-tight text-zinc-950 dark:text-white leading-tight">
                      Bridging the Gap from Reading to Active Practice
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
                      When you upload PDFs, read textbooks, or study notes, passive reading alone isn't enough to build lasting exam confidence. To truly retain knowledge, you require an active testing environment. <strong className="font-semibold text-zinc-950 dark:text-white">Sinahard</strong> provides timed tests, instant evaluation, peer sharing, and pre-prepared curriculum exams.
                    </p>

                    {/* Dual-Tier Exam Repository & Offline SQLite Download Center */}
                    <div className="pt-3">
                      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                Dual-Tier Repository
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
                                University &amp; Secondary
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
                                SQLite .db Bundles
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                              Offline Multi-Year Exam Download Center &amp; Supabase Storage
                            </h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
                              Download official university exams (Freshman Semester 1 &amp; 2, AAU, ASTU, Hawassa, Jimma) and secondary matriculation exams packaged into single-file offline SQLite databases with full technical diagrams, circuits, and markdown data tables.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {onOpenDownloadCenter && (
                              <button
                                type="button"
                                onClick={onOpenDownloadCenter}
                                className="px-4 py-2 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs hover:opacity-90 active:scale-98"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Center</span>
                              </button>
                            )}
                            {onOpenSupabaseConfig && (
                              <button
                                type="button"
                                onClick={onOpenSupabaseConfig}
                                className="px-3.5 py-2 rounded-full bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition cursor-pointer flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-[#132238] active:scale-98"
                                title="Configure Supabase Storage for diagrams and questions"
                              >
                                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Supabase</span>
                              </button>
                            )}
                            {isAdmin && onOpenAdminOfficialStudio && (
                              <button
                                type="button"
                                onClick={onOpenAdminOfficialStudio}
                                className="px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition cursor-pointer flex items-center gap-1.5 hover:bg-emerald-500/20 active:scale-98"
                                title="Admin: Author and publish official exams with diagrams to Supabase"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Official Studio</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible 4 Core Features */}
              <AnimatePresence initial={false} mode="wait">
                {!isFeaturesExpanded ? (
                  <motion.button
                    key="collapsed-features-bar"
                    type="button"
                    onClick={toggleFeatures}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition text-left cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        4 Core Capabilities:
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white">
                        <Play className="w-3 h-3 text-zinc-950 dark:text-white" /> Active Testing
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white">
                        <GraduationCap className="w-3 h-3 text-zinc-950 dark:text-white" /> Curated Catalog
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white">
                        <Download className="w-3 h-3 text-zinc-950 dark:text-white" /> Quick Bulk Import
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white">
                        <Share2 className="w-3 h-3 text-zinc-950 dark:text-white" /> Offline Sharing
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white group-hover:underline shrink-0">
                      <span>Show Details</span>
                      <ChevronDown className="w-4 h-4 text-zinc-950 dark:text-white" />
                    </div>
                  </motion.button>
                ) : (
                  <motion.div
                    key="expanded-features-grid"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Core Capabilities Architecture
                      </span>
                      <button
                        type="button"
                        onClick={toggleFeatures}
                        className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white font-bold cursor-pointer"
                      >
                        Hide Details
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Point 1 */}
                      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                            <Play className="w-5 h-5 text-zinc-950 dark:text-white" />
                          </div>
                          <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                            1. Active Testing
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Transition from reading PDF questions to interactive, timed practice simulating entrance exams.
                          </p>
                        </div>
                      </div>

                      {/* Point 2 */}
                      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                            <GraduationCap className="w-5 h-5 text-zinc-950 dark:text-white" />
                          </div>
                          <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                            2. Ethiopian Curriculum
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            National prep for Grade 12 (Natural & Social Science) and Freshman courses with math steps.
                          </p>
                        </div>
                      </div>

                      {/* Point 3 */}
                      <div
                        onClick={onOpenProfessorModal}
                        className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 flex flex-col justify-between space-y-3 cursor-pointer hover:border-zinc-400 dark:hover:border-white/30 transition group"
                      >
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Sparkles className="w-5 h-5 text-zinc-950 dark:text-white" />
                          </div>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                              3. AI Prompt Studio
                            </h4>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Launch →</span>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Generate holistic exam prompts or create questions directly in-app with Gemini AI and balanced random answers.
                          </p>
                        </div>
                      </div>

                      {/* Point 4 */}
                      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#0f1d33] border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                            <Share2 className="w-5 h-5 text-zinc-950 dark:text-white" />
                          </div>
                          <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                            4. Peer Sharing & Export
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Export complete tests in formatted plain .txt with one click so study groups can test offline.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 3. METRIC CARDS BENTO & DAILY STREAK SPOTLIGHT - STUDENT */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/80 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] space-y-6"
          >
            {/* Daily Streak & Practice Consistency Card */}
            <div
              onClick={onOpenNotificationsModal}
              className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-zinc-50 dark:from-amber-500/15 dark:via-[#0c182b] dark:to-[#0c182b] border border-amber-500/25 dark:border-amber-500/35 hover:border-amber-500/45 dark:hover:border-amber-500/55 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25 dark:border-amber-500/35 group-hover:scale-105 transition-transform shadow-xs">
                  <Flame className="w-7 h-7 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/90 dark:text-amber-400">
                      Daily Study Streak
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      🔥 {studyStreakDays} Day{studyStreakDays === 1 ? '' : 's'} Active
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white mt-0.5">
                    {completedToday >= dailyGoal
                      ? `Daily Goal Completed! (${completedToday}/${dailyGoal} Exams)`
                      : `${dailyGoal - completedToday} more exam${dailyGoal - completedToday === 1 ? '' : 's'} to hit today's target (${completedToday}/${dailyGoal})`}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Keep your daily streak alive. Tap to view consistency history, target goals & alerts.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {Math.min(100, Math.round((completedToday / Math.max(dailyGoal, 1)) * 100))}%
                  </span>
                  <span className="text-[10px] text-zinc-400">Today's Target</span>
                </div>
                <div className="px-4 py-2 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-xs group-hover:shadow-md transition">
                  <span>Daily Streak & Target</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Metric Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Modules */}
              <div
                onClick={() => onNavigate('files')}
                className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Total Modules
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <BookOpen className="w-4 h-4 text-zinc-950 dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {exams.length}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Curriculum sets</div>
              </div>

              {/* Question Bank */}
              <div
                onClick={() => onNavigate('files')}
                className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Question Bank
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <HelpCircle className="w-4 h-4 text-zinc-950 dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {totalQuestions}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">MCQ questions</div>
              </div>

              {/* Avg Score */}
              <div
                onClick={() => onNavigate('results')}
                className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Avg Mastery
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <TrendingUp className="w-4 h-4 text-zinc-950 dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {avgScore}%
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{passedCount} passed exams</div>
              </div>

              {/* Completed Sessions */}
              <div
                onClick={() => onNavigate('results')}
                className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Completed
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#0f1d33] text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shadow-xs">
                    <Award className="w-4 h-4 text-zinc-950 dark:text-white" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  {results.length}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Recorded sessions</div>
              </div>
            </div>
          </motion.div>

          {/* 4. RECENT PRACTICE HISTORY - STUDENT */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/80 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h3 className="font-['Outfit',sans-serif] font-bold text-base sm:text-lg text-zinc-950 dark:text-white">
                  Recent Practice History
                </h3>
                <span className="text-xs px-3 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-200/80 dark:border-white/10">
                  {results.length} sessions
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('results')}
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>View All</span>
                <ArrowRight className="w-4 h-4 text-zinc-950 dark:text-white" />
              </button>
            </div>

            <div>
              {recentResults.length === 0 ? (
                <div className="text-center py-10 px-6 border border-dashed border-zinc-200 dark:border-white/10 rounded-2xl bg-zinc-50/50 dark:bg-[#0c182b]/50">
                  <AlertCircle className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    No completed practice sessions yet
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Choose an exam from the repository or curated catalog to begin practicing.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-white/10">
                  {recentResults.map((r, index) => {
                    const isPassed = (r.percentage || 0) >= 70;
                    const diffMs = Date.now() - new Date(r.date).getTime();
                    const diffMin = Math.floor(diffMs / 60000);
                    const diffHr = Math.floor(diffMin / 60);
                    const diffDays = Math.floor(diffHr / 24);
                    const timeAgo = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : diffHr < 24 ? `${diffHr}h ago` : diffDays === 1 ? 'Yesterday' : diffDays < 7 ? `${diffDays}d ago` : new Date(r.date).toLocaleDateString();

                    return (
                      <div
                        key={index}
                        className="py-4 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-[#0c182b]/80 px-3 rounded-2xl transition"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs sm:text-sm text-zinc-950 dark:text-white truncate">
                            {r.examTitle}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{timeAgo}</span>
                            <span>•</span>
                            <span>{r.score}/{r.total} correct</span>
                            <span>•</span>
                            <span>{Math.floor((r.timeSpent || 0) / 60)}m {(r.timeSpent || 0) % 60}s</span>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            isPassed
                              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {r.percentage}% {isPassed ? 'PASS' : 'RETAKE'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* 5. ETHIOPIAN BIRR SUBSCRIPTION FOOTER BANNER - STUDENT ONLY */}
          <motion.div
            variants={itemVariants}
            className="rounded-[32px] sm:rounded-[36px] bg-white/80 dark:bg-[#070e1a]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-6 sm:p-8 shadow-[0_20px_50px_rgba(25,50,80,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.45)] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Crown className="w-6 h-6 text-white dark:text-zinc-950" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                    {isPremiumActive ? 'Sinahard Pro Active' : 'Sinahard Coin Plans (ETB)'}
                  </h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {isPremiumActive ? 'Pro Scholar' : 'From 29.9 ETB (4 Coins)'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {isPremiumActive
                    ? 'Unlimited full exams, LaTeX math explanations, and offline practice passes.'
                    : 'Get 4 to 16 practice coins from 29.9 ETB. Fully verified offline on your device!'}
                </p>
              </div>
            </div>

            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                className="px-6 py-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0 active:scale-98"
              >
                <Crown className="w-4 h-4 text-white dark:text-zinc-950" />
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
