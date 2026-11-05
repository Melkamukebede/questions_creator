import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Database,
  Filter,
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Table as TableIcon,
  Play,
  Loader2,
  Building2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { Exam, ETHIOPIAN_UNIVERSITIES, FRESHMAN_SUBJECTS, SECONDARY_SUBJECTS, YearDurationFilter } from '../types';
import { downloadMultiExamSqliteBundle, downloadExamSqliteFile } from '../services/sqliteService';
import { CURATED_OFFICIAL_EXAMS } from '../services/supabaseService';

interface DownloadCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allExams: Exam[];
  userAcademicYear?: string; // e.g. 'Freshman'
  userUniversity?: string;
  onStartExam?: (exam: Exam) => void;
  onOpenSupabaseConfig?: () => void;
}

export const DownloadCenterModal: React.FC<DownloadCenterModalProps> = ({
  isOpen,
  onClose,
  allExams,
  userAcademicYear = 'Freshman',
  userUniversity,
  onStartExam,
  onOpenSupabaseConfig,
}) => {
  // Merge prop exams with curated official exams (deduplicated by ID)
  const combinedExams = useMemo(() => {
    const map = new Map<string, Exam>();
    for (const ex of CURATED_OFFICIAL_EXAMS) {
      map.set(ex.id, ex);
    }
    for (const ex of allExams) {
      map.set(ex.id, ex);
    }
    return Array.from(map.values());
  }, [allExams]);

  // Catalog Level: 'university' or 'secondary'
  const isFreshmanUser = userAcademicYear?.toLowerCase().includes('freshman');
  const [selectedTier, setSelectedTier] = useState<'university' | 'secondary'>(
    isFreshmanUser ? 'university' : 'secondary'
  );

  // Filters state
  const [selectedUniversity, setSelectedUniversity] = useState<string>(userUniversity || 'All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedSemester, setSelectedSemester] = useState<'All' | 'Semester 1' | 'Semester 2'>('All');
  const [selectedExamType, setSelectedExamType] = useState<string>('All');
  const [yearDuration, setYearDuration] = useState<YearDurationFilter>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Compute filtered exams
  const filteredExams = useMemo(() => {
    return combinedExams.filter((exam) => {
      // 1. Tier Filter
      const examTier = exam.tier || (exam.university || exam.grade === 'Freshman' ? 'university' : 'secondary');
      if (selectedTier !== examTier) return false;

      // 2. University Filter (if university tier)
      if (selectedTier === 'university' && selectedUniversity !== 'All') {
        const matchesUni = (exam.university || '').toLowerCase().includes(selectedUniversity.toLowerCase());
        if (!matchesUni) return false;
      }

      // 3. Subject Filter
      if (selectedSubject !== 'All') {
        const sub = (exam.subject || '').toLowerCase();
        const targetSub = selectedSubject.toLowerCase();
        if (!sub.includes(targetSub) && !targetSub.includes(sub)) return false;
      }

      // 4. Semester Filter
      if (selectedSemester !== 'All') {
        if (exam.semester && exam.semester !== 'All' && exam.semester !== selectedSemester) return false;
      }

      // 5. Exam Type Filter (Mid vs Final)
      if (selectedExamType !== 'All') {
        const type = (exam.examType || '').toLowerCase();
        const targetType = selectedExamType.toLowerCase();
        if (!type.includes(targetType)) return false;
      }

      // 6. Year Duration Filter
      const rawYear = String(exam.examYear || '');
      const yearNum = parseInt(rawYear.replace(/[^0-9]/g, '').slice(0, 4) || '2024', 10);
      const currentEcyear = 2017; // Current Ethiopian year reference
      const currentGcyear = 2025;
      const isEc = yearNum <= 2020;
      const refYear = isEc ? currentEcyear : currentGcyear;
      const diff = Math.max(0, refYear - yearNum);

      if (yearDuration === '1-3') {
        if (diff > 3) return false;
      } else if (yearDuration === '1-5') {
        if (diff > 5) return false;
      }

      return true;
    });
  }, [combinedExams, selectedTier, selectedUniversity, selectedSubject, selectedSemester, selectedExamType, yearDuration]);

  // Aggregate stats
  const totalQuestionsInFilter = useMemo(() => {
    return filteredExams.reduce((sum, e) => sum + (e.questions?.length || 0), 0);
  }, [filteredExams]);

  const estimatedBundleSizeKb = useMemo(() => {
    return Math.max(45, totalQuestionsInFilter * 4.2).toFixed(0);
  }, [totalQuestionsInFilter]);

  if (!isOpen) return null;

  // Handle full bundle download
  const handleDownloadFilteredBundle = async () => {
    if (filteredExams.length === 0) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      const durationLabel = yearDuration === '1-3' ? 'Past_1_3_Years' : yearDuration === '1-5' ? 'Past_1_5_Years' : 'All_Years';
      const levelLabel = selectedTier === 'university' ? 'University_Freshman' : 'Secondary_Matric';
      const bundleTitle = `SinaHard_${levelLabel}_${durationLabel}_Bundle`;

      const result = await downloadMultiExamSqliteBundle(bundleTitle, filteredExams);
      setExportNotice(`SQLite Bundle downloaded: ${result.fileName} (${(result.sizeBytes / 1024).toFixed(1)} KB) containing ${result.examCount} exams and ${result.questionCount} questions!`);
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bundle compilation failed';
      setExportNotice(`Export error: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle single exam download
  const handleDownloadSingleExam = async (exam: Exam) => {
    try {
      const res = await downloadExamSqliteFile(
        exam.title || exam.name,
        exam.subject,
        String(exam.grade || 'Freshman'),
        exam.stream || 'Natural Science',
        exam.questions
      );
      setExportNotice(`Exam downloaded: ${res.fileName} (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to download exam';
      setExportNotice(`Export error: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-[28px] sm:rounded-[32px] bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/80 dark:bg-[#070e1a]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  Exam Repository &amp; Offline Download Center
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  SQLite .sqlite Vault
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official University &amp; Secondary exams with diagrams, tables, and multi-year bundles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-[#132238] text-zinc-700 dark:text-zinc-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border border-zinc-200 dark:border-white/10"
                title="Configure Supabase Cloud Media Storage"
              >
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Supabase Storage</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body with Filters and Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          
          {/* Level Switcher (University vs Secondary) */}
          <div className="p-1 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setSelectedTier('university');
                setSelectedSubject('All');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                selectedTier === 'university'
                  ? 'bg-white dark:bg-[#0c182b] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span>University &amp; Freshman Exams</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTier('secondary');
                setSelectedSubject('All');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                selectedTier === 'secondary'
                  ? 'bg-white dark:bg-[#0c182b] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <span>Secondary High School (Grades 7–12 &amp; ESSLCE)</span>
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/5 pb-2">
              <span className="font-bold text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                <span>Search &amp; Year Duration Filters</span>
              </span>

              {/* Year Duration Chips */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-400 mr-1 hidden sm:inline">Duration:</span>
                {(['all', '1-3', '1-5'] as YearDurationFilter[]).map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setYearDuration(dur)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      yearDuration === dur
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                        : 'bg-white dark:bg-[#0c182b] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5 hover:text-zinc-900'
                    }`}
                  >
                    {dur === 'all' ? 'All Years' : dur === '1-3' ? 'Past 1–3 Yrs' : 'Past 1–5 Yrs'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              
              {/* University Selector (Only in University Tier) */}
              {selectedTier === 'university' && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    University / College
                  </label>
                  <select
                    value={selectedUniversity}
                    onChange={(e) => setSelectedUniversity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="All">All Ethiopian Universities</option>
                    {ETHIOPIAN_UNIVERSITIES.map((uni) => (
                      <option key={uni} value={uni}>
                        {uni}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Selector */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Subject / Course
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-hidden"
                >
                  <option value="All">All Subjects</option>
                  {(selectedTier === 'university' ? FRESHMAN_SUBJECTS : SECONDARY_SUBJECTS).map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Selector */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as 'All' | 'Semester 1' | 'Semester 2')}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-hidden"
                >
                  <option value="All">All Semesters</option>
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                </select>
              </div>

              {/* Exam Type (Mid vs Final) */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Exam Type
                </label>
                <select
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-hidden"
                >
                  <option value="All">All (Mid &amp; Finals)</option>
                  <option value="Mid">Mid Exam Only</option>
                  <option value="Final">Final Exam Only</option>
                  <option value="National">National Matric Only</option>
                </select>
              </div>

            </div>
          </div>

          {/* Export Status Notice */}
          {exportNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{exportNotice}</span>
            </div>
          )}

          {/* Bundle Summary Card & 1-Click SQLite Batch Download */}
          <div className="p-4 sm:p-5 rounded-[24px] bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  Batch Multi-Year Bundler
                </span>
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  {filteredExams.length} Exams &bull; {totalQuestionsInFilter} Questions &bull; ~{estimatedBundleSizeKb} KB
                </span>
              </div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white font-['Outfit',sans-serif]">
                Compiled Offline SQLite Binary ({yearDuration === 'all' ? 'All Years' : yearDuration === '1-3' ? 'Past 1–3 Years' : 'Past 1–5 Years'})
              </h4>
              <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400">
                Packs all matching exams with diagrams, tables, and step-by-step solutions into a single portable <code className="font-mono text-zinc-800 dark:text-zinc-200">.sqlite</code> database file for offline study.
              </p>
            </div>

            <button
              type="button"
              disabled={isExporting || filteredExams.length === 0}
              onClick={handleDownloadFilteredBundle}
              className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition disabled:opacity-50 shrink-0"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compiling SQLite...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Download SQLite Bundle</span>
                </>
              )}
            </button>
          </div>

          {/* Exam Cards Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900 dark:text-white">
                Available Exams in Vault ({filteredExams.length})
              </span>
              <span className="text-[11px] text-zinc-400">
                Includes KaTeX Formulas, Schematics &amp; Tables
              </span>
            </div>

            {filteredExams.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-2">
                <Database className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                  No exams match the selected filter combination
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Try changing your University, Semester, or Year duration filter above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-3 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-white/20 transition shadow-2xs"
                  >
                    <div className="space-y-2">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          {exam.examYear || '2016 E.C.'}
                        </span>

                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                          {exam.hasImages && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Contains Diagrams & Schematics">
                              <ImageIcon className="w-3 h-3" />
                              <span>Diagrams</span>
                            </span>
                          )}
                          {exam.hasTables && (
                            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400" title="Contains Markdown Tables">
                              <TableIcon className="w-3 h-3" />
                              <span>Tables</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Subject */}
                      <div>
                        <h4 className="font-bold text-xs text-zinc-900 dark:text-white leading-snug">
                          {exam.title || exam.name}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {exam.university && (
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {exam.university} &bull;
                            </span>
                          )}
                          <span>{exam.semester || 'Semester 1'} &bull;</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {exam.examType || 'Final'}
                          </span>
                        </div>
                      </div>

                      {/* Question Count & Time */}
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{exam.questions?.length || 0} Questions</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{exam.timeLimit || 60} mins</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/80 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleExam(exam)}
                        className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Download single exam SQLite file"
                      >
                        <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>.sqlite File</span>
                      </button>

                      {onStartExam && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartExam(exam);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-98"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Practice Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/80 dark:bg-[#070e1a]/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>
              WebAssembly SQLite Engine &bull; Zero internet required once downloaded
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c182b] text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
