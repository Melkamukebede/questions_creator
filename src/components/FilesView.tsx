import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  BookOpen,
  Play,
  Edit,
  Trash2,
  Clock,
  HelpCircle,
  ArrowUpDown,
  RotateCcw,
  FileDown,
  CheckCircle,
  Layers,
  CloudDownload,
  CloudUpload,
  Flame,
  GraduationCap,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Tag,
  Share2,
  Filter,
  SlidersHorizontal,
  X,
  School,
  UserCheck,
} from 'lucide-react';
import { Exam, AppUser } from '../types';
import { ShareExamModal } from './ShareExamModal';
import { isUserTeacher } from '../services/db';
import { prefetchPracticeModal, prefetchCreateWizard } from '../services/prefetch';
import {
  doesExamMatchStudentClass,
  isStudentClassLocked,
  formatClassLevelLabel,
  getExamClassLevel,
} from '../utils/classLevelFilter';

interface FilesViewProps {
  exams: Exam[];
  onStartPractice: (exam: Exam) => void;
  onEditExam: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
  onCreateNew?: () => void;
  onOpenCuratedCatalogModal?: () => void;
  onOpenDatabaseUpload?: (exam: Exam) => void;
  onOpenDownloadCenter?: () => void;
  isAdmin?: boolean;
  user?: AppUser | null;
}

type SortOption = 'newest' | 'questions' | 'duration' | 'name';
type SourceFilter = 'all' | 'user_created' | 'downloaded' | 'teacher' | 'my_created' | 'pushed_cloud' | 'local_storage';

