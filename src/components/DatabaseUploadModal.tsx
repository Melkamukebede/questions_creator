import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Sparkles,
  Lock,
  GraduationCap,
  Calendar,
  LogIn,
  Clock,
  Compass,
  Database,
  Code2,
  Check,
  SlidersHorizontal,
  Copy,
  School,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { Exam, AppUser, ExamCategory } from '../types';
import {
  uploadExamToFirestore,
  canUserUploadToFirestore,
  inferGrade,
  inferStream,
} from '../services/databaseUpload';
import { ADMIN_EMAIL, isUserAdmin, isUserTeacher } from '../services/db';
import { useAuth } from '../context/AuthContext';

export interface DatabaseUploadModalProps {
  exam: Exam | null;
  user: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (exam: Exam, engine: 'firestore') => void;
  onOpenRegistrationModal?: () => void;
}

const ACADEMIC_GRADE_OPTIONS = [
  { id: '12', label: 'Grade 12' },
  { id: '11', label: 'Grade 11' },
  { id: '10', label: 'Grade 10' },
  { id: '9', label: 'Grade 9' },
  { id: 'Freshman', label: 'University Freshman' },
  { id: 'Senior University', label: 'University Senior' },
  { id: '8', label: 'Grade 8' },
  { id: '7', label: 'Grade 7' },
  { id: 'All', label: 'All Grades' },
];

const STREAM_OPTIONS = [
  { id: 'Natural Science', label: 'Natural Science' },
  { id: 'Social Science', label: 'Social Science' },
  { id: 'General', label: 'General' },
  { id: 'Higher Education', label: 'Higher Education' },
  { id: 'All', label: 'All Streams' },
];

const TIME_PRESETS = [15, 20, 30, 45, 60, 90];

