import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  MessageCircle,
  GraduationCap,
  Clock,
  HelpCircle,
  Layers,
  Tag,
  Play,
  CheckCircle2,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { Exam, AppUser } from '../types';
import {
  publishExamForCloudSharing,
  getUserCloudSharedExams,
  deleteExamFromCloud,
  isUserPrivileged,
  MAX_USER_SHARED_EXAMS,
  UserCloudExamItem,
} from '../services/shareService';
import {
  generateExamShareText,
  addToSharedHistory,
  DEFAULT_PRODUCTION_DOMAIN,
} from '../services/sharedHistoryService';
import { useAuth } from '../context/AuthContext';

interface ShareExamModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onStartPractice?: (exam: Exam) => void;
  user?: AppUser | null;
}

export const ShareExamModal: React.FC<ShareExamModalProps> = ({
  exam,
  isOpen,
  onClose,
  onStartPractice,
  user: propUser,
}) => {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;
  const isPrivileged = isUserPrivileged(currentUser);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [nativeShareSuccess, setNativeShareSuccess] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>('idle');
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  // Cloud Storage Quota & Shared Exams Management
  const [userSharedExams, setUserSharedExams] = useState<UserCloudExamItem[]>([]);
  const [isLoadingSharedExams, setIsLoadingSharedExams] = useState<boolean>(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showManageShared, setShowManageShared] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Default to active origin so test and practice links work immediately
  const [domainMode, setDomainMode] = useState<'active' | 'production'>('active');

  const compactExamId = exam ? (exam.catalogId || exam.id).trim() : '';
  const productionLink = `${DEFAULT_PRODUCTION_DOMAIN}/?id=${encodeURIComponent(compactExamId)}`;
  
  const activeOrigin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : DEFAULT_PRODUCTION_DOMAIN;
  const currentOriginLink = `${activeOrigin}/?id=${encodeURIComponent(compactExamId)}`;
  const isDifferentOrigin = activeOrigin !== DEFAULT_PRODUCTION_DOMAIN;

  // Active link is default; production link is optional toggle
  const shortLink = domainMode === 'production' ? productionLink : currentOriginLink;

  // Formatted exam specification text snippet
  const specSnippet = exam ? generateExamShareText(exam, domainMode) : '';

  const isCurrentExamInCloud = userSharedExams.some((e) => e.id === compactExamId);
  const isStorageLimitReached = !isPrivileged && userSharedExams.length >= MAX_USER_SHARED_EXAMS && !isCurrentExamInCloud;

  // Fetch current user's shared exams from cloud & local history
  const fetchUserSharedExams = useCallback(async () => {
    setIsLoadingSharedExams(true);
    try {
      const items = await getUserCloudSharedExams(currentUser);
      setUserSharedExams(items);
      return items;
    } catch (err) {
      console.warn('Failed loading user shared exams:', err);
      return [];
    } finally {
      setIsLoadingSharedExams(false);
    }
  }, [currentUser]);

  // Publish to Cloud Firestore
  const handlePublishToCloud = useCallback(async (forced?: boolean) => {
    if (!exam) return;

    // Check if limit is reached before calling publish
    if (!isPrivileged && !forced) {
      const currentList = await getUserCloudSharedExams(currentUser);
      setUserSharedExams(currentList);
      const isAlreadyInCloud = currentList.some((e) => e.id === compactExamId);
      if (!isAlreadyInCloud && currentList.length >= MAX_USER_SHARED_EXAMS) {
        setCloudSyncStatus('error');
        setCloudSyncError(
          `Sharing limit reached (${currentList.length}/${MAX_USER_SHARED_EXAMS}). Remove one of your shared exams below to share this exam.`
        );
        setShowManageShared(true);
        return;
      }
    }

    setCloudSyncStatus('syncing');
    setCloudSyncError(null);

    const result = await publishExamForCloudSharing(exam, currentUser);
    if (result.success) {
      setCloudSyncStatus('ready');
      addToSharedHistory(exam, 'shared_by_me', shortLink);
      fetchUserSharedExams();
    } else {
      setCloudSyncStatus('error');
      setCloudSyncError(result.error || 'Failed to prepare share link.');
      if (result.error?.includes('limit reached')) {
        setShowManageShared(true);
      }
    }
  }, [exam, currentUser, isPrivileged, compactExamId, shortLink, fetchUserSharedExams]);

  // Load shared exams and publish when modal opens
  useEffect(() => {
    if (isOpen && exam) {
      fetchUserSharedExams().then((items) => {
        const isAlreadyInCloud = items.some((e) => e.id === compactExamId);
        if (!isPrivileged && items.length >= MAX_USER_SHARED_EXAMS && !isAlreadyInCloud) {
          setCloudSyncStatus('error');
          setCloudSyncError(
            `Sharing limit reached (${items.length}/${MAX_USER_SHARED_EXAMS}). Remove one of your shared exams below to share this exam.`
          );
          setShowManageShared(true);
        } else {
          handlePublishToCloud();
        }
      });
    }
  }, [isOpen, exam?.id, handlePublishToCloud, fetchUserSharedExams, compactExamId, isPrivileged]);

  // Delete a shared exam to free up a sharing slot
  const handleDeleteSharedExam = async (examIdToDelete: string) => {
    setIsDeletingId(examIdToDelete);
    setActionNotice(null);
    try {
      const res = await deleteExamFromCloud(examIdToDelete);
      if (res.success) {
        setActionNotice('Exam removed from active sharing! Slot freed.');
        const updatedList = await fetchUserSharedExams();
        // If we were waiting to share the current exam because of the limit, publish it now
        if (
          !isCurrentExamInCloud &&
          (cloudSyncStatus === 'error' || updatedList.length < MAX_USER_SHARED_EXAMS)
        ) {
          setActionNotice('Slot freed! Generating share link for this exam...');
          await handlePublishToCloud(true);
        }
      } else {
        setActionNotice(`Failed to remove: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setActionNotice(`Failed to remove exam: ${err.message || 'Error'}`);
    } finally {
      setIsDeletingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Unshare the current exam
  const handleUnshareCurrentExam = async () => {
    if (!compactExamId) return;
    setIsDeletingId(compactExamId);
    setActionNotice(null);
    try {
      const res = await deleteExamFromCloud(compactExamId);
      if (res.success) {
        setActionNotice('Exam unshared. Link disabled.');
        setCloudSyncStatus('idle');
        fetchUserSharedExams();
      } else {
        setActionNotice(`Failed to unshare: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message || 'Failed'}`);
    } finally {
      setIsDeletingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  if (!isOpen || !exam) return null;

  // Extract clean grade label
  const gradeLabel = (() => {
    if (exam.grade !== undefined && exam.grade !== null && String(exam.grade).trim() !== '') {
      const g = String(exam.grade).trim();
      return g.toLowerCase().startsWith('grade') ? g : `Grade ${g}`;
    }
    const match = exam.name.match(/grade\s*(\d{1,2})/i) || exam.name.match(/g(\d{1,2})/i);
    if (match) return `Grade ${match[1]}`;
    if (/freshman|university|college/i.test(exam.name)) return 'Grade Freshman';
    return 'General';
  })();

  const topicLabel = exam.topic?.trim() || exam.metadata?.topic?.trim() || exam.description?.trim() || exam.name;
  const questionCount = exam.questions?.length || 0;
  const streamLabel = exam.stream || exam.metadata?.stream || 'General';

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shortLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shortLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Copy specification snippet handler
  const handleCopySpec = async () => {
    try {
      await navigator.clipboard.writeText(specSnippet);
      setCopiedSpec(true);
      setTimeout(() => setCopiedSpec(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = specSnippet;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedSpec(true);
      setTimeout(() => setCopiedSpec(false), 2500);
    }
  };

  // Device native share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: exam.name,
          text: specSnippet,
          url: shortLink,
        });
        setNativeShareSuccess(true);
        setTimeout(() => setNativeShareSuccess(false), 2000);
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  // Telegram direct share link
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shortLink)}&text=${encodeURIComponent(
    `📚 ${exam.name} (${gradeLabel} - ${exam.subject || 'General'})\n${questionCount} Questions | ${exam.timeLimit} mins`
  )}`;

  // WhatsApp direct share link
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(specSnippet)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#0c182b]/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow-xs shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif] leading-tight">
                Share Exam
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Generate deep link &amp; study specification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Action Notice Banner */}
          {actionNotice && (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="font-medium">{actionNotice}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SHARING LIMIT & PRIVILEGE QUOTA BAR
          ───────────────────────────────────────────────────────────── */}
          {isPrivileged ? (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-200 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div>
                  <span className="font-bold">Unlimited Exam Sharing</span>
                  <span className="text-zinc-500 dark:text-zinc-400 ml-1.5 font-normal">
                    (Teacher / Admin Privilege)
                  </span>
                </div>
              </div>
              {userSharedExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowManageShared((prev) => !prev)}
                  className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>{userSharedExams.length} shared</span>
                  {showManageShared ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                  <Share2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>Active Shared Exams</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      userSharedExams.length >= MAX_USER_SHARED_EXAMS
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {userSharedExams.length} / {MAX_USER_SHARED_EXAMS} Shared
                  </span>
                  {userSharedExams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowManageShared((prev) => !prev)}
                      className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Manage</span>
                      {showManageShared ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    userSharedExams.length >= MAX_USER_SHARED_EXAMS
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (userSharedExams.length / MAX_USER_SHARED_EXAMS) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>
                  {userSharedExams.length >= MAX_USER_SHARED_EXAMS
                    ? 'Sharing limit reached (5/5). Remove a shared exam to share a new one.'
                    : `${MAX_USER_SHARED_EXAMS - userSharedExams.length} sharing slot${
                        MAX_USER_SHARED_EXAMS - userSharedExams.length === 1 ? '' : 's'
                      } remaining.`}
                </span>
                <span className="italic">Unlimited for Teachers</span>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              LIMIT REACHED BANNER & DELETE BUTTONS TO SHARE OTHER EXAMS
          ───────────────────────────────────────────────────────────── */}
          {isStorageLimitReached && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-['Outfit',sans-serif]">
                    Sharing Limit Reached ({userSharedExams.length}/{MAX_USER_SHARED_EXAMS})
                  </h4>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                    Student accounts can share up to 5 exams at a time. Remove one of your previously shared exams below to share <strong>"{exam.name}"</strong>.
                  </p>
                </div>
              </div>

              {/* Shared Exams List with Delete Buttons */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Remove an Exam to Free a Slot:
                </div>
                {userSharedExams.map((sharedItem) => (
                  <div
                    key={sharedItem.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-500/20 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {sharedItem.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <span>Grade {sharedItem.grade}</span>
                        <span>•</span>
                        <span>{sharedItem.subject}</span>
                        <span>•</span>
                        <span>{sharedItem.questionCount} Questions</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isDeletingId === sharedItem.id}
                      onClick={() => handleDeleteSharedExam(sharedItem.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs shrink-0 disabled:opacity-50"
                      title="Stop sharing and free slot"
                    >
                      {isDeletingId === sharedItem.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Remove &amp; Share</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              COLLAPSIBLE MANAGE SHARED EXAMS SECTION (WHEN NOT AT LIMIT)
          ───────────────────────────────────────────────────────────── */}
          {showManageShared && !isStorageLimitReached && userSharedExams.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Your Shared Exams ({userSharedExams.length})</span>
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Remove anytime to manage slots
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {userSharedExams.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {item.title}
                        {item.id === compactExamId && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {item.subject} • Grade {item.grade} • {item.questionCount} Qs
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isDeletingId === item.id}
                      onClick={() => handleDeleteSharedExam(item.id)}
                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Stop sharing exam"
                    >
                      {isDeletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link Preparation Status Banner */}
          {cloudSyncStatus === 'syncing' && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Preparing shareable link so anyone can practice...</span>
              </div>
            </div>
          )}

          {cloudSyncStatus === 'ready' && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium">
                  Share link ready! Anyone with this link can practice immediately.
                </span>
              </div>
            </div>
          )}

          {cloudSyncStatus === 'error' && !isStorageLimitReached && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate">
                  Link setup: {cloudSyncError || 'Connection issue'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handlePublishToCloud()}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px] shrink-0 hover:bg-rose-700 transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Exam Summary Specification Card */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                  <GraduationCap className="w-3 h-3" />
                  <span>{gradeLabel}</span>
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {exam.subject || 'General'}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {exam.isDownloaded || exam.sourceType === 'curated_catalog' ? 'Official Exam' : 'User Library'}
                </span>
              </div>

              {/* Stop sharing button if this exam is currently shared */}
              {isCurrentExamInCloud && (
                <button
                  type="button"
                  disabled={isDeletingId === compactExamId}
                  onClick={handleUnshareCurrentExam}
                  className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Stop sharing this exam and free slot"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Stop Sharing</span>
                </button>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white font-['Outfit',sans-serif] leading-snug">
              {exam.name}
            </h3>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                <div className="flex items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold">
                  <HelpCircle className="w-3 h-3" />
                  <span>Questions</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5 block">
                  {questionCount}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                <div className="flex items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold">
                  <Clock className="w-3 h-3" />
                  <span>Time</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5 block">
                  {exam.timeLimit}m
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800">
                <div className="flex items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold">
                  <Layers className="w-3 h-3" />
                  <span>Stream</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5 block truncate">
                  {streamLabel}
                </span>
              </div>
            </div>

            {/* Topic pill */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
              <Tag className="w-3 h-3 text-zinc-400 shrink-0" />
              <span className="truncate">
                <strong>Topic:</strong> {topicLabel}
              </span>
            </div>
          </div>

          {/* Section 1: Short Sharing Link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                <span>1. Direct Short Exam Link</span>
              </label>

              {/* Domain Switcher */}
              {isDifferentOrigin && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDomainMode('active')}
                    className={`px-2 py-0.5 rounded-full font-semibold transition cursor-pointer ${
                      domainMode === 'active'
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Active App
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainMode('production')}
                    className={`px-2 py-0.5 rounded-full font-semibold transition cursor-pointer ${
                      domainMode === 'production'
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    sinahard1.pages.dev
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] sm:text-xs text-zinc-700 dark:text-zinc-300 truncate select-all flex items-center gap-2">
                <span className="truncate">{shortLink}</span>
              </div>
              <button
                type="button"
                id="copy-exam-deeplink-btn"
                disabled={isStorageLimitReached}
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90'
                }`}
                title="Copy short web link"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <p>
                Opening this short link on mobile or desktop directly launches this exam in <strong>Practice Mode</strong>.
              </p>
            </div>
          </div>

          {/* Section 2: Shareable Specification Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                2. Shareable Exam Specification Snippet
              </label>
              <button
                type="button"
                id="copy-exam-spec-btn"
                onClick={handleCopySpec}
                className="text-xs font-semibold text-zinc-900 dark:text-white hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedSpec ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Snippet Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 selection:bg-zinc-300 dark:selection:bg-zinc-700">
                {specSnippet}
              </pre>
            </div>
          </div>

          {/* Section 3: Social & Mobile Messenger Share */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
              3. Quick Share with Study Groups
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Device Native Share */}
              <button
                type="button"
                disabled={isStorageLimitReached}
                onClick={handleNativeShare}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-2xs disabled:opacity-40"
                title="Share via device menu"
              >
                <Share2 className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                <span>{nativeShareSuccess ? 'Shared!' : 'Device Share'}</span>
              </button>

              {/* Telegram */}
              <a
                href={isStorageLimitReached ? '#' : telegramUrl}
                target={isStorageLimitReached ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className={`p-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/15 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-2xs ${
                  isStorageLimitReached ? 'opacity-40 pointer-events-none' : ''
                }`}
                title="Share via Telegram"
              >
                <MessageCircle className="w-4 h-4 text-sky-500" />
                <span>Telegram</span>
              </a>

              {/* WhatsApp */}
              <a
                href={isStorageLimitReached ? '#' : whatsappUrl}
                target={isStorageLimitReached ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className={`col-span-2 sm:col-span-1 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-2xs ${
                  isStorageLimitReached ? 'opacity-40 pointer-events-none' : ''
                }`}
                title="Share via WhatsApp"
              >
                <ExternalLink className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/80 dark:bg-[#0c182b] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition cursor-pointer active:scale-95"
          >
            Done
          </button>

          {onStartPractice && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartPractice(exam);
              }}
              className="px-5 py-2 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Practice Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
