import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CloudDownload,
  Search,
  BookOpen,
  Clock,
  HelpCircle,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  Edit3,
  Filter,
  Play,
  Layers,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Exam, AppUser } from '../types';
import { CURATED_EXAMS_CATALOG } from '../data/curatedCatalog';
import { MathRenderer } from './MathRenderer';
import { useAuth } from '../context/AuthContext';

interface CuratedExamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadExam: (catalogExam: Exam) => Promise<void>;
  downloadedCatalogIds: string[];
  user: AppUser | null;
  onOpenSubscriptionModal?: () => void;
  officialExams?: Exam[];
  onStartPractice?: (exam: Exam) => void;
}

export const CuratedExamsModal: React.FC<CuratedExamsModalProps> = ({
  isOpen,
  onClose,
  onDownloadExam,
  downloadedCatalogIds,
  user,
  officialExams,
  onStartPractice,
}) => {
  const { updateStudentGrade, openRegistrationModal } = useAuth();

  // Student's active registered grade from profile or local storage (default 12)
  const registeredGrade = user?.grade
    ? String(user.grade)
    : localStorage.getItem('student_selected_grade') || '12';
  const registeredStream =
    user?.stream || (localStorage.getItem('student_selected_stream') as any) || 'Natural Science';
  const isRegistered = Boolean(user?.isRegistered || localStorage.getItem('student_is_registered') === 'true');

  // Filter state
  const [onlyShowRegisteredGrade, setOnlyShowRegisteredGrade] = useState<boolean>(true);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>(registeredGrade);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  // Sync selectedGradeFilter when user's registered grade changes
  useEffect(() => {
    setSelectedGradeFilter(registeredGrade);
  }, [registeredGrade]);

  // Active catalog sources (Live Firestore official exams merged with baseline catalog)
  const catalogExams = useMemo(() => {
    return officialExams && officialExams.length > 0 ? officialExams : CURATED_EXAMS_CATALOG;
  }, [officialExams]);

  // Dynamic filter lists
  const availableGrades = ['All', 'Freshman', 'Senior University', '12', '11', '10', '9'];

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    catalogExams.forEach((e) => {
      if (e.subject) subjects.add(e.subject);
    });
    return ['All', ...Array.from(subjects).sort()];
  }, [catalogExams]);

  // Subject Stepper Spinner
  const currentSubjectIndex = useMemo(() => {
    const idx = availableSubjects.indexOf(selectedSubjectFilter);
    return idx >= 0 ? idx : 0;
  }, [availableSubjects, selectedSubjectFilter]);

  const handlePrevSubject = () => {
    if (currentSubjectIndex > 0) {
      setSelectedSubjectFilter(availableSubjects[currentSubjectIndex - 1]);
    } else {
      setSelectedSubjectFilter(availableSubjects[availableSubjects.length - 1]);
    }
  };

  const handleNextSubject = () => {
    if (currentSubjectIndex < availableSubjects.length - 1) {
      setSelectedSubjectFilter(availableSubjects[currentSubjectIndex + 1]);
    } else {
      setSelectedSubjectFilter(availableSubjects[0]);
    }
  };

  // Grade Stepper Spinner
  const currentGradeIndex = useMemo(() => {
    const idx = availableGrades.indexOf(selectedGradeFilter);
    return idx >= 0 ? idx : 0;
  }, [availableGrades, selectedGradeFilter]);

  const handlePrevGrade = () => {
    if (currentGradeIndex > 0) {
      handleGradeFilterClick(availableGrades[currentGradeIndex - 1]);
    }
  };

  const handleNextGrade = () => {
    if (currentGradeIndex < availableGrades.length - 1) {
      handleGradeFilterClick(availableGrades[currentGradeIndex + 1]);
    }
  };

  // Filter curated exams strictly based on registered grade or manual filter
  const filteredExams = useMemo(() => {
    return catalogExams.filter((exam) => {
      const examGradeStr = String(exam.grade || '');

      // Strict registered grade filtering as requested
      if (onlyShowRegisteredGrade) {
        if (examGradeStr !== registeredGrade && examGradeStr !== 'All') {
          return false;
        }
      } else if (selectedGradeFilter !== 'All') {
        if (examGradeStr !== selectedGradeFilter) return false;
      }

      // Subject matching:
      if (selectedSubjectFilter !== 'All' && exam.subject !== selectedSubjectFilter) {
        return false;
      }

      // Search query matching:
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = exam.title?.toLowerCase().includes(q) || exam.name.toLowerCase().includes(q);
        const matchesSubject = exam.subject.toLowerCase().includes(q);
        const matchesTopic = exam.topic?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesSubject && !matchesTopic) return false;
      }

      return true;
    });
  }, [catalogExams, onlyShowRegisteredGrade, registeredGrade, selectedGradeFilter, selectedSubjectFilter, searchQuery]);

  // Check if an exam matches student's stream
  const doesExamMatchStream = (subject: string) => {
    const s = subject.toLowerCase();
    if (registeredStream === 'Natural Science') {
      return (
        s.includes('math') ||
        s.includes('physic') ||
        s.includes('chem') ||
        s.includes('biol') ||
        s.includes('english') ||
        s.includes('aptitude') ||
        s.includes('ict')
      );
    }
    if (registeredStream === 'Social Science') {
      return (
        s.includes('econ') ||
        s.includes('geog') ||
        s.includes('histor') ||
        s.includes('math') ||
        s.includes('english') ||
        s.includes('aptitude') ||
        s.includes('civic')
      );
    }
    return true;
  };

  // Handle grade change and persist to student profile
  const handleGradeFilterClick = (grade: string) => {
    setSelectedGradeFilter(grade);
    if (grade !== 'All') {
      updateStudentGrade(grade);
    }
  };

  const handleDownloadClick = async (exam: Exam) => {
    setDownloadingIds((prev) => ({ ...prev, [exam.id]: true }));
    try {
      await onDownloadExam(exam);
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [exam.id]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="curated-exams-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-4xl bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-[28px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-2xl"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-800 via-zinc-500 to-zinc-800 dark:from-white/30 dark:via-white/70 dark:to-white/30" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/80 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shadow-xs border border-zinc-200 dark:border-zinc-700">
              <CloudDownload className="w-5 h-5 text-zinc-900 dark:text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold font-['Outfit',sans-serif] text-zinc-900 dark:text-white tracking-tight">
                  Download Official Exams
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  {catalogExams.length} Available
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <RefreshCw className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  <span>Cloud Synced</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Official Ethiopian entrance & curriculum exams with KaTeX math steps.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition cursor-pointer border border-zinc-200 dark:border-zinc-700"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-zinc-900 dark:text-white stroke-[2.2]" />
          </button>
        </div>

        {/* Student Registered Target Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-zinc-50/90 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-300 dark:border-zinc-700">
              <GraduationCap className="w-4 h-4 text-zinc-900 dark:text-white stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex-wrap">
              <span>Target:</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-[11px] shadow-xs">
                {registeredGrade === 'Freshman' ? 'Univ Freshman' : `Grade ${registeredGrade}`}
              </span>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                • {registeredStream}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Registered grade strict filter toggle */}
            <button
              type="button"
              onClick={() => setOnlyShowRegisteredGrade(!onlyShowRegisteredGrade)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs border ${
                onlyShowRegisteredGrade
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 border border-white/90 shadow-sm font-bold'
                  : 'bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
              }`}
            >
              <Filter className="w-3 h-3 text-blue-600 dark:text-zinc-950 stroke-[2.2]" />
              <span>{onlyShowRegisteredGrade ? `Grade ${registeredGrade} Only` : 'All Grades View'}</span>
            </button>

            {/* Change Grade / Register Button */}
            <button
              type="button"
              onClick={openRegistrationModal}
              className="px-3 py-1 rounded-full bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Edit3 className="w-3 h-3 text-zinc-900 dark:text-white stroke-[2.2]" />
              <span>{isRegistered ? 'Edit Grade' : 'Register'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Subject Spinner Stepper & Search */}
        <div className="px-5 sm:px-6 py-3 bg-zinc-50/50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          {/* Grade selection row when not restricted to single grade */}
          {!onlyShowRegisteredGrade && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500 font-bold mr-1">Grade:</span>
                <button
                  type="button"
                  onClick={handlePrevGrade}
                  disabled={currentGradeIndex <= 0}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer transition active:scale-95 shrink-0"
                  title="Previous grade"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                </button>
                <div className="flex items-center gap-1 flex-wrap">
                  {availableGrades.map((g) => {
                    const isActive = selectedGradeFilter === g;
                    const isStudentPrimary = registeredGrade === g && g !== 'All';
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGradeFilterClick(g)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          isActive
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                        }`}
                      >
                        {g === 'All' ? 'All' : g === 'Freshman' ? 'Freshman' : g === 'Senior University' ? 'Univ Senior' : `G${g}`}
                        {isStudentPrimary && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-extrabold">
                            ●
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleNextGrade}
                  disabled={currentGradeIndex >= availableGrades.length - 1}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer transition active:scale-95 shrink-0"
                  title="Next grade"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                </button>
              </div>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                <strong className="text-zinc-900 dark:text-white font-bold">{filteredExams.length}</strong> official exams
              </div>
            </div>
          )}

          {/* Subject Spinner Stepper & Search Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Subject Stepper Spinner with Prev/Next controls */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">Subject:</span>
              <button
                type="button"
                onClick={handlePrevSubject}
                className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs cursor-pointer transition active:scale-95 shrink-0 shadow-2xs"
                title="Previous subject"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
              </button>

              <div className="relative shrink-0">
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="pl-2.5 pr-7 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs font-bold focus:outline-hidden focus:border-zinc-900 dark:focus:border-white cursor-pointer shadow-2xs appearance-none"
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub === 'All' ? 'All Subjects' : sub}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-500 dark:text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleNextSubject}
                className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs cursor-pointer transition active:scale-95 shrink-0 shadow-2xs"
                title="Next subject"
              >
                <ChevronRight className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
              </button>

              {/* Scrollable quick-chips */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {availableSubjects.slice(0, 6).map((sub) => {
                  const isSelected = selectedSubjectFilter === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubjectFilter(sub)}
                      className={`whitespace-nowrap px-2 py-0.5 text-[11px] rounded-lg transition cursor-pointer border ${
                        isSelected
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold border-zinc-950 dark:border-white shadow-2xs'
                          : 'bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 font-medium'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:border-zinc-900 dark:focus:border-white text-zinc-900 dark:text-white placeholder:text-zinc-400 font-medium shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="w-3 h-3 text-zinc-900 dark:text-white" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Catalog Exams Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-zinc-50/30 dark:bg-[#070e1a]">
          {filteredExams.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center mx-auto mb-2 border border-zinc-200 dark:border-zinc-700">
                <BookOpen className="w-5 h-5 text-zinc-900 dark:text-white stroke-[2]" />
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                No exams found for Grade {registeredGrade}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Explore all grades or update your student grade profile.
              </p>
              <div className="mt-3.5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyShowRegisteredGrade(false)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 cursor-pointer shadow-xs transition"
                >
                  View All Grades
                </button>
                <button
                  type="button"
                  onClick={openRegistrationModal}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-100 cursor-pointer shadow-xs border border-zinc-200 dark:border-zinc-700 transition"
                >
                  Change Grade
                </button>
              </div>
            </div>
          ) : (
            filteredExams.map((exam) => {
              const isDownloaded = downloadedCatalogIds.includes(exam.id);
              const isDownloading = Boolean(downloadingIds[exam.id]);
              const isPreviewing = previewExamId === exam.id;
              const matchesStream = doesExamMatchStream(exam.subject);

              // Concise 1-line short description for clean presentation
              const shortDescription =
                exam.description && exam.description.length > 80
                  ? exam.description.slice(0, 80) + '...'
                  : exam.description ||
                    `${exam.subject} official curriculum examination with step-by-step KaTeX solutions.`;

              return (
                <div
                  key={exam.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Compact Badges Row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                          {exam.subject}
                        </span>
                        {exam.grade && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                            {exam.grade === 'Senior University'
                              ? 'Univ Senior'
                              : exam.grade === 'Freshman'
                              ? 'Freshman'
                              : `Grade ${exam.grade}`}
                          </span>
                        )}
                        {matchesStream && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {registeredStream}
                          </span>
                        )}
                        {exam.isUploadedToCloud && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Official
                          </span>
                        )}
                        {exam.rating && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 ml-0.5">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {exam.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-snug">
                        {exam.title || exam.name}
                      </h3>

                      {/* Short Description */}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1">
                        {shortDescription}
                      </p>

                      {/* Meta stats */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-zinc-900 dark:text-white" />
                          {exam.questions.length} Questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-900 dark:text-white" />
                          {exam.timeLimit} Mins
                        </span>
                        {exam.topic && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <Layers className="w-3 h-3 text-zinc-900 dark:text-white" />
                            {exam.topic}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Download & Preview Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 shrink-0">
                      {isDownloaded ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>In Library</span>
                          </div>
                          {onStartPractice && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onStartPractice(exam);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer hover:opacity-90 shadow-2xs"
                              title="Start Practice Now"
                            >
                              <Play className="w-3 h-3 text-white dark:text-zinc-950 fill-current" />
                              <span>Practice</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadClick(exam)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-white text-slate-900 dark:text-zinc-950 hover:bg-white/90 font-bold text-xs transition cursor-pointer active:scale-98 disabled:opacity-50 shadow-sm border border-white/90"
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-950 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <CloudDownload className="w-3.5 h-3.5 text-blue-600 dark:text-zinc-950 stroke-[2.2]" />
                              <span>Download</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Preview Sample Question button */}
                      <button
                        type="button"
                        onClick={() => setPreviewExamId(isPreviewing ? null : exam.id)}
                        className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition"
                      >
                        <span>{isPreviewing ? 'Hide Sample' : 'Sample Q'}</span>
                        {isPreviewing ? (
                          <ChevronUp className="w-3 h-3 text-zinc-900 dark:text-white" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-zinc-900 dark:text-white" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sample Question Preview Drawer */}
                  <AnimatePresence>
                    {isPreviewing && exam.questions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 overflow-hidden"
                      >
                        <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-zinc-900 dark:text-white" />
                          <span>Sample Question (Q1 of {exam.questions.length})</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
                          <MathRenderer content={exam.questions[0].text} className="font-semibold text-zinc-900 dark:text-white" />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                            {exam.questions[0].options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className={`px-2.5 py-1 rounded-lg text-[11px] border font-medium ${
                                  optIdx === exam.questions[0].correct
                                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white font-bold'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                <MathRenderer content={opt} />
                              </div>
                            ))}
                          </div>
                          {exam.questions[0].explanation && (
                            <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                              <strong className="text-zinc-900 dark:text-white not-italic font-bold">Solution: </strong>
                              <MathRenderer content={exam.questions[0].explanation} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/80 dark:bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">Downloaded exams are saved locally for offline practice anytime.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 font-bold transition cursor-pointer border border-zinc-200 dark:border-zinc-700 shadow-2xs"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
