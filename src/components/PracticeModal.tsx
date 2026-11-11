import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  EyeOff,
  Pause,
  Play,
  X,
  Check,
  CloudOff,
  Shuffle,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exam, ExamAnswerRecord, ExamResult, Question } from '../types';
import { MathRenderer } from './MathRenderer';
import { ConfirmationDialog } from './ConfirmationDialog';
import { MarkdownTableRenderer } from './MarkdownTableRenderer';
import { MediaLightboxModal } from './MediaLightboxModal';
import { useNotifications } from '../context/NotificationContext';
import { isAppOffline } from '../firebase';

interface PracticeModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResult: (result: ExamResult) => void;
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  exam,
  isOpen,
  onClose,
  onSubmitResult,
}) => {
  const { notifyExamCompleted } = useNotifications();

  // Exclusively 6-to-1 batch pagination (6 questions per page vertically, Full View default)
  const [batchPage, setBatchPage] = useState(0); // 0-indexed

  // Dynamic answer choices randomizer (shuffles option A, B, C, D order per session)
  const [shuffleChoices, setShuffleChoices] = useState<boolean>(true);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);

  // Answers & revealed explanations per-question
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});
  const [everRevealedQuestions, setEverRevealedQuestions] = useState<Record<number, boolean>>({});

  // Timer & Pause State
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Submit confirmation dialog
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Lightbox modal for technical diagrams/circuits/images
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string; title?: string } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Scroll ref to top of question container when page/question changes
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const BATCH_SIZE = 6;

  // Prepare session questions with optional choice randomization
  const prepareQuestions = useCallback((sourceExam: Exam, shouldShuffle: boolean): Question[] => {
    return sourceExam.questions.map((q) => {
      if (!shouldShuffle || q.options.length <= 1) {
        return { ...q };
      }
      // Pair each option with whether it is the correct answer and its choice image
      const paired = q.options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.correct,
        image: q.optionImages?.[idx] || null,
      }));

      // Fisher-Yates shuffle
      for (let i = paired.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [paired[i], paired[j]] = [paired[j], paired[i]];
      }

      const shuffledOptions = paired.map((p) => p.text);
      const shuffledOptionImages = paired.map((p) => p.image);
      const newCorrectIndex = paired.findIndex((p) => p.isCorrect);

      return {
        ...q,
        options: shuffledOptions,
        optionImages: shuffledOptionImages,
        correct: newCorrectIndex >= 0 ? newCorrectIndex : 0,
      };
    });
  }, []);

  // Initialize practice session
  useEffect(() => {
    if (isOpen && exam) {
      setBatchPage(0);
      const prepared = prepareQuestions(exam, shuffleChoices);
      setSessionQuestions(prepared);
      setUserAnswers(new Array(prepared.length).fill(null));
      setRevealedQuestions({});
      setEverRevealedQuestions({});
      setTimeLeft(exam.timeLimit * 60);
      setIsPaused(false);
      setShowSubmitConfirm(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, exam, shuffleChoices, prepareQuestions]);

  // Timer countdown
  useEffect(() => {
    if (!isOpen || isPaused || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, timeLeft]);

  // Keyboard shortcut: Space toggles pause
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  /**
   * Question choice rule:
   * Choices are strictly restricted from being clicked/selected if:
   * 1. The user has already selected an option for this question.
   * 2. The user has clicked the explanation button for this question.
   */
  const isQuestionDisabled = useCallback(
    (qIndex: number) => {
      const isAnswered = userAnswers[qIndex] !== null && userAnswers[qIndex] !== undefined;
      const hasClickedExplanation = !!everRevealedQuestions[qIndex] || !!revealedQuestions[qIndex];
      return isAnswered || hasClickedExplanation;
    },
    [userAnswers, revealedQuestions, everRevealedQuestions]
  );

  const handleSelectOption = (qIndex: number, optionIndex: number) => {
    if (isPaused) return;

    // Disabled once chosen or once explanation is clicked
    if (isQuestionDisabled(qIndex)) {
      return;
    }

    const updated = [...userAnswers];
    updated[qIndex] = optionIndex;
    setUserAnswers(updated);
  };

  // Toggle explanation for a specific question (permanently restricts option selecting)
  const handleToggleExplanation = (qIndex: number) => {
    if (isPaused) return;

    setEverRevealedQuestions((prev) => ({
      ...prev,
      [qIndex]: true,
    }));

    setRevealedQuestions((prev) => ({
      ...prev,
      [qIndex]: !prev[qIndex],
    }));
  };

  // 6-to-1 mode navigation (exclusively batches of 6 questions)
  const totalBatchPages = sessionQuestions.length > 0 ? Math.ceil(sessionQuestions.length / BATCH_SIZE) : 0;

  const handleNextBatch = () => {
    if (sessionQuestions.length === 0) return;
    if (batchPage < totalBatchPages - 1) {
      setBatchPage((prev) => prev + 1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const handlePrevBatch = () => {
    if (batchPage > 0) {
      setBatchPage((prev) => prev - 1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  // Jump to specific question from navigator strip
  const handleJumpToQuestion = (targetIdx: number) => {
    if (isPaused) return;
    const targetBatch = Math.floor(targetIdx / BATCH_SIZE);
    setBatchPage(targetBatch);
    setTimeout(() => {
      const el = document.getElementById(`practice-question-${targetIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // Final submission and grading (using sessionQuestions for accurate shuffled option checking)
  const handleFinalSubmit = useCallback(() => {
    if (!exam || sessionQuestions.length === 0) return;

    let correctCount = 0;
    const answerRecords: ExamAnswerRecord[] = sessionQuestions.map((q, i) => {
      const selectedIndex = userAnswers[i];
      const isCorrect = selectedIndex === q.correct;
      if (isCorrect) correctCount++;

      return {
        text: q.text,
        userAnswer:
          selectedIndex !== null && selectedIndex !== undefined
            ? `${String.fromCharCode(65 + selectedIndex)}. ${q.options[selectedIndex]}`
            : 'Not Answered',
        correctAnswer: `${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}`,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const totalQuestions = sessionQuestions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const timeSpent = exam.timeLimit * 60 - timeLeft;

    // Trigger celebration confetti if passed (>= 70%)
    if (percentage >= 70) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }

    // Push notification
    notifyExamCompleted(exam.name, correctCount, totalQuestions, percentage);

    const result: ExamResult = {
      examId: exam.id,
      examTitle: exam.name,
      date: new Date().toISOString(),
      score: correctCount,
      total: totalQuestions,
      percentage,
      timeSpent: Math.max(timeSpent, 0),
      answers: answerRecords,
    };

    setShowSubmitConfirm(false);
    onClose();
    onSubmitResult(result);
  }, [exam, sessionQuestions, userAnswers, timeLeft, notifyExamCompleted, onClose, onSubmitResult]);

  const handleAutoSubmit = useCallback(() => {
    handleFinalSubmit();
  }, [handleFinalSubmit]);

  const isAnyAnswered = userAnswers.some((ans) => ans !== null && ans !== undefined);

  const handleToggleShuffle = () => {
    if (isPaused || isAnyAnswered || !exam) return;
    const nextShuffle = !shuffleChoices;
    setShuffleChoices(nextShuffle);
  };

  if (!isOpen || !exam) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = userAnswers.filter((a) => a !== null).length;
  const progressPct = sessionQuestions.length > 0 ? (answeredCount / sessionQuestions.length) * 100 : 0;

  // Batch slicing for 6-to-1 mode
  const batchStartIdx = batchPage * BATCH_SIZE;
  const batchEndIdx = Math.min(batchStartIdx + BATCH_SIZE, sessionQuestions.length);
  const currentBatchQuestions = sessionQuestions.slice(batchStartIdx, batchEndIdx);

  // Extract inline markdown image ![caption](url) or [IMAGE: url] if present in question text
  const extractQuestionMedia = (q: Question): { cleanText: string; imageUrl?: string; imageCaption?: string } => {
    let text = q.text || '';
    let resolvedUrl = q.imageUrl?.trim();
    let resolvedCaption = q.imageCaption?.trim();

    const mdImgMatch = text.match(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/i);
    if (mdImgMatch) {
      if (!resolvedUrl) resolvedUrl = mdImgMatch[2];
      if (!resolvedCaption && mdImgMatch[1]) resolvedCaption = mdImgMatch[1];
      text = text.replace(mdImgMatch[0], '').trim();
    }

    const tagImgMatch = text.match(/\[(?:IMAGE|DIAGRAM|FIGURE)\s*:\s*(https?:\/\/[^\s\]]+|data:image\/[^\s\]]+)\]/i);
    if (tagImgMatch) {
      if (!resolvedUrl) resolvedUrl = tagImgMatch[1];
      text = text.replace(tagImgMatch[0], '').trim();
    }

    return { cleanText: text, imageUrl: resolvedUrl, imageCaption: resolvedCaption };
  };

  // Helper component to render a single Question Card
  const renderQuestionCard = (q: Question, qIndex: number) => {
    const isAnswered = userAnswers[qIndex] !== null && userAnswers[qIndex] !== undefined;
    const isExplRevealed = !!revealedQuestions[qIndex];
    const isDisabled = isAnswered || isExplRevealed;
    const selectedOpt = userAnswers[qIndex];
    const isChoiceEvaluated = isAnswered || isExplRevealed;
    const { cleanText, imageUrl: resolvedImageUrl, imageCaption: resolvedImageCaption } = extractQuestionMedia(q);
    const imgKey = `q_${qIndex}_${resolvedImageUrl || ''}`;

    return (
      <div
        key={q.id || qIndex}
        id={`practice-question-${qIndex}`}
        className="p-5 sm:p-6 rounded-[28px] liquid-glass-subtle border border-white/80 dark:border-white/10 shadow-xs space-y-4 transition-all text-zinc-900 dark:text-white"
      >
        {/* Card Header: Question Number & Instant Evaluation Pill */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-900 dark:text-white font-bold text-xs flex items-center justify-center border border-zinc-200/60 dark:border-white/10">
              {qIndex + 1}
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
              Question {qIndex + 1} of {sessionQuestions.length}
            </span>
          </div>

          {isAnswered && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                selectedOpt === q.correct
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
              }`}
            >
              {selectedOpt === q.correct ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Correct</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Incorrect • Ans: {String.fromCharCode(65 + q.correct)}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Question Statement */}
        <div className="text-base sm:text-lg font-medium text-zinc-900 dark:text-white leading-relaxed pt-1">
          <MathRenderer content={cleanText} />
        </div>

        {/* Crisp Diagram / Figure Card with Auto-Fit, Dark-Mode Contrast Pad & Click-to-Zoom */}
        {resolvedImageUrl && (
          <div className="pt-1.5">
            {!brokenImages[imgKey] ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  setLightboxImage({
                    url: resolvedImageUrl,
                    caption: resolvedImageCaption,
                    title: `Question ${qIndex + 1} Figure`,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setLightboxImage({
                      url: resolvedImageUrl,
                      caption: resolvedImageCaption,
                      title: `Question ${qIndex + 1} Figure`,
                    });
                  }
                }}
                className="group relative cursor-zoom-in overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/15 liquid-glass-subtle p-2.5 sm:p-3.5 flex flex-col items-center justify-center max-w-2xl mx-auto hover:border-sky-500/50 dark:hover:border-sky-400/40 transition shadow-xs"
              >
                {/* Contrast-Stabilized Inner Pad so dark-line circuits & transparent PNGs stay crisp in Dark Mode */}
                <div className="relative w-full rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/60 dark:border-white/10 p-3 sm:p-4 flex items-center justify-center overflow-hidden">
                  <img
                    src={resolvedImageUrl}
                    alt={resolvedImageCaption || `Question ${qIndex + 1} diagram`}
                    onError={() => setBrokenImages((prev) => ({ ...prev, [imgKey]: true }))}
                    className="max-h-64 sm:max-h-80 w-auto max-w-full object-contain rounded-lg transition duration-200 group-hover:scale-[1.015] bg-white dark:bg-white/95 p-1.5"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-900/85 dark:bg-black/85 text-white text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs shadow-xs pointer-events-none opacity-85 group-hover:opacity-100 transition">
                    <Maximize2 className="w-3 h-3" />
                    <span>Click to Zoom</span>
                  </div>
                </div>

                {resolvedImageCaption && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 font-medium text-center px-3">
                    {resolvedImageCaption}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    Diagram preview unavailable offline{resolvedImageCaption ? `: "${resolvedImageCaption}"` : '.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBrokenImages((prev) => ({ ...prev, [imgKey]: false }))}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-[11px] cursor-pointer transition"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Markdown Structured Data Table (KaTeX supported) */}
        {q.tableMarkdown && (
          <div className="pt-2">
            <MarkdownTableRenderer markdown={q.tableMarkdown} />
          </div>
        )}

        {/* Options List: Immediate Green if Correct, Red if Wrong + Highlight True Answer */}
        <div className="space-y-2.5 pt-1">
          {q.options.map((optText, optIdx) => {
            const isSelected = selectedOpt === optIdx;
            const letter = String.fromCharCode(65 + optIdx);
            const isCorrectOption = q.correct === optIdx;

            let optionCardClasses = '';
            let badgeClasses = '';

            if (isChoiceEvaluated) {
              if (isCorrectOption) {
                optionCardClasses =
                  'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500 text-emerald-950 dark:text-emerald-50 shadow-xs font-semibold ring-1 ring-emerald-500/30';
                badgeClasses = 'bg-emerald-600 text-white shadow-xs';
              } else if (isSelected && !isCorrectOption) {
                optionCardClasses =
                  'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500 text-rose-950 dark:text-rose-50 shadow-xs font-semibold ring-1 ring-rose-500/30';
                badgeClasses = 'bg-rose-600 text-white shadow-xs';
              } else {
                optionCardClasses =
                  'bg-zinc-50/50 dark:bg-[#091322]/40 border-zinc-200/80 dark:border-white/5 opacity-60 text-zinc-500 dark:text-zinc-400';
                badgeClasses =
                  'bg-zinc-100 dark:bg-[#0c182b] text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/10';
              }
            } else {
              optionCardClasses = isDisabled
                ? 'bg-zinc-50/60 dark:bg-[#091322]/40 border-zinc-200/80 dark:border-white/5 text-zinc-500 opacity-60 cursor-not-allowed'
                : 'bg-white dark:bg-[#0f1d33] border-zinc-200/80 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-[#132238] cursor-pointer shadow-2xs';
              badgeClasses =
                'bg-zinc-100 dark:bg-[#0c182b] text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/10';
            }

            return (
              <div
                key={optIdx}
                onClick={() => {
                  if (!isDisabled) {
                    handleSelectOption(qIndex, optIdx);
                  }
                }}
                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-[20px] border transition-all select-none ${
                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.995]'
                } ${optionCardClasses}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${badgeClasses}`}
                >
                  {letter}
                </div>
                <div className="flex-1 text-sm sm:text-base leading-relaxed space-y-2">
                  <MathRenderer content={optText} inline />
                  {q.optionImages?.[optIdx] && (
                    <div className="pt-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImage({
                            url: q.optionImages![optIdx]!,
                            caption: `Option ${letter} Figure`,
                            title: `Question ${qIndex + 1} — Choice ${letter}`,
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setLightboxImage({
                              url: q.optionImages![optIdx]!,
                              caption: `Option ${letter} Figure`,
                              title: `Question ${qIndex + 1} — Choice ${letter}`,
                            });
                          }
                        }}
                        className="inline-flex flex-col items-start p-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-slate-900/95 shadow-2xs hover:border-sky-500 transition cursor-zoom-in"
                      >
                        <img
                          src={q.optionImages[optIdx]!}
                          alt={`Option ${letter} Figure`}
                          className="max-h-28 sm:max-h-32 w-auto object-contain rounded-lg bg-white p-1"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {/* Immediate Right-Side Visual Icon Check / Cross Indicator */}
                {isChoiceEvaluated && isCorrectOption && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {isChoiceEvaluated && isSelected && !isCorrectOption && (
                  <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Correct Answer Shower & Step-by-Step Explanation Content (Rendered ABOVE the button) */}
        {isAnswered && isExplRevealed && (
          <div className="p-4 sm:p-5 rounded-[24px] bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-emerald-500/30 text-zinc-900 dark:text-white space-y-3 animate-in fade-in duration-200">
            {/* Banner Header: Correct Answer Shower */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {String.fromCharCode(65 + q.correct)}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Correct Answer
                  </span>
                  <div className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white">
                    Option {String.fromCharCode(65 + q.correct)}: <MathRenderer content={q.options[q.correct]} inline />
                  </div>
                </div>
              </div>

              {/* Status Comparison Badge */}
              <div className="shrink-0">
                {selectedOpt === q.correct ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Your Choice: Correct ✓
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    Your Choice: Option {String.fromCharCode(65 + (selectedOpt ?? 0))} (Incorrect)
                  </span>
                )}
              </div>
            </div>

            {/* Step-by-Step Solution & LaTeX formulas */}
            <div className="pt-1 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <span>Step-by-step Solution:</span>
              </div>
              <div className="leading-relaxed">
                <MathRenderer
                  content={
                    q.explanation?.trim()
                      ? q.explanation
                      : `The correct option is **${String.fromCharCode(65 + q.correct)}** (${q.options[q.correct]}).`
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Explanation Button: Shown ONLY after a choice is selected, positioned at the bottom-right edge below explanation content */}
        {isAnswered && (
          <div className="pt-2 flex items-center justify-end border-t border-zinc-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => handleToggleExplanation(qIndex)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer transition border shadow-2xs active:scale-98 ${
                isExplRevealed
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-zinc-900 dark:border-white'
                  : 'bg-white dark:bg-[#0f1d33] text-zinc-800 dark:text-zinc-200 border-zinc-200/80 dark:border-white/15 hover:bg-zinc-50 dark:hover:bg-[#132238]'
              }`}
            >
              {isExplRevealed ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Explanation</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Explanation</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-4xl h-[94vh] max-h-[880px] liquid-glass border border-white/70 dark:border-white/15 rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-white backdrop-blur-2xl">
          {/* Header Bar using App Dynamic Theme (Clean, mode buttons eliminated) */}
          <div className="px-5 sm:px-6 py-3.5 border-b border-white/60 dark:border-white/10 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02] backdrop-blur-md flex-wrap text-zinc-900 dark:text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="font-['Outfit',sans-serif] font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                {exam.name}
              </h2>
              {Boolean(isAppOffline() || exam.metadata?.offlineCapped) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-1 shrink-0" title="Offline Free/Guest 20-question cap active">
                  <CloudOff className="w-2.5 h-2.5" />
                  <span>Offline (Max 20)</span>
                </span>
              )}
            </div>

            {/* Right Controls: Shuffle Toggle, Timer & Close Button */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              {/* Dynamic Choice Shuffling Toggle */}
              <button
                type="button"
                onClick={handleToggleShuffle}
                disabled={isAnyAnswered}
                title={
                  isAnyAnswered
                    ? 'Choice order locked once answers are recorded for this session'
                    : 'Toggle dynamic answer randomizer for this practice session'
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border select-none shadow-xs ${
                  isAnyAnswered
                    ? 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-[#0f1d33] border-zinc-200 dark:border-white/10 text-zinc-500'
                    : shuffleChoices
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0f1d33] dark:hover:bg-[#132238] text-zinc-700 dark:text-zinc-200 border-zinc-200/80 dark:border-white/10'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{shuffleChoices ? 'Random Choices' : 'Original Order'}</span>
                <span className="sm:hidden">{shuffleChoices ? 'Random' : 'Original'}</span>
              </button>

              {/* Interactive Timer Button */}
              <button
                type="button"
                onClick={togglePause}
                title="Click or press Space to pause/resume"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border select-none shadow-xs ${
                  isPaused
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse'
                    : timeLeft <= 60
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0f1d33] dark:hover:bg-[#132238] text-zinc-700 dark:text-zinc-200 border-zinc-200/80 dark:border-white/10'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-amber-600 dark:text-amber-400" />
                    <span>PAUSED</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span>{formatTimer(timeLeft)}</span>
                    <Pause className="w-3 h-3 opacity-60 ml-0.5" />
                  </>
                )}
              </button>

              {/* Close / Exit Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#0f1d33] transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-zinc-100 dark:bg-[#0f1d33]">
            <div
              className="h-full bg-zinc-900 dark:bg-white transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Subheader Tracker & Question Navigation Ribbon (Full View at default) */}
          <div className="px-5 sm:px-6 py-2 bg-zinc-50/80 dark:bg-[#0c182b]/90 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Batch {batchPage + 1} of {totalBatchPages} (Questions {batchStartIdx + 1}–{batchEndIdx})
              </span>
            </div>

            {/* Answered Counter */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs">
                Answered: <strong className="text-zinc-900 dark:text-white">{answeredCount}</strong> / {sessionQuestions.length}
              </span>
            </div>
          </div>

          {/* Quick Question Jump Ribbon (Scrollable pills) */}
          <div className="px-5 sm:px-6 py-1.5 bg-white/70 dark:bg-[#070e1a]/90 border-b border-zinc-100 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
              Jump:
            </span>
            {sessionQuestions.map((_, idx) => {
              const isAns = userAnswers[idx] !== null && userAnswers[idx] !== undefined;
              const isExpl = !!revealedQuestions[idx];
              const isInCurrentBatch = idx >= batchStartIdx && idx < batchEndIdx;

              let pillClass = '';
              if (isInCurrentBatch) {
                pillClass = 'ring-2 ring-zinc-950 dark:ring-white font-bold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950';
              } else if (isAns) {
                pillClass = 'bg-zinc-200 dark:bg-[#162742] text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/20 font-semibold';
              } else if (isExpl) {
                pillClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
              } else {
                pillClass = 'bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-[#132238]';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center shrink-0 cursor-pointer transition ${pillClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Main Questions View Area (Exclusively 6-to-1 batch mode) */}
          <div className="flex-1 relative overflow-hidden flex flex-col bg-zinc-50/50 dark:bg-[#070e1a]">
            {/* Scrollable Questions Container */}
            <div
              ref={scrollContainerRef}
              className={`flex-1 overflow-y-auto p-4 sm:p-6 transition-all duration-300 ${
                isPaused ? 'filter blur-md md:blur-lg select-none pointer-events-none opacity-40' : ''
              }`}
            >
              <div className="max-w-3xl mx-auto space-y-6">
                {currentBatchQuestions.map((q, i) => {
                  const actualIdx = batchStartIdx + i;
                  return renderQuestionCard(q, actualIdx);
                })}
              </div>
            </div>

            {/* Anti-Peek Paused Overlay (Active only when paused) */}
            {isPaused && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/60 dark:bg-black/75 backdrop-blur-xs p-6 animate-in fade-in duration-200">
                <div className="max-w-md w-full p-8 rounded-[28px] bg-white/95 dark:bg-[#070e1a]/95 border border-zinc-200 dark:border-white/10 shadow-2xl text-center backdrop-blur-xl text-zinc-900 dark:text-white">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                    <Pause className="w-8 h-8 fill-current" />
                  </div>
                  <h3 className="text-xl font-bold font-['Outfit',sans-serif] text-zinc-900 dark:text-white">
                    Exam Paused
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-1.5 mb-6 leading-relaxed">
                    Questions, equations, and answers are blurred to preserve testing integrity while the clock is stopped.
                  </p>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="w-full py-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition hover:bg-zinc-800 dark:hover:bg-zinc-100"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Exam</span>
                  </button>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2.5">or press Spacebar to resume</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation Controls (Exclusively 6-to-1 batch pagination) */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-white/10 bg-white/90 dark:bg-[#0c182b]/95 backdrop-blur-md flex items-center justify-between gap-2 text-zinc-900 dark:text-white">
            <button
              type="button"
              disabled={batchPage === 0}
              onClick={handlePrevBatch}
              className="px-4 py-2 rounded-full border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-[#132238] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev<span className="hidden sm:inline">ious 6 Questions</span></span>
            </button>

            <div className="hidden sm:flex items-center text-xs text-zinc-500 dark:text-zinc-400">
              Page {batchPage + 1} of {totalBatchPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNextBatch}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98 hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                {batchPage === totalBatchPages - 1 ? (
                  <>
                    <span>Finish<span className="hidden sm:inline"> Exam</span></span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Next<span className="hidden sm:inline"> 6 Questions</span></span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation before submit */}
      <ConfirmationDialog
        isOpen={showSubmitConfirm}
        title="Submit Practice Exam?"
        message={`You have answered ${answeredCount} of ${sessionQuestions.length} questions. Are you ready to submit and calculate your final score?`}
        confirmText="Submit Exam"
        cancelText="Review Questions"
        onConfirm={handleFinalSubmit}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      {/* Media Lightbox Zoom Modal for Diagrams */}
      <MediaLightboxModal
        isOpen={Boolean(lightboxImage)}
        imageUrl={lightboxImage?.url || ''}
        caption={lightboxImage?.caption}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />
    </>
  );
};
