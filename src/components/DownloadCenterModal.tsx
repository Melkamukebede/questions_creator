import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  CloudDownload,
  Database,
  Search,
  GraduationCap,
  BookOpen,
  Layers,
  CheckCircle2,
  Image as ImageIcon,
  Table as TableIcon,
  Play,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Check,
  Cloud,
  RefreshCw,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Exam, YearDurationFilter } from '../types';
import { downloadMultiExamSqliteBundle } from '../services/sqliteService';
import {
  CURATED_OFFICIAL_EXAMS,
  fetchOfficialExams,
  getSupabaseConfig,
} from '../services/supabaseService';
import { CURATED_EXAMS_CATALOG } from '../data/curatedCatalog';
import { addDownloadedExamsToRepository, isUserAdmin } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { MathRenderer } from './MathRenderer';
import {
  normalizeClassLevel,
  getExamClassLevel,
  isStudentClassLocked,
  doesExamMatchStudentClass,
  formatClassLevelLabel,
} from '../utils/classLevelFilter';

interface DownloadCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allExams: Exam[];
  userAcademicYear?: string;
  userUniversity?: string;
  onStartExam?: (exam: Exam) => void;
  onOpenSupabaseConfig?: () => void;
  onExamsDownloaded?: (downloadedExams: Exam[]) => void;
  downloadedCatalogIds?: string[];
}

const LEVEL_FILTERS = [
  { id: 'All', label: 'All Levels' },
  { id: '12', label: 'Grade 12' },
  { id: '11', label: 'Grade 11' },
  { id: '10', label: 'Grade 10' },
  { id: '9', label: 'Grade 9' },
  { id: 'Freshman', label: 'Univ Freshman' },
  { id: 'Senior University', label: 'Univ Senior' },
];

