import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Award,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Trash2,
  BookOpen,
  Target,
  TrendingUp,
  Lightbulb,
  Eye,
  Filter,
  Copy,
  Check,
} from 'lucide-react';
import { ExamResult } from '../types';
import { MathRenderer } from './MathRenderer';
import { ConfirmationDialog } from './ConfirmationDialog';
import { copyLatexToClipboard } from '../services/latexClipboardService';

interface ResultsViewProps {
  results: ExamResult[];
  onClearAllResults: () => void;
  onDeleteResult: (idOrIndex: string | number) => void;
  onNavigateToFiles: () => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

const RECENT_LIMIT = 10;

export const ResultsView: React.FC<ResultsViewProps> = ({
  results,
  onClearAllResults,
  onDeleteResult,
  onNavigateToFiles,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<'recent' | 'all' | 'passed' | 'review'>('recent');
  const [onlyMistakesMap, setOnlyMistakesMap] = useState<Record<number, boolean>>({});
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [resultToDelete, setResultToDelete] = useState<string | number | null>(null);
  const [copiedItemKey, setCopiedItemKey] = useState<string | null>(null);

  const handleCopyReviewQuestion = async (ans: any, key: string) => {
    let text = `Question:\n${ans.text}\n\n`;
    text += `Your Answer: ${ans.userAnswer}\n`;
    text += `Correct Answer: ${ans.correctAnswer}\n`;
    if (ans.explanation) {
      text += `\nStep-by-step Solution:\n${ans.explanation}\n`;
    }
    const success = await copyLatexToClipboard(text, 'raw');
    if (success) {
      setCopiedItemKey(key);
      setTimeout(() => setCopiedItemKey(null), 2000);
    }
  };

  const totalExams = results.length;
  const recentCount = Math.min(totalExams, RECENT_LIMIT);

  const avgScore = totalExams
    ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalExams)
    : 0;

  const bestScore = totalExams
    ? Math.max(...results.map((r) => r.percentage || 0))
    : 0;

  const passCount = results.filter((r) => (r.percentage || 0) >= 70).length;
  const passRate = totalExams ? Math.round((passCount / totalExams) * 100) : 0;

  const filteredResults = useMemo(() => {
    return results.map((r, originalIdx) => ({ r, originalIdx })).filter(({ r, originalIdx }) => {
      if (filterMode === 'recent') {
        return originalIdx < RECENT_LIMIT;
      }
      const isPassed = (r.percentage || 0) >= 70;
      if (filterMode === 'passed') return isPassed;
      if (filterMode === 'review') return !isPassed;
      return true;
    });
  }, [results, filterMode]);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const toggleMistakesOnly = (idx: number) => {
    setOnlyMistakesMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-5 pb-20 max-w-4xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ─────────────────────────────────────────────────────────────
          ANALYTICS SUMMARY HEADER (3-Layer Fluid Glass)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] liquid-glass space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl liquid-glass-subtle flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-['Outfit',sans-serif] tracking-tight text-slate-950 dark:text-white">
                Recent Activity &amp; Performance
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Your recent practice test attempts, score progression, and step-by-step question reviews
              </p>
            </div>
          </div>

          {totalExams > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full liquid-glass-subtle text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              title="Clear all records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {totalExams === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl liquid-glass-subtle">
            <Award className="w-9 h-9 text-slate-400 dark:text-zinc-500 mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No attempts recorded yet</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
              Take a practice exam to measure your test readiness and review detailed step-by-step solutions.
            </p>
            <button
              type="button"
              onClick={onNavigateToFiles}
              className="mt-4 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Start an Exam
            </button>
          </div>
        ) : (
          /* Streamlined 4-Metric Grid */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl liquid-glass-subtle">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px] font-medium mb-1">
                <Target className="w-3.5 h-3.5" />
                <span>Attempts</span>
              </div>
              <div className="text-xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                {totalExams}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl liquid-glass-subtle">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px] font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>Average</span>
              </div>
              <div className="text-xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                {avgScore}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl liquid-glass-subtle">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px] font-medium mb-1">
                <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Best Score</span>
              </div>
              <div className="text-xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                {bestScore}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl liquid-glass-subtle">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px] font-medium mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Pass Rate</span>
              </div>
              <div className="text-xl font-bold font-['Outfit',sans-serif] tabular-nums text-slate-950 dark:text-white">
                {passRate}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          EXAM ATTEMPTS LIST WITH FILTERING
      ───────────────────────────────────────────────────────────── */}
      {totalExams > 0 && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Filter:</span>
              <button
                type="button"
                onClick={() => setFilterMode('recent')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  filterMode === 'recent'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                    : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span>Recent ({recentCount})</span>
              </button>
              {(['all', 'passed', 'review'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    filterMode === mode
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                      : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {mode === 'all' && `All (${totalExams})`}
                  {mode === 'passed' && `Passed (${passCount})`}
                  {mode === 'review' && `Needs Review (${totalExams - passCount})`}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
              Showing {filteredResults.length} of {totalExams}
            </span>
          </div>

          {filterMode === 'recent' && totalExams > RECENT_LIMIT && (
            <div className="px-4 py-2 rounded-xl liquid-glass-subtle flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
              <span>Showing your {recentCount} most recent practice sessions.</span>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="font-bold text-slate-900 dark:text-white hover:underline cursor-pointer ml-2"
              >
                View All {totalExams} Records
              </button>
            </div>
          )}

          {/* List of Attempt Cards */}
          <div className="space-y-3">
            {filteredResults.map(({ r: result, originalIdx }) => {
              const isPassed = (result.percentage || 0) >= 70;
              const isExpanded = expandedIndex === originalIdx;
              const mistakesOnly = !!onlyMistakesMap[originalIdx];

              const displayedAnswers = mistakesOnly && result.answers
                ? result.answers.filter((a) => !a.isCorrect)
                : result.answers || [];

              const mistakeCount = result.answers
                ? result.answers.filter((a) => !a.isCorrect).length
                : Math.max(0, (result.total || 0) - (result.score || 0));

              return (
                <div
                  key={result.id || originalIdx}
                  className="rounded-2xl liquid-glass overflow-hidden transition-all"
                >
                  {/* Card Row */}
                  <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Score Badge */}
                      <div
                        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-['Outfit',sans-serif] font-bold text-sm tabular-nums shrink-0 border ${
                          isPassed
                            ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                        }`}
                      >
                        {result.percentage}%
                      </div>

                      {/* Info & Unboxed Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm font-['Outfit',sans-serif] text-slate-950 dark:text-white truncate">
                            {result.examTitle}
                          </h3>
                          <span
                            className={`text-[10px] font-bold ${
                              isPassed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            · {isPassed ? 'Passed' : 'Needs Review'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-1 tabular-nums">
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">
                            {formatRelativeTime(result.date)}
                          </span>
                          <span>·</span>
                          <span>{new Date(result.date).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>{formatTime(result.timeSpent || 0)}</span>
                          <span>·</span>
                          <span>
                            <strong className="text-slate-900 dark:text-white">{result.score}</strong>/{result.total} correct
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => toggleExpand(originalIdx)}
                        className="px-3.5 py-1.5 rounded-full liquid-glass-subtle text-slate-800 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Hide' : 'Review'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setResultToDelete(result.id || originalIdx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Result"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Review */}
                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/60 dark:bg-[#070e1a]/80 space-y-3">
                      {/* Quick filter inside review: Mistakes Only toggle */}
                      {mistakeCount > 0 && (
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-white/10">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                            {mistakesOnly ? `Showing ${displayedAnswers.length} Incorrect Questions` : `Showing all ${displayedAnswers.length} Questions`}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleMistakesOnly(originalIdx)}
                            className="text-xs font-bold text-zinc-900 dark:text-white hover:underline cursor-pointer"
                          >
                            {mistakesOnly ? 'Show All Questions' : `Focus on ${mistakeCount} Mistakes Only`}
                          </button>
                        </div>
                      )}

                      {displayedAnswers.map((ans, aIdx) => (
                        <div
                          key={aIdx}
                          className="p-3.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200/70 dark:border-white/10 space-y-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                                  ans.isCorrect
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                                    : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {ans.isCorrect ? '✓' : '✕'}
                              </div>

                              <div className="flex-1 font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                                <MathRenderer content={ans.text} />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyReviewQuestion(ans, `r-${originalIdx}-a-${aIdx}`)}
                              className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                              title="Copy question, answers & solution as LaTeX"
                              aria-label="Copy question"
                            >
                              {copiedItemKey === `r-${originalIdx}-a-${aIdx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="pl-7 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400 dark:text-zinc-400">Your answer:</span>
                              <span
                                className={`font-semibold ${
                                  ans.isCorrect ? 'text-zinc-900 dark:text-white' : 'text-rose-500 dark:text-rose-400'
                                }`}
                              >
                                <MathRenderer content={ans.userAnswer} inline />
                              </span>
                            </div>

                            {!ans.isCorrect && (
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-400 dark:text-zinc-400">Correct answer:</span>
                                <span className="font-semibold text-zinc-900 dark:text-white">
                                  <MathRenderer content={ans.correctAnswer} inline />
                                </span>
                              </div>
                            )}

                            {ans.explanation && (
                              <div className="mt-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-[#0f1d33] border border-zinc-200/60 dark:border-white/10 text-zinc-700 dark:text-zinc-300">
                                <div className="font-semibold text-[10px] uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-0.5">
                                  <Lightbulb className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                                  <span>Step-by-step Solution:</span>
                                </div>
                                <MathRenderer content={ans.explanation} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showClearAllConfirm}
        title="Clear All History?"
        message="This will permanently delete all completed exam records from your device."
        confirmText="Clear History"
        isDestructive
        onConfirm={() => {
          onClearAllResults();
          setShowClearAllConfirm(false);
        }}
        onCancel={() => setShowClearAllConfirm(false)}
      />

      {/* Delete Single Result Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={resultToDelete !== null}
        title="Delete Result?"
        message="Remove this test attempt record?"
        confirmText="Delete"
        isDestructive
        onConfirm={() => {
          if (resultToDelete !== null) {
            onDeleteResult(resultToDelete);
            setResultToDelete(null);
          }
        }}
        onCancel={() => setResultToDelete(null)}
      />
    </div>
  );
};