export const FilesView: React.FC<FilesViewProps> = ({
  exams,
  onStartPractice,
  onEditExam,
  onDeleteExam,
  onOpenCuratedCatalogModal,
  onOpenDatabaseUpload,
  onOpenDownloadCenter,
  isAdmin = false,
  user,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [examToShare, setExamToShare] = useState<Exam | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

  // Track which exams are expanded to show details
  const [expandedExamIds, setExpandedExamIds] = useState<Record<string, boolean>>({});

  const toggleExpandExam = (examId: string) => {
    setExpandedExamIds((prev) => {
      const isCurrentlyOpen = Boolean(prev[examId]);
      // When expanding one subject, close others so other cards on left/right aren't expanded with it
      return isCurrentlyOpen ? {} : { [examId]: true };
    });
  };

  // Helper to extract clean grade label from an exam
  const getExamGrade = (exam: Exam): string => {
    const canonical = getExamClassLevel(exam);
    if (canonical === 'Freshman') return 'Freshman';
    if (canonical === 'Senior University') return 'Senior University';
    return `Grade ${canonical}`;
  };

  // Helper to extract primary topic
  const getExamTopic = (exam: Exam): string => {
    if (exam.topic && exam.topic.trim()) return exam.topic.trim();
    if (exam.metadata?.topic && exam.metadata.topic.trim()) return exam.metadata.topic.trim();
    if (exam.description && exam.description.trim()) return exam.description.trim();
    return 'Core Curriculum';
  };

  const canUpload = Boolean(isAdmin || (user && isUserTeacher(user)));
  const isTeacherUser = Boolean(user && isUserTeacher(user));
  const classLocked = isStudentClassLocked(user, isAdmin);

  // Scope exams strictly to student's registered class unless Admin, Guest, or Teacher
  const scopedExams = useMemo(() => {
    if (!classLocked) return exams;
    return exams.filter((e) => doesExamMatchStudentClass(e, user, isAdmin));
  }, [exams, classLocked, user, isAdmin]);

  const isExamOfficial = (e: Exam) => Boolean(e.category === 'official' || e.isDownloaded || e.sourceType === 'curated_catalog');
  const isExamTeacher = (e: Exam) => Boolean((e.category === 'created' && e.createdType === 'teacher') || e.school);
  const isPushedToCloud = (e: Exam) => Boolean(
    e.isUploadedToCloud ||
    e.cloudId ||
    e.isPushedToCloud ||
    e.metadata?.pushedToCloud ||
    e.cloudStorageEngine === 'firestore' ||
    e.sourceType === 'firestore'
  );

  // Counts by source
  const officialCount = useMemo(
    () => scopedExams.filter(isExamOfficial).length,
    [scopedExams]
  );
  const teacherCount = useMemo(
    () => scopedExams.filter(isExamTeacher).length,
    [scopedExams]
  );
  const userCreatedCount = useMemo(
    () => scopedExams.filter((e) => !isExamOfficial(e)).length,
    [scopedExams]
  );
  const pushedCloudCount = useMemo(
    () => scopedExams.filter((e) => !isExamOfficial(e) && isPushedToCloud(e)).length,
    [scopedExams]
  );
  const localStorageCount = useMemo(
    () => scopedExams.filter((e) => !isExamOfficial(e) && !isPushedToCloud(e)).length,
    [scopedExams]
  );

  // Dynamically extract grades and counts
  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedExams.forEach((e) => {
      const g = getExamGrade(e);
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [scopedExams]);

  const dynamicGrades = useMemo(() => {
    const keys = Object.keys(gradeCounts).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a.localeCompare(b);
    });
    return ['All', ...keys];
  }, [gradeCounts]);

  // Dynamically extract subjects and counts
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedExams.forEach((e) => {
      const subj = e.subject?.trim() || 'General';
      counts[subj] = (counts[subj] || 0) + 1;
    });
    return counts;
  }, [scopedExams]);

  const dynamicSubjects = useMemo(() => {
    return ['All', ...Object.keys(subjectCounts).sort()];
  }, [subjectCounts]);

  // Dynamically extract topics/units and counts
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedExams.forEach((e) => {
      const topic = getExamTopic(e);
      counts[topic] = (counts[topic] || 0) + 1;
    });
    return counts;
  }, [scopedExams]);

  const dynamicTopics = useMemo(() => {
    return ['All', ...Object.keys(topicCounts).sort()];
  }, [topicCounts]);

  // Active filters count (grade, subject, topic, search)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedGrade !== 'All') count++;
    if (selectedSubject !== 'All') count++;
    if (selectedTopic !== 'All') count++;
    if (sourceFilter !== 'all') count++;
    if (searchTerm.trim() !== '') count++;
    return count;
  }, [selectedGrade, selectedSubject, selectedTopic, sourceFilter, searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedGrade('All');
    setSelectedSubject('All');
    setSelectedTopic('All');
    setSourceFilter('all');
  };

  // Export as .txt
  const handleExportTxt = (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const lines: string[] = [];
      lines.push('================================================================');
      lines.push('FORMAT SPECIFICATION:');
      lines.push(`Grade: ${getExamGrade(exam)}`);
      lines.push(`Subject: ${exam.subject || 'General'}`);
      lines.push(`Topic: ${getExamTopic(exam)}`);
      lines.push(`Time Limit: ${exam.timeLimit || 20} minutes`);
      lines.push('================================================================\n');

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

      setCopiedNotification(`Exported "${exam.name}" as .txt`);
      setTimeout(() => setCopiedNotification(null), 3000);
    } catch {
      setCopiedNotification('Failed to export text file');
      setTimeout(() => setCopiedNotification(null), 3000);
    }
  };

  // Filtered & Sorted exams
  const filteredExams = useMemo(() => {
    const list = scopedExams.filter((exam) => {
      const examGrade = getExamGrade(exam);
      const examSubject = exam.subject?.trim() || 'General';
      const examTopic = getExamTopic(exam);

      const matchSearch =
        searchTerm === '' ||
        exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        examSubject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        examGrade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        examTopic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.questions.some((q) => q.text.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchGrade =
        classLocked || selectedGrade === 'All' || examGrade.toLowerCase() === selectedGrade.toLowerCase();

      const matchSubject =
        selectedSubject === 'All' || examSubject.toLowerCase() === selectedSubject.toLowerCase();

      const matchTopic =
        selectedTopic === 'All' ||
        examTopic.toLowerCase().includes(selectedTopic.toLowerCase()) ||
        (exam.unit && exam.unit.toLowerCase().includes(selectedTopic.toLowerCase()));

      const isOfficial = isExamOfficial(exam);
      const isTeacher = isExamTeacher(exam);
      const isPushed = isPushedToCloud(exam);
      const isCreated = !isOfficial;

      const matchSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'downloaded' && isOfficial) ||
        (sourceFilter === 'teacher' && isTeacher) ||
        (sourceFilter === 'user_created' && isCreated) ||
        (sourceFilter === 'my_created' && isCreated) ||
        (sourceFilter === 'pushed_cloud' && isCreated && isPushed) ||
        (sourceFilter === 'local_storage' && isCreated && !isPushed);

      return matchSearch && matchGrade && matchSubject && matchTopic && matchSource;
    });

    return list.sort((a, b) => {
      if (sortBy === 'questions') {
        return (b.questions?.length || 0) - (a.questions?.length || 0);
      }
      if (sortBy === 'duration') {
        return (b.timeLimit || 0) - (a.timeLimit || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'newest' default
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [scopedExams, classLocked, searchTerm, selectedGrade, selectedSubject, selectedTopic, sourceFilter, sortBy]);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Toast feedback */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-full bg-white dark:bg-white text-slate-900 dark:text-zinc-950 text-xs font-bold shadow-xl flex items-center gap-2 border border-white/90"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-zinc-950" />
            <span>{copiedNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          LAYER 2 CONTAINER: HEADER & FILTER ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-[28px] sm:rounded-[32px] liquid-glass p-5 sm:p-7 space-y-5 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Top Header Row */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl liquid-glass-subtle text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold font-['Outfit',sans-serif] tracking-tight text-slate-950 dark:text-white">
                  Exams Repository
                </h1>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold tabular-nums">
                  · {filteredExams.length} of {scopedExams.length}
                </span>
                {classLocked && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                    <GraduationCap className="w-3 h-3" />
                    <span>{formatClassLevelLabel(user?.grade)}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {classLocked
                  ? `Showing exams curated for your registered class (${formatClassLevelLabel(user?.grade)})`
                  : 'Explore, preview questions, and practice official curriculum exams'}
              </p>
            </div>
          </div>

          {/* Action Controls & Sort */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {(onOpenDownloadCenter || onOpenCuratedCatalogModal) && (
              <button
                type="button"
                onClick={onOpenDownloadCenter || onOpenCuratedCatalogModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs transition cursor-pointer shadow-xs active:scale-98 whitespace-nowrap"
                title="Download official and school exams for offline practice"
              >
                <CloudDownload className="w-3.5 h-3.5" />
                <span>Download Exams</span>
              </button>
            )}

            {canUpload && onOpenDatabaseUpload && scopedExams.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenDatabaseUpload(scopedExams[0])}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full liquid-glass-btn font-semibold text-xs cursor-pointer whitespace-nowrap"
                title="Publish questions online for students"
              >
                <CloudUpload className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Publish</span>
              </button>
            )}

            {/* Sort selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 liquid-glass-subtle px-3 py-1.5 rounded-full">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer focus:outline-none"
              >
                <option value="newest" className="bg-white dark:bg-[#0c182b] text-slate-900 dark:text-white">Newest First</option>
                <option value="questions" className="bg-white dark:bg-[#0c182b] text-slate-900 dark:text-white">Most Questions</option>
                <option value="duration" className="bg-white dark:bg-[#0c182b] text-slate-900 dark:text-white">Longest Duration</option>
                <option value="name" className="bg-white dark:bg-[#0c182b] text-slate-900 dark:text-white">Title (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Source Tabs */}
        <div className="relative z-10 flex items-center gap-1.5 p-1 rounded-full bg-slate-200/50 dark:bg-[#0c182b] border border-white/80 dark:border-white/10 w-full sm:w-fit overflow-x-auto">
          {isTeacherUser ? (
            <>
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'all'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>All Exams</span>
                <span className="text-[10px] opacity-75 tabular-nums">({scopedExams.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('my_created')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'my_created'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>My Created</span>
                <span className="text-[10px] opacity-75 tabular-nums">({userCreatedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('pushed_cloud')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'pushed_cloud'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Published Online</span>
                <span className="text-[10px] opacity-75 tabular-nums">({pushedCloudCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('local_storage')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'local_storage'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Saved on Device</span>
                <span className="text-[10px] opacity-75 tabular-nums">({localStorageCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('downloaded')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'downloaded'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Official Curriculum</span>
                <span className="text-[10px] opacity-75 tabular-nums">({officialCount})</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'all'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>All Exams</span>
                <span className="text-[10px] opacity-75 tabular-nums">({scopedExams.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('downloaded')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'downloaded'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Official Curriculum</span>
                <span className="text-[10px] opacity-75 tabular-nums">({officialCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('teacher')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'teacher'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>School Teacher</span>
                <span className="text-[10px] opacity-75 tabular-nums">({teacherCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceFilter('user_created')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-98 ${
                  sourceFilter === 'user_created'
                    ? 'bg-white dark:bg-white text-slate-900 dark:text-zinc-950 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Student Drafts</span>
                <span className="text-[10px] opacity-75 tabular-nums">({userCreatedCount})</span>
              </button>
            </>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────
            LAYER 3: FILTER PANEL (Collapsible & Expandable)
        ───────────────────────────────────────────────────────── */}
        <div className="relative z-10 p-3.5 sm:p-5 rounded-2xl liquid-glass-subtle space-y-3">
          {/* Search Input Bar & Filter Toggle Row */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="fileSearchInput"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, subject, topic, or question keywords..."
                className="w-full pl-10 pr-14 py-2.5 text-xs sm:text-sm rounded-full bg-white dark:bg-[#070e1a] border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Toggle & Active Filter Chips Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="toggle-filters-btn"
                  onClick={() => setIsFiltersExpanded((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border active:scale-95 ${
                    isFiltersExpanded || activeFiltersCount > 0
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                      : 'bg-white dark:bg-[#0c182b] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#132238]'
                  }`}
                  title={isFiltersExpanded ? 'Collapse grade, subject & topic filters' : 'Expand grade, subject & topic filters'}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{isFiltersExpanded ? 'Hide Filters' : 'Filter Options'}</span>
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums bg-white/20 dark:bg-zinc-900/20">
                      {activeFiltersCount}
                    </span>
                  )}
                  {isFiltersExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {!classLocked && selectedGrade !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#0c182b] text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10">
                    <span>{selectedGrade}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedGrade('All')}
                      className="hover:text-rose-500 ml-0.5 cursor-pointer"
                      title="Remove grade filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedSubject !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#0c182b] text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10">
                    <span>{selectedSubject}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSubject('All')}
                      className="hover:text-rose-500 ml-0.5 cursor-pointer"
                      title="Remove subject filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedTopic !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#0c182b] text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10">
                    <span className="max-w-[120px] truncate">{selectedTopic}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTopic('All')}
                      className="hover:text-rose-500 ml-0.5 cursor-pointer"
                      title="Remove topic filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition ml-auto"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable Filter Details (Grade, Subject, Topic & Subject Pills) */}
          <AnimatePresence>
            {isFiltersExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-3.5 pt-3 border-t border-slate-200/70 dark:border-white/10"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Grade Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{classLocked ? 'Registered Class' : 'Grade'}</span>
                    </label>
                    {classLocked ? (
                      <div className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-bold flex items-center justify-between">
                        <span>{formatClassLevelLabel(user?.grade)}</span>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400">({scopedExams.length})</span>
                      </div>
                    ) : (
                      <select
                        id="filterGradeSelect"
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-medium cursor-pointer focus:outline-none"
                      >
                        <option value="All">All Grades ({scopedExams.length})</option>
                        {dynamicGrades
                          .filter((g) => g !== 'All')
                          .map((grade) => (
                            <option key={grade} value={grade}>
                              {grade} ({gradeCounts[grade] || 0})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {/* 2. Subject Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Subject</span>
                    </label>
                    <select
                      id="filterSubjectSelect"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-medium cursor-pointer focus:outline-none"
                    >
                      <option value="All">All Subjects ({scopedExams.length})</option>
                      {dynamicSubjects
                        .filter((s) => s !== 'All')
                        .map((subj) => (
                          <option key={subj} value={subj}>
                            {subj} ({subjectCounts[subj] || 0})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 3. Topic / Unit Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Topic</span>
                    </label>
                    <select
                      id="filterTopicSelect"
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-medium cursor-pointer focus:outline-none truncate"
                    >
                      <option value="All">All Topics ({scopedExams.length})</option>
                      {dynamicTopics
                        .filter((t) => t !== 'All')
                        .map((topic) => (
                          <option key={topic} value={topic}>
                            {topic.length > 50 ? `${topic.substring(0, 50)}...` : topic} ({topicCounts[topic] || 0})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Quick Subject Access */}
                {dynamicSubjects.length > 1 && (
                  <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Subjects ({dynamicSubjects.filter((s) => s !== 'All').length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {dynamicSubjects.map((subj) => {
                        const isSelected = selectedSubject.toLowerCase() === subj.toLowerCase();
                        const count = subj === 'All' ? scopedExams.length : (subjectCounts[subj] || 0);
                        const subjectExam = subj === 'All'
                          ? scopedExams[0]
                          : scopedExams.find((e) => (e.subject || 'General').toLowerCase() === subj.toLowerCase());

                        return (
                          <div
                            key={subj}
                            className={`inline-flex items-center rounded-full text-xs transition border overflow-hidden ${
                              isSelected
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white font-bold'
                                : 'bg-white dark:bg-[#070e1a] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-slate-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedSubject(subj)}
                              className="px-3 py-1 font-semibold flex items-center gap-1.5 cursor-pointer active:scale-98"
                            >
                              <span>{subj}</span>
                              <span className="text-[10px] opacity-75 tabular-nums">({count})</span>
                            </button>

                            {isAdmin && onOpenDatabaseUpload && subj !== 'All' && subjectExam && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDatabaseUpload(subjectExam);
                                }}
                                className="px-2 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition border-l border-slate-200/50 dark:border-white/10 hover:bg-amber-500/10 text-amber-500"
                                title={`Publish ${subj} exam online`}
                              >
                                <Flame className="w-3 h-3" />
                                <span>Publish</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          EXAMS REPOSITORY GRID (Uncrowded 3-Layer Fluid Glass Cards)
      ───────────────────────────────────────────────────────────── */}
      {filteredExams.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-[28px] liquid-glass">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No matching exams found</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Try adjusting your Grade, Subject, or Topic filter criteria.
          </p>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3.5 px-5 py-2 rounded-full liquid-glass-btn font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <AnimatePresence mode="popLayout">
            {filteredExams.map((exam) => {
              const isCurated = Boolean(exam.isDownloaded || exam.sourceType === 'curated_catalog');
              const gradeLabel = getExamGrade(exam);
              const topicLabel = getExamTopic(exam);
              const isExpanded = Boolean(expandedExamIds[exam.id]);
              const questionCount = exam.questions?.length || 0;
              const sourceLabel =
                exam.category === 'official' || isCurated
                  ? exam.examYear
                    ? `Official ${exam.examYear}`
                    : 'Official'
                  : (exam.category === 'created' && exam.createdType === 'teacher') || exam.school
                  ? exam.school || exam.teacherName || 'Teacher'
                  : isPushedToCloud(exam)
                  ? 'Published'
                  : 'On Device';

              return (
                <motion.div
                  layout="position"
                  key={exam.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`group rounded-[24px] liquid-glass-elevated overflow-hidden min-w-0 ${
                    isExpanded ? 'ring-1 ring-sky-500/30 dark:ring-sky-400/30' : ''
                  }`}
                >
                  {!isExpanded ? (
                    /* ─────────────────────────────────────────────────────────────
                       COLLAPSED VIEW: CLEAN UNBOXED METADATA + TOPIC + ACTIONS
                    ───────────────────────────────────────────────────────────── */
                    <div
                      onClick={() => toggleExpandExam(exam.id)}
                      className="p-4 flex flex-col gap-2.5 cursor-pointer hover:bg-white/40 dark:hover:bg-white/[0.02] transition select-none min-w-0"
                    >
                      {/* Top Row: Clean Unboxed Metadata (Grade · Subject · Source) */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 min-w-0 truncate">
                          <span className="font-bold text-slate-900 dark:text-white shrink-0">
                            {gradeLabel}
                          </span>
                          <span>·</span>
                          <span className="truncate font-semibold text-sky-700 dark:text-sky-300">
                            {exam.subject || 'General'}
                          </span>
                          <span>·</span>
                          <span className="truncate opacity-85">{sourceLabel}</span>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
                          {questionCount} Qs
                        </span>
                      </div>

                      {/* Middle Row: Exam Name & Topic */}
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm font-['Outfit',sans-serif] text-slate-950 dark:text-white truncate">
                          {exam.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5" title={topicLabel}>
                          {topicLabel}
                        </p>
                      </div>

                      {/* Bottom Row: Primary & Secondary Actions */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-1.5 min-w-0">
                        <button
                          type="button"
                          onMouseEnter={prefetchPracticeModal}
                          onTouchStart={prefetchPracticeModal}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartPractice(exam);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-95 active:scale-95 transition cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
                          title="Start Practice"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Practice</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          {canUpload && onOpenDatabaseUpload && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDatabaseUpload(exam);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold liquid-glass-subtle hover:bg-white dark:hover:bg-[#132238] text-slate-800 dark:text-zinc-200 transition cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                              title={isPushedToCloud(exam) ? 'Update published exam' : 'Publish online for students'}
                            >
                              <CloudUpload className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>{isPushedToCloud(exam) ? 'Update' : 'Publish'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            id={`share-exam-btn-${exam.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExamToShare(exam);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold liquid-glass-subtle hover:bg-white dark:hover:bg-[#132238] text-slate-700 dark:text-zinc-300 transition cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                            title="Share exam deep link & specification"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandExam(exam.id);
                            }}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shrink-0"
                            title="Expand details"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ─────────────────────────────────────────────────────────────
                       EXPANDED VIEW: FULL DETAILS & ACTIONS
                    ───────────────────────────────────────────────────────────── */
                    <div className="p-4 space-y-3 flex flex-col justify-between min-w-0">
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 min-w-0 truncate">
                            <span className="font-bold text-slate-900 dark:text-white shrink-0">
                              {gradeLabel}
                            </span>
                            <span>·</span>
                            <span className="truncate font-semibold text-sky-700 dark:text-sky-300">
                              {exam.subject || 'General'}
                            </span>
                            <span>·</span>
                            <span className="truncate">{sourceLabel}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleExpandExam(exam.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold liquid-glass-subtle text-slate-800 dark:text-zinc-200 transition cursor-pointer shrink-0 ml-auto"
                            title="Collapse"
                          >
                            <span>Collapse</span>
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <h3 className="font-bold text-sm font-['Outfit',sans-serif] text-slate-950 dark:text-white leading-snug">
                            {exam.name}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-zinc-400">
                            <strong className="text-slate-800 dark:text-zinc-200">Topic:</strong> {topicLabel}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-xl liquid-glass-subtle tabular-nums">
                          <span className="text-slate-600 dark:text-zinc-400">
                            Questions: <strong className="text-slate-900 dark:text-white">{questionCount}</strong>
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-zinc-400">
                            Duration: <strong className="text-slate-900 dark:text-white">{exam.timeLimit} mins</strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 min-w-0">
                          <button
                            type="button"
                            onMouseEnter={prefetchPracticeModal}
                            onTouchStart={prefetchPracticeModal}
                            onClick={() => onStartPractice(exam)}
                            className="py-1.5 px-3.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition hover:opacity-90 active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Practice</span>
                          </button>

                          {canUpload && onOpenDatabaseUpload && (
                            <button
                              type="button"
                              onClick={() => onOpenDatabaseUpload(exam)}
                              className="py-1.5 px-3 rounded-full liquid-glass-subtle text-slate-900 dark:text-white font-semibold text-xs inline-flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer whitespace-nowrap"
                            >
                              <CloudUpload className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>Publish</span>
                            </button>
                          )}

                          <button
                            type="button"
                            id={`share-exam-expanded-btn-${exam.id}`}
                            onClick={() => setExamToShare(exam)}
                            className="py-1.5 px-3 rounded-full liquid-glass-subtle text-slate-800 dark:text-zinc-200 font-semibold text-xs inline-flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </button>

                          {!isCurated ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditExam(exam)}
                                className="py-1.5 px-3 rounded-full liquid-glass-subtle text-slate-800 dark:text-zinc-200 font-semibold text-xs inline-flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleExportTxt(exam, e)}
                                className="py-1.5 px-3 rounded-full liquid-glass-subtle text-slate-700 dark:text-zinc-300 transition cursor-pointer active:scale-95 text-xs font-medium inline-flex items-center justify-center gap-1 whitespace-nowrap"
                              >
                                <FileDown className="w-3 h-3" />
                                <span>Export</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleExportTxt(exam, e)}
                              className="py-1.5 px-3 rounded-full liquid-glass-subtle text-slate-800 dark:text-zinc-200 font-semibold text-xs inline-flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap"
                            >
                              <FileDown className="w-3 h-3" />
                              <span>Export</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteExam(exam.id)}
                            className="py-1.5 px-3 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-xs inline-flex items-center justify-center gap-1 transition hover:bg-rose-500/20 border border-rose-500/20 active:scale-95 cursor-pointer ml-auto whitespace-nowrap"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Share Exam Modal */}
      <ShareExamModal
        isOpen={examToShare !== null}
        exam={examToShare}
        user={user}
        onClose={() => setExamToShare(null)}
        onStartPractice={(ex) => {
          setExamToShare(null);
          onStartPractice(ex);
        }}
      />
    </div>
  );
};