export const DownloadCenterModal: React.FC<DownloadCenterModalProps> = ({
  isOpen,
  onClose,
  allExams,
  userAcademicYear,
  onStartExam,
  onOpenSupabaseConfig,
  onExamsDownloaded,
  downloadedCatalogIds = [],
}) => {
  const { user, openRegistrationModal } = useAuth();
  const isAdmin = Boolean(user && !user.isAnonymous && user.uid !== 'guest' && isUserAdmin(user));
  const classLocked = isStudentClassLocked(user, isAdmin);
  const studentLockedLevel = useMemo(
    () => normalizeClassLevel(user?.grade || userAcademicYear || '12'),
    [user?.grade, userAcademicYear]
  );

  // Cloud-fetched exams from Supabase & Firestore
  const [cloudExams, setCloudExams] = useState<Exam[]>([]);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Determine default level filter from user profile if available, else 'All'
  const initialLevel = useMemo(() => {
    if (classLocked) return studentLockedLevel;
    const raw = String(user?.grade || userAcademicYear || '').trim();
    if (LEVEL_FILTERS.some((l) => l.id.toLowerCase() === raw.toLowerCase() && l.id !== 'All')) {
      return LEVEL_FILTERS.find((l) => l.id.toLowerCase() === raw.toLowerCase())!.id;
    }
    return 'All';
  }, [classLocked, studentLockedLevel, user?.grade, userAcademicYear]);

  // Simplified filter state
  const [selectedLevel, setSelectedLevel] = useState<string>(() =>
    classLocked ? studentLockedLevel : 'All'
  );
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [yearDuration, setYearDuration] = useState<YearDurationFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);

  // Sync selectedLevel whenever student class lock or grade changes
  useEffect(() => {
    if (classLocked) {
      setSelectedLevel(studentLockedLevel);
    }
  }, [classLocked, studentLockedLevel]);

  // Action states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [savedExamIds, setSavedExamIds] = useState<Record<string, boolean>>({});

  // Sync live exams from Supabase & Cloud when modal opens
  const syncCloudCatalog = useCallback(async () => {
    setIsSyncingCloud(true);
    try {
      const remote = await fetchOfficialExams();
      if (remote && remote.length > 0) {
        setCloudExams(remote);
      }
    } catch {
      // Fallback to local & Firestore exams seamlessly
    } finally {
      setIsSyncingCloud(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      syncCloudCatalog();
    }
  }, [isOpen, syncCloudCatalog]);

  // Merge Supabase, Firebase Cloud, and Curated Official Catalog (deduplicated by ID & scoped to student class if locked)
  const combinedExams = useMemo(() => {
    const map = new Map<string, Exam>();
    for (const ex of CURATED_EXAMS_CATALOG) {
      map.set(ex.id, ex);
    }
    for (const ex of CURATED_OFFICIAL_EXAMS) {
      map.set(ex.id, ex);
    }
    for (const ex of allExams) {
      map.set(ex.id, ex);
    }
    for (const ex of cloudExams) {
      map.set(ex.id, ex);
    }
    const allList = Array.from(map.values());
    if (classLocked) {
      return allList.filter((ex) => doesExamMatchStudentClass(ex, user, isAdmin));
    }
    return allList;
  }, [allExams, cloudExams, classLocked, user, isAdmin]);

  // Normalize exam level label
  const getNormalizedLevel = (exam: Exam): string => {
    return getExamClassLevel(exam);
  };

  const effectiveSelectedLevel = classLocked ? studentLockedLevel : selectedLevel;

  // Dynamic subject list based on current level selection
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    combinedExams.forEach((e) => {
      const level = getNormalizedLevel(e);
      if (effectiveSelectedLevel === 'All' || level === effectiveSelectedLevel) {
        if (e.subject?.trim()) set.add(e.subject.trim());
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [combinedExams, effectiveSelectedLevel]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    return combinedExams.filter((exam) => {
      // 1. Level Filter
      if (effectiveSelectedLevel !== 'All') {
        const examLevel = getNormalizedLevel(exam);
        if (examLevel !== effectiveSelectedLevel) return false;
      }

      // 2. Subject Filter
      if (selectedSubject !== 'All') {
        const sub = (exam.subject || '').toLowerCase();
        const targetSub = selectedSubject.toLowerCase();
        if (sub !== targetSub && !sub.includes(targetSub)) return false;
      }

      // 3. Year Duration Filter (All, 1-3 Yrs, 1-5 Yrs)
      if (yearDuration !== 'all') {
        const rawYear = String(exam.examYear || exam.targetExamYear || '');
        const yearNum = parseInt(rawYear.replace(/[^0-9]/g, '').slice(0, 4) || '2025', 10);
        const isEc = yearNum <= 2020;
        const refYear = isEc ? 2018 : 2026;
        const diff = Math.max(0, refYear - yearNum);
        if (yearDuration === '1-3' && diff > 3) return false;
        if (yearDuration === '1-5' && diff > 5) return false;
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = `${exam.title || ''} ${exam.name || ''}`.toLowerCase();
        const sub = (exam.subject || '').toLowerCase();
        const topic = (exam.topic || '').toLowerCase();
        const uni = (exam.university || exam.school || '').toLowerCase();
        if (!title.includes(q) && !sub.includes(q) && !topic.includes(q) && !uni.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [combinedExams, effectiveSelectedLevel, selectedSubject, yearDuration, searchQuery]);

  const totalQuestionsInFilter = useMemo(() => {
    return filteredExams.reduce((sum, e) => sum + (e.questions?.length || 0), 0);
  }, [filteredExams]);

  if (!isOpen) return null;

  const isExamSaved = (exam: Exam) => {
    return Boolean(
      savedExamIds[exam.id] ||
        exam.isDownloaded ||
        downloadedCatalogIds.includes(exam.id) ||
        downloadedCatalogIds.includes(exam.catalogId || '')
    );
  };

  // Download all matching exams into in-app repository
  const handleDownloadAllMatching = () => {
    if (filteredExams.length === 0) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      addDownloadedExamsToRepository(filteredExams);

      const newlySaved: Record<string, boolean> = { ...savedExamIds };
      filteredExams.forEach((e) => {
        newlySaved[e.id] = true;
      });
      setSavedExamIds(newlySaved);

      setExportNotice(
        `Saved ${filteredExams.length} exams (${totalQuestionsInFilter} questions) to your Exams Library!`
      );

      if (onExamsDownloaded) {
        onExamsDownloaded(filteredExams);
      }

      setTimeout(() => setExportNotice(null), 4500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setExportNotice(`Download error: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Save single exam to local repository
  const handleSaveSingleExam = (exam: Exam) => {
    try {
      addDownloadedExamsToRepository([exam]);
      setSavedExamIds((prev) => ({ ...prev, [exam.id]: true }));
      setExportNotice(`Saved "${exam.title || exam.name}" to your Exams Library!`);
      if (onExamsDownloaded) {
        onExamsDownloaded([exam]);
      }
      setTimeout(() => setExportNotice(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setExportNotice(`Save error: ${msg}`);
    }
  };

  // Start practice directly
  const handleStartExamSession = (exam: Exam) => {
    addDownloadedExamsToRepository([exam]);
    setSavedExamIds((prev) => ({ ...prev, [exam.id]: true }));
    if (onExamsDownloaded) {
      onExamsDownloaded([exam]);
    }
    if (onStartExam) {
      onStartExam(exam);
    }
  };

  // Optional offline backup file export (Admin only)
  const handleExportSqliteBundle = async () => {
    if (filteredExams.length === 0) return;
    setIsExporting(true);
    try {
      const durationLabel =
        yearDuration === '1-3' ? '1_3_Yrs' : yearDuration === '1-5' ? '1_5_Yrs' : 'All_Yrs';
      const levelLabel = selectedLevel === 'All' ? 'All_Levels' : `Level_${selectedLevel}`;
      const bundleTitle = `Sinahard_${levelLabel}_${durationLabel}_Pack`;

      const result = await downloadMultiExamSqliteBundle(bundleTitle, filteredExams);
      setExportNotice(
        `Downloaded offline backup file: ${result.fileName} (${(result.sizeBytes / 1024).toFixed(1)} KB)`
      );
      setTimeout(() => setExportNotice(null), 4500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setExportNotice(`Backup export error: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    if (!classLocked) {
      setSelectedLevel('All');
    }
    setSelectedSubject('All');
    setYearDuration('all');
    setSearchQuery('');
  };

  const supabaseLinked = getSupabaseConfig().isConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-[28px] sm:rounded-[32px] liquid-glass text-slate-900 dark:text-white border border-white/75 dark:border-white/15 shadow-2xl overflow-hidden backdrop-blur-2xl">
        {/* ─────────────────────────────────────────────────────────────
            HEADER: UNIFIED DOWNLOAD EXAMS
        ───────────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/60 dark:border-white/10 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02] backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl liquid-glass-subtle text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base sm:text-lg font-['Outfit',sans-serif] text-slate-950 dark:text-white tracking-tight">
                  Download Exams
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {isAdmin
                    ? supabaseLinked
                      ? 'Official Library Connected'
                      : 'Online Library Ready'
                    : 'Works Without Internet'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                Save exams to your phone or computer and practice anytime offline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={syncCloudCatalog}
              disabled={isSyncingCloud}
              className="px-3 py-1.5 rounded-full liquid-glass-btn text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              title="Check for newly added exams"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncingCloud ? 'Updating...' : 'Refresh'}</span>
            </button>

            {isAdmin && onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="px-3 py-1.5 rounded-full liquid-glass-btn text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                title="Admin: Link or manage media storage"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Admin Setup</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full liquid-glass-btn text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SIMPLIFIED FILTER BAR (Level Pills + Search + Subject + Years)
        ───────────────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-white/60 dark:border-white/10 bg-white/30 dark:bg-black/20 space-y-3 shrink-0">
          {/* Row 1: Level Pills (for Admin/Guest) OR Registered Class Indicator (for Registered Student) */}
          {classLocked ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-slate-600 dark:text-zinc-400">Registered Class:</span>
                <span className="font-bold text-slate-950 dark:text-white">
                  {formatClassLevelLabel(studentLockedLevel)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Showing only exams for your registered class
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openRegistrationModal();
                }}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                Change Class
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <div className="flex items-center gap-1.5">
                {LEVEL_FILTERS.map((lvl) => {
                  const isActive = selectedLevel === lvl.id;
                  const isUserGrade = initialLevel !== 'All' && lvl.id === initialLevel;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setSelectedLevel(lvl.id);
                        setSelectedSubject('All');
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                          : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      <span>{lvl.label}</span>
                      {isUserGrade && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Your Grade" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 2: Search + Subject Dropdown + Year Duration Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject, topic, university, or exam title..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-full bg-white/90 dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {/* Subject Select */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3.5 py-2 rounded-full bg-white/90 dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub} value={sub} className="bg-white dark:bg-[#0c182b]">
                    {sub === 'All' ? 'All Subjects' : sub}
                  </option>
                ))}
              </select>

              {/* Year Duration Chips (All / 1-3 Yrs / 1-5 Yrs) */}
              <div className="inline-flex items-center p-0.5 rounded-full liquid-glass-subtle">
                {(['all', '1-3', '1-5'] as YearDurationFilter[]).map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setYearDuration(dur)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                      yearDuration === dur
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dur === 'all' ? 'All Yrs' : dur === '1-3' ? '1–3 Yrs' : '1–5 Yrs'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SCROLLABLE BODY: 1-CLICK SAVE ALL + EXAM CARDS
        ───────────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {/* Status Toast Banner */}
          {exportNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{exportNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setExportNotice(null)}
                className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Compact 1-Click Save All Bar */}
          {filteredExams.length > 0 && (
            <div className="p-4 rounded-2xl liquid-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>
                    {filteredExams.length} {filteredExams.length === 1 ? 'Exam' : 'Exams'} Ready
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-sky-700 dark:text-sky-300">
                    {totalQuestionsInFilter} Total Questions
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Save all shown exams to your library so you can practice anytime without internet.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {isAdmin && (
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleExportSqliteBundle}
                    className="px-3.5 py-2 rounded-full liquid-glass-btn text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer transition disabled:opacity-40"
                    title="Admin: Export filtered exams as an offline backup file"
                  >
                    <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Offline Backup</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadAllMatching}
                  className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-95 active:scale-98 transition disabled:opacity-40"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All ({filteredExams.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Exam Cards List */}
          {filteredExams.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-3xl liquid-glass-subtle space-y-2.5">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto opacity-70" />
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                No exams match your current filters
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                Try switching to All Levels or clearing your search filter.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-1 px-4 py-2 rounded-full liquid-glass-btn text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
              {filteredExams.map((exam) => {
                const isSaved = isExamSaved(exam);
                const isPreviewing = previewExamId === exam.id;
                const levelLabel = getNormalizedLevel(exam);
                const hasFigures = Boolean(
                  exam.hasImages ||
                    exam.questions?.some(
                      (q) => Boolean(q.imageUrl) || (Array.isArray(q.optionImages) && q.optionImages.some(Boolean))
                    )
                );
                const hasTables = Boolean(
                  exam.hasTables || exam.questions?.some((q) => Boolean(q.tableMarkdown))
                );

                return (
                  <div
                    key={exam.id}
                    className="p-4 rounded-[24px] liquid-glass-elevated flex flex-col justify-between gap-3 transition"
                  >
                    <div className="space-y-2">
                      {/* Unboxed Metadata Header */}
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="font-bold text-slate-900 dark:text-white shrink-0">
                            {levelLabel === 'Freshman'
                              ? 'Univ Freshman'
                              : levelLabel === 'Senior University'
                              ? 'Univ Senior'
                              : `Grade ${levelLabel}`}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-sky-700 dark:text-sky-300 truncate">
                            {exam.subject || 'General'}
                          </span>
                          {exam.examYear && (
                            <>
                              <span>·</span>
                              <span className="truncate">{exam.examYear}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasFigures && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                              title="Includes Diagrams / Figures"
                            >
                              <ImageIcon className="w-3 h-3" />
                            </span>
                          )}
                          {hasTables && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400"
                              title="Includes Data Tables"
                            >
                              <TableIcon className="w-3 h-3" />
                            </span>
                          )}
                          <span className="font-bold text-slate-700 dark:text-zinc-300 tabular-nums">
                            {exam.questions?.length || 0} Qs
                          </span>
                        </div>
                      </div>

                      {/* Title & Subtitle */}
                      <div>
                        <h4 className="font-bold text-sm font-['Outfit',sans-serif] text-slate-950 dark:text-white leading-snug">
                          {exam.title || exam.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                          {exam.university && <span>{exam.university}</span>}
                          {exam.topic && <span className="truncate max-w-[200px]">{exam.topic}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{exam.timeLimit || 30}m</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="pt-2.5 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleExam(exam)}
                          className={`px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs hover:opacity-95'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>In Library</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </>
                          )}
                        </button>

                        {onStartExam && (
                          <button
                            type="button"
                            onClick={() => handleStartExamSession(exam)}
                            className="px-3 py-1.5 rounded-full liquid-glass-btn font-bold text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Practice</span>
                          </button>
                        )}
                      </div>

                      {exam.questions && exam.questions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewExamId(isPreviewing ? null : exam.id)}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>{isPreviewing ? 'Hide Q1' : 'Sample Q'}</span>
                          {isPreviewing ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Sample Question Preview */}
                    {isPreviewing && exam.questions && exam.questions.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-200/60 dark:border-white/10 space-y-2 text-xs animate-in fade-in duration-150">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Sample Question (1 of {exam.questions.length})</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/90 dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 space-y-2">
                          <MathRenderer
                            content={exam.questions[0].text}
                            className="font-semibold text-slate-900 dark:text-white"
                          />
                          {exam.questions[0].imageUrl && (
                            <div className="p-2 rounded-xl bg-white border border-slate-200/70 flex justify-center">
                              <img
                                src={exam.questions[0].imageUrl}
                                alt={exam.questions[0].imageCaption || 'Question 1 diagram'}
                                className="max-h-32 w-auto object-contain"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {exam.questions[0].options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`px-2.5 py-1 rounded-xl text-[11px] border ${
                                  idx === exam.questions[0].correct
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold'
                                    : 'bg-slate-50 dark:bg-[#0c182b] border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-zinc-300'
                                }`}
                              >
                                <span className="font-bold mr-1">{String.fromCharCode(65 + idx)}.</span>
                                <MathRenderer content={opt} inline />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