export const DatabaseUploadModal: React.FC<DatabaseUploadModalProps> = ({
  exam,
  user,
  isOpen,
  onClose,
  onUploadComplete,
  onOpenRegistrationModal,
}) => {
  const { signInWithGoogle, isSigningIn, popupBlocked } = useAuth();

  const [activeTab, setActiveTab] = useState<'configure' | 'payload'>('configure');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Category: 'official' vs 'created'
  const [uploadCategory, setUploadCategory] = useState<ExamCategory>('official');
  const [schoolName, setSchoolName] = useState<string>('Bole Secondary School');
  const [teacherName, setTeacherName] = useState<string>('Instructor');

  // Form states
  const [selectedGrade, setSelectedGrade] = useState<string>('12');
  const [selectedStream, setSelectedStream] = useState<string>('Natural Science');
  const [topic, setTopic] = useState<string>('');
  const [timeLimit, setTimeLimit] = useState<number>(20);
  const [targetExamYear, setTargetExamYear] = useState<string>('2026 (2018 E.C.)');

  // Status & loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressStatusText, setProgressStatusText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!exam) return;

    const detectedGrade = exam.grade ? String(exam.grade) : inferGrade(`${exam.name} ${exam.title || ''}`);
    const isKnownGrade = ACADEMIC_GRADE_OPTIONS.some((g) => g.id === detectedGrade);
    setSelectedGrade(isKnownGrade ? detectedGrade : '12');

    const inferred = inferStream(exam.subject, `${exam.name} ${exam.title || ''}`, detectedGrade);
    setSelectedStream((exam as any).stream || inferred);

    const existingTopic = exam.topic || exam.metadata?.topic || '';
    if (existingTopic) {
      setTopic(existingTopic);
    } else if (exam.name.includes(':')) {
      setTopic(exam.name.split(':')[1].trim());
    } else {
      setTopic('');
    }

    setTimeLimit(exam.timeLimit || 20);
    setTargetExamYear((exam as any).targetExamYear || exam.metadata?.targetExamYear || '2026 (2018 E.C.)');

    if (isUserTeacher(user) && !isUserAdmin(user)) {
      setUploadCategory('created');
    } else if (exam.category) {
      setUploadCategory(exam.category);
    } else {
      setUploadCategory('official');
    }

    setSchoolName(user?.school || user?.schoolName || (exam as any).school || 'Bole Secondary School');
    setTeacherName(user?.teacherName || user?.displayName || (exam as any).teacherName || 'Instructor');

    setStatusMessage(null);
    setErrorMessage(null);
    setUploadProgress(0);
    setActiveTab('configure');
  }, [exam, isOpen, user]);

  const handleGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    if (newGrade === 'Freshman') {
      setSelectedStream('Higher Education');
    } else if (newGrade === '9' || newGrade === '10') {
      setSelectedStream('General');
    } else if (newGrade === '11' || newGrade === '12') {
      if (selectedStream === 'General' || selectedStream === 'Higher Education') {
        setSelectedStream('Natural Science');
      }
    }
  };

  const diagnostics = useMemo(() => {
    if (!exam || !exam.questions) {
      return { total: 0, hasMath: false, mathCount: 0, withExplanation: 0, withImages: 0, isValid: false };
    }
    const total = exam.questions.length;
    let mathCount = 0;
    let withExplanation = 0;
    let withImages = 0;
    exam.questions.forEach((q) => {
      const text = `${q.text || (q as any).question || ''} ${q.options?.join(' ') || ''}`;
      if (text.includes('$') || text.includes('\\') || text.includes('^') || text.includes('_')) {
        mathCount++;
      }
      if (q.explanation && q.explanation.trim().length > 5) {
        withExplanation++;
      }
      if (q.imageUrl || (Array.isArray(q.optionImages) && q.optionImages.some(Boolean))) {
        withImages++;
      }
    });
    return {
      total,
      hasMath: mathCount > 0,
      mathCount,
      withExplanation,
      withImages,
      isValid: total > 0,
    };
  }, [exam]);

  const previewPayload = useMemo(() => {
    if (!exam) return null;
    const isTeacherExam = uploadCategory === 'created';
    return {
      id: exam.id,
      name: exam.name,
      title: exam.name,
      subject: exam.subject,
      grade: selectedGrade,
      stream: selectedStream,
      topic: topic.trim() || undefined,
      category: uploadCategory,
      createdType: isTeacherExam ? 'teacher' : undefined,
      school: isTeacherExam ? schoolName.trim() : undefined,
      teacherName: isTeacherExam ? teacherName.trim() : undefined,
      examYear: !isTeacherExam ? targetExamYear.trim() : undefined,
      timeLimit,
      totalQuestions: exam.questions?.length || 0,
      questionsWithImages: diagnostics.withImages,
      isPublic: true,
    };
  }, [exam, uploadCategory, schoolName, teacherName, selectedGrade, selectedStream, topic, timeLimit, targetExamYear, diagnostics.withImages]);

  if (!isOpen || !exam) return null;

  const userIsAdmin = isUserAdmin(user);
  const userIsTeacher = isUserTeacher(user);
  const canUpload = canUserUploadToFirestore(user);

  const handleCopyPayload = () => {
    if (!previewPayload) return;
    navigator.clipboard.writeText(JSON.stringify(previewPayload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1500);
  };

  const handleUploadToFirestore = async () => {
    if (!canUpload) {
      setErrorMessage(
        `Cloud upload is reserved for Teachers and Admins (${ADMIN_EMAIL}). Student practice stays local.`
      );
      return;
    }

    if (uploadCategory === 'official' && !userIsAdmin) {
      setErrorMessage("Only Administrators can publish to Official National Exams. Please select 'School Exam'.");
      return;
    }

    if (uploadCategory === 'created' && !schoolName.trim()) {
      setErrorMessage('Please enter your school name.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setUploadProgress(15);
    setProgressStatusText('Connecting to Cloud Question & Media Bank...');

    try {
      const isOfficial = uploadCategory === 'official';
      const result = await uploadExamToFirestore(exam, user, {
        category: uploadCategory,
        createdType: isOfficial ? undefined : 'teacher',
        school: isOfficial ? undefined : schoolName.trim(),
        teacherName: isOfficial ? undefined : teacherName.trim(),
        examYear: isOfficial ? targetExamYear.trim() : undefined,
        uploadIndividualQuestions: true,
        isPublic: true,
        asOfficialExam: isOfficial,
        grade: selectedGrade,
        topic: topic.trim() || undefined,
        stream: selectedStream,
        adminTag: isOfficial ? `Grade ${selectedGrade} Exam` : undefined,
        curator: isOfficial ? 'Ministry of Education' : undefined,
        timeLimit,
        targetExamYear,
        onProgress: (percent, text) => {
          setUploadProgress(percent);
          setProgressStatusText(text);
        },
      });

      setStatusMessage(result.message);
      if (onUploadComplete) {
        onUploadComplete(
          {
            ...exam,
            category: uploadCategory,
            createdType: isOfficial ? undefined : 'teacher',
            school: isOfficial ? undefined : schoolName.trim(),
            teacherName: isOfficial ? undefined : teacherName.trim(),
            examYear: isOfficial ? targetExamYear.trim() : undefined,
            isUploadedToCloud: true,
            cloudStorageEngine: 'firestore',
            cloudUploadedAt: new Date().toISOString(),
            grade: selectedGrade,
            topic: topic.trim() || undefined,
            stream: selectedStream,
          },
          'firestore'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload exam to Cloud Database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/65 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl liquid-glass border border-white/70 dark:border-white/15 rounded-[28px] shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/60 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl liquid-glass-subtle text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-white font-['Outfit',sans-serif]">
                    Upload Questions &amp; Exam to Cloud
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                    {userIsAdmin ? 'Admin' : userIsTeacher ? 'Teacher' : 'Cloud'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Syncs exam package, individual questions, and diagram images to Firestore &amp; linked Supabase.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full liquid-glass-btn text-zinc-500 hover:text-black dark:hover:text-white transition cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-header View Switcher */}
          <div className="px-6 py-2.5 flex items-center justify-between border-b border-white/60 dark:border-white/10 bg-white/30 dark:bg-black/20 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('configure')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer text-xs ${
                  activeTab === 'configure'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-inherit" />
                <span>Exam Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('payload')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer text-xs ${
                  activeTab === 'payload'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-inherit" />
                <span>JSON Payload</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Sync: <span className="font-mono text-zinc-800 dark:text-zinc-200">/exams + /questions + Supabase</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Student Permission Banner */}
            {!canUpload && (
              <div className="p-3.5 rounded-2xl liquid-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-4 h-4 text-black dark:text-white shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Cloud upload requires a <strong>Teacher</strong> or <strong>Admin</strong> profile.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onOpenRegistrationModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRegistrationModal();
                      }}
                      className="px-3 py-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                    >
                      Switch Role
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    disabled={isSigningIn}
                    className="px-3.5 py-1.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs cursor-pointer hover:bg-black dark:hover:bg-zinc-100 transition"
                  >
                    {isSigningIn ? 'Connecting...' : 'Sign In'}
                  </button>
                </div>
              </div>
            )}

            {/* Exam Quick Summary Badge */}
            <div className="p-4 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {exam.subject}
                </div>
                <div className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                  {exam.name}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                  {diagnostics.total} Questions
                </span>
                {diagnostics.withImages > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                    {diagnostics.withImages} Figures
                  </span>
                )}
                {diagnostics.hasMath && (
                  <span className="px-2.5 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
                    Math/LaTeX
                  </span>
                )}
              </div>
            </div>

            {/* View 1: Configure */}
            {activeTab === 'configure' && (
              <div className="space-y-4">
                {/* Category: 2 compact pills */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Target Category
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => userIsAdmin && setUploadCategory('official')}
                      disabled={!userIsAdmin}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        uploadCategory === 'official'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400'
                      } ${!userIsAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-inherit" />
                        <div>
                          <div className="text-xs font-bold">Official Curriculum</div>
                          <div className={`text-[10px] ${uploadCategory === 'official' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            National catalog
                          </div>
                        </div>
                      </div>
                      {uploadCategory === 'official' && (
                        <Check className="w-4 h-4 text-inherit shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadCategory('created')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        uploadCategory === 'created'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4 text-inherit" />
                        <div>
                          <div className="text-xs font-bold">School Exam</div>
                          <div className={`text-[10px] ${uploadCategory === 'created' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            School teacher test
                          </div>
                        </div>
                      </div>
                      {uploadCategory === 'created' && (
                        <Check className="w-4 h-4 text-inherit shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* School Name & Teacher Name (if school exam) */}
                {uploadCategory === 'created' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5 text-black dark:text-white" />
                        <span>School Name *</span>
                      </label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="e.g. Bole Secondary School"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-black dark:text-white" />
                        <span>Teacher Name</span>
                      </label>
                      <input
                        type="text"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="e.g. Mr. Kebede"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Grade & Stream */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Grade Level</span>
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => handleGradeChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 transition cursor-pointer"
                    >
                      {ACADEMIC_GRADE_OPTIONS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Stream Focus</span>
                    </label>
                    <select
                      value={selectedStream}
                      onChange={(e) => setSelectedStream(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 transition cursor-pointer"
                    >
                      {STREAM_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time Limit & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Time Limit</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {TIME_PRESETS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTimeLimit(t)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            timeLimit === t
                              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          {t}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Exam Session Year</span>
                    </label>
                    <input
                      type="text"
                      value={targetExamYear}
                      onChange={(e) => setTargetExamYear(e.target.value)}
                      placeholder="e.g. 2026 (2018 E.C.)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Payload Preview */}
            {activeTab === 'payload' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-black dark:text-white" />
                    <span>Firestore Document Data</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-black dark:text-white" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 border border-zinc-800 leading-relaxed">
                  <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Progress */}
            {isLoading && (
              <div className="space-y-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-black dark:text-white" />
                    {progressStatusText || 'Uploading to Cloud Firestore...'}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {statusMessage && (
              <div className="p-3.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs flex items-center gap-2.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{statusMessage}</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
                    Exam ID: {exam.id}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              {statusMessage ? 'Close' : 'Cancel'}
            </button>

            {canUpload ? (
              <button
                type="button"
                disabled={isLoading}
                onClick={handleUploadToFirestore}
                className="px-6 py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition active:scale-98 hover:opacity-90"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-white dark:text-zinc-950" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3.5 h-3.5 text-white dark:text-zinc-950" />
                    <span>
                      {uploadCategory === 'created' ? 'Publish School Exam' : 'Upload Exam'}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={isSigningIn}
                className="px-6 py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition active:scale-98"
              >
                <LogIn className="w-3.5 h-3.5 text-white dark:text-zinc-950" />
                <span>{isSigningIn ? 'Signing In...' : 'Sign In as Teacher'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DatabaseUploadModal;
