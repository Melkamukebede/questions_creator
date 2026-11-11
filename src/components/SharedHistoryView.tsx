import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Trash2,
  Play,
  Search,
  ExternalLink,
  GraduationCap,
  Clock,
  HelpCircle,
  Link,
  CheckCircle2,
  Inbox,
  Send,
  Loader2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { Exam } from '../types';
import {
  SharedHistoryItem,
  getSharedHistory,
  deleteFromSharedHistory,
  clearSharedHistory,
  addToSharedHistory,
  generateExamShareText,
} from '../services/sharedHistoryService';
import { resolveExamForPractice, extractTargetExamId, deleteExamFromCloud, isUserPrivileged, MAX_USER_SHARED_EXAMS } from '../services/shareService';
import { saveExamToDb } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface SharedHistoryViewProps {
  onStartPractice: (exam: Exam) => void;
  onNavigateToFiles: () => void;
  onShowToast?: (msg: string) => void;
  exams?: Exam[];
}

export const SharedHistoryView: React.FC<SharedHistoryViewProps> = ({
  onStartPractice,
  onNavigateToFiles,
  onShowToast,
  exams = [],
}) => {
  const { user, openRegistrationModal } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isStudentLoggedIn = Boolean(user && user.uid !== 'guest' && !user.isAnonymous);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    onShowToast?.(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [historyItems, setHistoryItems] = useState<SharedHistoryItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'shared_by_me' | 'accessed_by_me'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);

  // Access by Code / Link State (Way 2: Direct Code Access)
  const [inputCodeOrLink, setInputCodeOrLink] = useState('');
  const [isAccessing, setIsAccessing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<SharedHistoryItem | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Load history on mount
  const refreshHistory = () => {
    setHistoryItems(getSharedHistory());
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  // Handle Accessing an exam by ID or pasted link
  const handleAccessExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isStudentLoggedIn) {
      setAccessError('Login first to access the exams');
      showToast('Login first to access the exams');
      openRegistrationModal();
      return;
    }

    const rawInput = inputCodeOrLink.trim();
    if (!rawInput) {
      setAccessError('Please enter an Exam Code or paste a Sinahard link.');
      return;
    }

    setAccessError(null);
    setIsAccessing(true);

    try {
      // Extract exam ID if input is a URL or full specification text
      let targetId = rawInput;
      if (rawInput.includes('?id=')) {
        try {
          const urlObj = new URL(rawInput);
          targetId = urlObj.searchParams.get('id') || rawInput;
        } catch {
          const match = rawInput.match(/[?&]id=([^&\s]+)/);
          if (match && match[1]) targetId = decodeURIComponent(match[1]);
        }
      } else if (rawInput.includes('exam_')) {
        const match = rawInput.match(/(exam_\d+)/);
        if (match && match[1]) targetId = match[1];
      }

      targetId = targetId.trim();

      const resolvedExam = await resolveExamForPractice(targetId, {
        currentExams: exams,
      });

      if (!resolvedExam || !resolvedExam.questions || resolvedExam.questions.length === 0) {
        setAccessError(
          `Exam "${targetId}" not found. Verify the code or link and make sure you're connected.`
        );
        setIsAccessing(false);
        return;
      }

      // Save to user database
      try {
        await saveExamToDb(resolvedExam, user);
      } catch (err) {
        console.warn('Failed saving accessed exam to local DB:', err);
      }

      // Add to accessed shared history
      addToSharedHistory(resolvedExam, 'accessed_by_me');
      refreshHistory();
      setInputCodeOrLink('');
      setIsAccessing(false);

      showToast(`🎯 Loaded "${resolvedExam.name}" into your exams!`);
      // Start practice
      onStartPractice(resolvedExam);
    } catch (err: any) {
      setIsAccessing(false);
      setAccessError(err.message || 'Unable to access shared exam. Please try again.');
    }
  };

  // Copy standard link
  const handleCopyLink = async (item: SharedHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.shareUrl);
      setCopiedId(item.id);
      showToast('Link copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback
    }
  };

  // Copy full specification text
  const handleCopySpec = async (item: SharedHistoryItem) => {
    const matchedExam = exams.find((e) => e.id === item.examId || e.catalogId === item.examId);
    let textToCopy = '';
    if (matchedExam) {
      textToCopy = generateExamShareText(matchedExam);
    } else {
      textToCopy = `📌 Sinahard Exam Specification
━━━━━━━━━━━━━━━━━━━━━━━━━━━
•Title: ${item.title}
• Level: ${item.grade}
• Subject: ${item.subject}
• Topic: ${item.topic}
• Duration: ${item.duration} Minutes
• Questions: ${item.questionsCount} Multiple-Choice Questions
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 Practice this exam on Sinahard:
${item.shareUrl}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSpecId(item.id);
      showToast('📌 Exam Specification copied!');
      setTimeout(() => setCopiedSpecId(null), 2500);
    } catch {
      // fallback
    }
  };

  const isPrivilegedUser = isUserPrivileged(user);

  // Delete an item from history (and remove from Cloud Firestore if shared by user)
  const handleDeleteItem = async (item: SharedHistoryItem) => {
    if (item.type === 'shared_by_me') {
      try {
        await deleteExamFromCloud(item.examId);
      } catch (err) {
        console.warn('Could not delete from Cloud Firestore:', err);
      }
    }
    deleteFromSharedHistory(item.id);
    refreshHistory();
    setItemToDelete(null);
    showToast(item.type === 'shared_by_me' ? 'Removed from shared exams (sharing slot freed).' : 'Removed from shared history.');
  };

  // Clear all
  const handleClearAll = () => {
    clearSharedHistory();
    refreshHistory();
    setIsClearingAll(false);
    showToast('Shared history cleared.');
  };

  // Filter items
  const filteredItems = historyItems.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.examId.toLowerCase().includes(q) ||
        item.grade.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sharedByMeCount = historyItems.filter((i) => i.type === 'shared_by_me').length;
  const accessedCount = historyItems.filter((i) => i.type === 'accessed_by_me').length;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto font-['Plus_Jakarta_Sans',sans-serif] text-zinc-900 dark:text-zinc-100">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-[32px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 shadow-xs relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
                <Share2 className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-['Outfit',sans-serif] text-zinc-900 dark:text-white">
                Shared Exam History
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Track exams you have shared with classmates, access shared test links from other students, and launch instant practice sessions.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 text-center">
              <div className="text-[10px] font-bold uppercase text-zinc-400">Shared by You</div>
              <div className="text-base font-bold text-zinc-900 dark:text-white">{sharedByMeCount}</div>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 text-center">
              <div className="text-[10px] font-bold uppercase text-zinc-400">Sharing Slots</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {isPrivilegedUser ? 'Unlimited' : `${sharedByMeCount} / ${MAX_USER_SHARED_EXAMS}`}
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 text-center">
              <div className="text-[10px] font-bold uppercase text-zinc-400">Accessed</div>
              <div className="text-base font-bold text-zinc-900 dark:text-white">{accessedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. ACCESS SHARED EXAM INPUT (Way 2: Enter Code or Paste Link)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-[28px] bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-[#0c182b] dark:via-[#070e1a] dark:to-[#0c182b] border border-zinc-200/90 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif]">
                Access a Shared Exam
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Enter an Exam Code (e.g. <code className="text-[11px] font-mono font-bold text-zinc-800 dark:text-zinc-200">exam_1791170263655</code>) or paste a shared Sinahard link:
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAccessExam} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputCodeOrLink}
              onChange={(e) => {
                setInputCodeOrLink(e.target.value);
                if (accessError) setAccessError(null);
              }}
              placeholder="Paste link or type Exam Code (e.g. exam_1791170263655)..."
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white shadow-2xs font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isAccessing || !inputCodeOrLink.trim()}
            className="px-6 py-3 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shrink-0"
          >
            {isAccessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading Exam...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Access & Practice</span>
              </>
            )}
          </button>
        </form>

        {accessError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{accessError}</span>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CONTROLS BAR: SEARCH, TABS, CLEAR ALL
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'all'
                ? 'bg-white dark:bg-[#070e1a] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            All ({historyItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('shared_by_me')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'shared_by_me'
                ? 'bg-white dark:bg-[#070e1a] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Shared by Me ({sharedByMeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('accessed_by_me')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'accessed_by_me'
                ? 'bg-white dark:bg-[#070e1a] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Accessed ({accessedCount})
          </button>
        </div>

        {/* Search & Clear All */}
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shared history..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
            />
          </div>

          {historyItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearingAll(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Clear all history records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. HISTORY LIST
      ───────────────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-[32px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] text-zinc-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif]">
            No Shared Exams Found
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? 'No history matches your search query.'
              : 'Share any local exam from the "Files" tab, or enter a classmate\'s exam code above to practice it.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToFiles}
              className="px-4 py-2 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold transition hover:opacity-90 active:scale-95 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Go to My Exams</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isSharedByMe = item.type === 'shared_by_me';
            const matchedExam = exams.find((e) => e.id === item.examId || e.catalogId === item.examId);

            return (
              <div
                key={item.id}
                className="p-5 sm:p-6 rounded-[28px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Card Top: Badges & Delete Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSharedByMe
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {isSharedByMe ? <Send className="w-2.5 h-2.5" /> : <Inbox className="w-2.5 h-2.5" />}
                        <span>{isSharedByMe ? 'Shared by You' : 'Shared with You'}</span>
                      </span>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#070e1a] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                        {item.grade}
                      </span>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#070e1a] text-zinc-600 dark:text-zinc-300">
                        {item.subject}
                      </span>
                    </div>

                    {/* DELETE BUTTON: Required by user: "and make it add delete button to it" */}
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer active:scale-95 shrink-0"
                      title="Delete from shared history"
                      aria-label="Delete exam from shared history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif] leading-snug">
                    {item.title}
                  </h3>

                  {/* Specification Details (Topic, Duration, Questions) */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/60 dark:border-white/5">
                      <div className="flex items-center justify-center gap-1 text-zinc-400 text-[9px] uppercase font-bold">
                        <HelpCircle className="w-2.5 h-2.5" />
                        <span>Questions</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 block">
                        {item.questionsCount} Qs
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/60 dark:border-white/5">
                      <div className="flex items-center justify-center gap-1 text-zinc-400 text-[9px] uppercase font-bold">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Duration</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 block">
                        {item.duration}m
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/60 dark:border-white/5">
                      <div className="flex items-center justify-center gap-1 text-zinc-400 text-[9px] uppercase font-bold">
                        <GraduationCap className="w-2.5 h-2.5" />
                        <span>Level</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5 block truncate">
                        {item.grade}
                      </span>
                    </div>
                  </div>

                  {/* Topic */}
                  {item.topic && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate pt-1">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Topic:</span> {item.topic}
                    </div>
                  )}

                  {/* Exam Code Pill */}
                  <div className="p-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/70 dark:border-white/10 flex items-center justify-between text-xs font-mono text-zinc-700 dark:text-zinc-300">
                    <span className="text-[10px] uppercase font-sans font-bold text-zinc-400">Exam ID:</span>
                    <span className="truncate max-w-[200px] select-all font-semibold">{item.examId}</span>
                  </div>
                </div>

                {/* Card Bottom: Action Buttons */}
                <div className="pt-2 border-t border-zinc-100 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* Copy Specification Snippet Button */}
                    <button
                      type="button"
                      onClick={() => handleCopySpec(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#070e1a] hover:bg-zinc-200 dark:hover:bg-[#132238] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Copy full exam specification with emoji header"
                    >
                      {copiedSpecId === item.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Copy Spec</span>
                        </>
                      )}
                    </button>

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-[#070e1a] hover:bg-zinc-200 dark:hover:bg-[#132238] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Copy short practice link"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Link className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Practice Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isStudentLoggedIn) {
                        showToast('Login first to access the exams');
                        openRegistrationModal();
                        return;
                      }

                      if (matchedExam && matchedExam.questions && matchedExam.questions.length > 0) {
                        onStartPractice(matchedExam);
                      } else {
                        // Resolve exam and launch
                        try {
                          showToast(`Loading "${item.title}"...`);
                          const resolved = await resolveExamForPractice(item.examId, { currentExams: exams });
                          if (resolved) {
                            onStartPractice(resolved);
                          } else {
                            showToast('Could not load exam data. Please check connection.');
                          }
                        } catch {
                          showToast('Unable to launch practice mode.');
                        }
                      }
                    }}
                    className="px-4 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 hover:opacity-90 ml-auto"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. DELETE CONFIRMATION DIALOG
      ───────────────────────────────────────────────────────────── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif]">
                Delete from Shared History?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Remove <span className="font-semibold text-zinc-800 dark:text-zinc-200">"{itemToDelete.title}"</span> from your shared history list?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition cursor-pointer hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(itemToDelete)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. CLEAR ALL CONFIRMATION DIALOG
      ───────────────────────────────────────────────────────────── */}
      {isClearingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif]">
                Clear Entire Shared History?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                This will remove all {historyItems.length} records from your shared list. (Exams saved in your library will not be deleted).
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearingAll(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition cursor-pointer hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
