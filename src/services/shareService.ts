import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Exam, Question, AppUser } from '../types';
import { CURATED_EXAMS_CATALOG } from '../data/curatedCatalog';
import { getCachedOfficialExams, sanitizeFirestoreExam } from './officialExams';
import { getLocalExams } from './db';
import { getSharedHistory, deleteFromSharedHistory } from './sharedHistoryService';

export const MAX_USER_SHARED_EXAMS = 5;

/**
 * Checks if a user has privileged (unlimited) exam creation & cloud sharing privileges.
 * Admin and Teacher roles have UNLIMITED storage and sharing in Firebase.
 */
export function isUserPrivileged(user?: AppUser | null): boolean {
  if (user) {
    if (user.role === 'admin' || user.role === 'teacher' || user.isVerifiedTeacher) {
      return true;
    }
    if (user.email && user.email.toLowerCase().trim() === 'melkamukebede11@gmail.com') {
      return true;
    }
  }
  const currentEmail = auth.currentUser?.email;
  if (currentEmail && currentEmail.toLowerCase().trim() === 'melkamukebede11@gmail.com') {
    return true;
  }
  return false;
}

export interface UserCloudExamItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  questionCount: number;
  createdAt: string;
}

/**
 * Retrieves all exams currently published and stored in Cloud Firestore by the user.
 * Supports both Firestore remote queries and local shared history.
 */
export async function getUserCloudSharedExams(user?: AppUser | null): Promise<UserCloudExamItem[]> {
  const authorUid = auth.currentUser?.uid || user?.uid;
  const authorEmail = auth.currentUser?.email || user?.email;

  const itemsMap = new Map<string, UserCloudExamItem>();

  // 1. Query Firestore if author UID is available
  if (authorUid && authorUid !== 'guest') {
    try {
      const qUser = query(collection(db, 'exams'), where('userId', '==', authorUid));
      const snapUser = await getDocs(qUser);
      snapUser.forEach((d) => {
        const data = d.data();
        itemsMap.set(d.id, {
          id: d.id,
          title: data.title || data.name || 'Shared Exam',
          subject: data.subject || data.metadata?.subject || 'General',
          grade: String(data.grade || data.metadata?.grade || '12'),
          questionCount: Array.isArray(data.questions) ? data.questions.length : (data.questionCount || 0),
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
    } catch (err) {
      console.warn('Could not query Firestore exams by user ID:', err);
    }
  }

  // 2. Query Firestore by authorEmail if present
  if (authorEmail) {
    try {
      const qEmail = query(collection(db, 'exams'), where('authorEmail', '==', authorEmail));
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => {
        const data = d.data();
        if (!itemsMap.has(d.id)) {
          itemsMap.set(d.id, {
            id: d.id,
            title: data.title || data.name || 'Shared Exam',
            subject: data.subject || data.metadata?.subject || 'General',
            grade: String(data.grade || data.metadata?.grade || '12'),
            questionCount: Array.isArray(data.questions) ? data.questions.length : (data.questionCount || 0),
            createdAt: data.createdAt || new Date().toISOString(),
          });
        }
      });
    } catch (err) {
      console.warn('Could not query Firestore exams by authorEmail:', err);
    }
  }

  // 3. Always merge local shared_by_me history items so user sees all exams they shared on this device
  try {
    const localHist = getSharedHistory().filter((i) => i.type === 'shared_by_me');
    localHist.forEach((h) => {
      if (!itemsMap.has(h.examId)) {
        itemsMap.set(h.examId, {
          id: h.examId,
          title: h.title,
          subject: h.subject,
          grade: h.grade,
          questionCount: h.questionsCount,
          createdAt: h.sharedAt,
        });
      }
    });
  } catch (histErr) {
    console.warn('Could not read local shared history:', histErr);
  }

  const list = Array.from(itemsMap.values());
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

/**
 * Gets the number of exams stored in Cloud Firestore by this user.
 */
export async function getUserCloudSharedCount(user?: AppUser | null): Promise<number> {
  const exams = await getUserCloudSharedExams(user);
  return exams.length;
}

/**
 * Permanently deletes an exam from Cloud Firestore /exams/{examId} and updates local shared history.
 */
export async function deleteExamFromCloud(examId: string): Promise<{ success: boolean; error?: string }> {
  const cleanId = (examId || '').trim();
  if (!cleanId) {
    return { success: false, error: 'Invalid exam ID' };
  }

  try {
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch {}
    }

    const examDocRef = doc(db, 'exams', cleanId);
    await deleteDoc(examDocRef);
    deleteFromSharedHistory(cleanId);

    // Also update any cached official/cloud exams
    try {
      const cacheKey = 'exam_master_official_exams_cache';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const next = list.filter((e: any) => e.id !== cleanId && e.catalogId !== cleanId);
          localStorage.setItem(cacheKey, JSON.stringify(next));
        }
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sinahard_cloud_exams_updated', { detail: { examId: cleanId } }));
    }

    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`Failed to delete exam "${cleanId}" from Cloud Firestore:`, err);
    // Still delete from local history
    deleteFromSharedHistory(cleanId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sinahard_cloud_exams_updated', { detail: { examId: cleanId } }));
    }
    return { success: false, error: errMsg };
  }
}

export const getShareBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://sinahard.com.et';
};

export const SHARE_BASE_URL = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://sinahard.com.et';

/**
 * Extracts the target exam identifier from any URL parameter, hash, or path.
 * Supports:
 *  - ?id=... (primary short link)
 *  - ?examId=...
 *  - ?e=...
 *  - ?catalogId=...
 *  - #/?id=... or #id=...
 *  - /practice/:id or /exam/:id
 */
export function extractTargetExamId(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Standard search parameters (?id=... or ?examId=...)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch =
      searchParams.get('id') ||
      searchParams.get('examId') ||
      searchParams.get('e') ||
      searchParams.get('catalogId');

    if (fromSearch && fromSearch.trim()) {
      return decodeURIComponent(fromSearch.trim());
    }
  } catch {
    // Ignore URL parse errors
  }

  // 2. Location hash parameters (e.g. #/?id=... or #id=...)
  try {
    const hash = window.location.hash;
    if (hash) {
      const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
      const queryIdx = cleanHash.indexOf('?');
      const hashQuery = queryIdx !== -1 ? cleanHash.slice(queryIdx) : cleanHash;
      const hashParams = new URLSearchParams(hashQuery.startsWith('?') ? hashQuery : `?${hashQuery}`);
      const fromHash =
        hashParams.get('id') ||
        hashParams.get('examId') ||
        hashParams.get('e') ||
        hashParams.get('catalogId');

      if (fromHash && fromHash.trim()) {
        return decodeURIComponent(fromHash.trim());
      }
    }
  } catch {
    // Ignore hash parse errors
  }

  // 3. Clean path parameters (e.g. /practice/:id or /exam/:id)
  try {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (
      pathParts.length >= 2 &&
      (pathParts[0] === 'practice' || pathParts[0] === 'exam' || pathParts[0] === 'e')
    ) {
      return decodeURIComponent(pathParts[1].trim());
    }
  } catch {
    // Ignore path errors
  }

  return null;
}

export interface CloudPublishResult {
  success: boolean;
  examId: string;
  error?: string;
}

/**
 * Automatically publishes/synchronizes an exam to Cloud Firestore /exams/{examId}
 * so that any recipient opening the short link on any device can immediately fetch it
 * and launch Practice Mode with complete questions and specifications.
 * Enforces a strict 5 exams storage limit in Firebase for regular users, with unlimited storage for admin and teachers.
 */
export async function publishExamForCloudSharing(exam: Exam, user?: AppUser | null): Promise<CloudPublishResult> {
  const examId = (exam.catalogId || exam.id).trim();
  if (!examId) {
    return { success: false, examId: '', error: 'Missing exam identifier.' };
  }

  try {
    // Ensure Firebase auth session exists so Firestore rules allow storage
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('Anonymous sign-in for cloud sharing fallback:', authErr);
      }
    }

    const authorUid = auth.currentUser?.uid || user?.uid || 'guest';
    const authorEmail = auth.currentUser?.email || user?.email || null;
    const nowIso = new Date().toISOString();

    const isPrivileged = isUserPrivileged(user);

    // Enforce 5 exams storage limit in Firebase for regular users
    if (!isPrivileged) {
      const existingCloudExams = await getUserCloudSharedExams(user);
      const isAlreadyShared = existingCloudExams.some((e) => e.id === examId);

      if (!isAlreadyShared && existingCloudExams.length >= MAX_USER_SHARED_EXAMS) {
        return {
          success: false,
          examId,
          error: `Storage limit reached: You have reached the limit of ${MAX_USER_SHARED_EXAMS} shared exams in Firebase. Regular users have a 5-exam storage limit. Please delete one of your shared exams to share this one.`,
        };
      }
    }

    // Sanitize questions array to guarantee complete fields including diagrams, option images, and tables
    const sanitizedQuestions: Question[] = (exam.questions || []).map((q, idx) => ({
      id: q.id || `q_${examId}_${idx + 1}`,
      text: String(q.text || (q as any).question || ''),
      options:
        Array.isArray(q.options) && q.options.length > 0
          ? q.options.map((o) => String(o ?? ''))
          : ['', '', '', ''],
      correct:
        typeof q.correct === 'number' && !isNaN(q.correct)
          ? Math.max(0, Math.min(3, q.correct))
          : 0,
      explanation: q.explanation ? String(q.explanation) : '',
      ...(q.imageUrl ? { imageUrl: String(q.imageUrl) } : {}),
      ...(q.imageCaption ? { imageCaption: String(q.imageCaption) } : {}),
      ...(Array.isArray(q.optionImages) && q.optionImages.some(Boolean)
        ? { optionImages: q.optionImages.map((img) => (img ? String(img) : null)) }
        : {}),
      ...(q.tableMarkdown ? { tableMarkdown: String(q.tableMarkdown) } : {}),
    }));

    const hasImages = sanitizedQuestions.some(
      (q) => Boolean(q.imageUrl) || (Array.isArray(q.optionImages) && q.optionImages.some(Boolean))
    );
    const hasTables = sanitizedQuestions.some((q) => Boolean(q.tableMarkdown));

    const title = (exam.title || exam.name || 'Practice Exam').trim();
    const examMetadata = {
      subject: (exam.subject || 'General').trim(),
      grade: String(exam.grade || '12'),
      timeLimit: Number(exam.timeLimit) || 20,
      hasImages,
      hasTables,
      ...(exam.topic?.trim() ? { topic: exam.topic.trim() } : {}),
      ...(exam.stream ? { stream: exam.stream } : {}),
      ...(exam.targetExamYear ? { targetExamYear: exam.targetExamYear } : {}),
      ...(exam.description?.trim() ? { description: exam.description.trim() } : {}),
    };

    const payload = {
      id: examId,
      catalogId: exam.catalogId || examId,
      title,
      name: title,
      grade: String(exam.grade || '12'),
      subject: (exam.subject || 'General').trim(),
      timeLimit: Number(exam.timeLimit) || 20,
      hasImages,
      hasTables,
      metadata: examMetadata,
      questions: sanitizedQuestions,
      questionCount: sanitizedQuestions.length,
      isPublic: true,
      sourceType: exam.sourceType || 'user_shared',
      userId: authorUid,
      createdAt: exam.createdAt || nowIso,
      updatedAt: nowIso,
      ...(authorEmail ? { authorEmail } : {}),
    };

    const examDocRef = doc(db, 'exams', examId);
    // Write directly using merge: true to handle both initial creation and updates
    await setDoc(examDocRef, payload, { merge: true });

    return { success: true, examId };
  } catch (err: any) {
    const errorDetails = err?.message || String(err);
    console.error('Failed uploading exam to Cloud Firestore for sharing:', err);
    return {
      success: false,
      examId,
      error: errorDetails,
    };
  }
}

/**
 * Resolves an exam from targetId for direct practice mode launch.
 * Searches across:
 *  1. Local storage & active exams library (0ms instant launch)
 *  2. Curated official catalog (0ms instant launch)
 *  3. Cached official curriculum exams
 *  4. Cloud Firestore /exams documents (by doc ID, catalogId, or id field)
 *  5. Cloud Firestore /questions collection (if question bank was uploaded separately)
 */
export async function resolveExamForPractice(
  targetId: string,
  options?: {
    currentExams?: Exam[];
    onStatus?: (status: string) => void;
  }
): Promise<Exam | null> {
  const cleanId = targetId.trim();
  if (!cleanId) return null;

  const normalized = cleanId.toLowerCase();

  // 1. Search in local library exams (fastest, 0ms)
  const localList = options?.currentExams && options.currentExams.length > 0
    ? options.currentExams
    : getLocalExams();

  const matchedLocal = localList.find(
    (e) =>
      e.id === cleanId ||
      e.id.toLowerCase() === normalized ||
      (e.catalogId && (e.catalogId === cleanId || e.catalogId.toLowerCase() === normalized))
  );

  if (matchedLocal && matchedLocal.questions && matchedLocal.questions.length > 0) {
    return matchedLocal;
  }

  // 2. Search in official curated catalog
  const matchedCurated = CURATED_EXAMS_CATALOG.find(
    (e) =>
      e.id === cleanId ||
      e.id.toLowerCase() === normalized ||
      (e.catalogId && (e.catalogId === cleanId || e.catalogId.toLowerCase() === normalized))
  );

  if (matchedCurated && matchedCurated.questions && matchedCurated.questions.length > 0) {
    return matchedCurated;
  }

  // 3. Search in cached official exams
  const cachedOfficial = getCachedOfficialExams();
  const matchedCached = cachedOfficial.find(
    (e) =>
      e.id === cleanId ||
      e.id.toLowerCase() === normalized ||
      (e.catalogId && (e.catalogId === cleanId || e.catalogId.toLowerCase() === normalized))
  );

  if (matchedCached && matchedCached.questions && matchedCached.questions.length > 0) {
    return matchedCached;
  }

  // 4. Fetch directly from Cloud Firestore
  options?.onStatus?.('Fetching exam from cloud database...');

  try {
    let firestoreData: any = null;
    let resolvedDocId = cleanId;

    // A. Direct doc lookup
    const directSnap = await getDoc(doc(db, 'exams', cleanId));
    if (directSnap.exists()) {
      firestoreData = directSnap.data();
      resolvedDocId = directSnap.id;
    } else {
      // Try lowercase doc id
      if (cleanId !== normalized) {
        const lowerSnap = await getDoc(doc(db, 'exams', normalized));
        if (lowerSnap.exists()) {
          firestoreData = lowerSnap.data();
          resolvedDocId = lowerSnap.id;
        }
      }

      // B. Query by catalogId field
      if (!firestoreData) {
        options?.onStatus?.('Searching catalog database...');
        const qCatalog = query(collection(db, 'exams'), where('catalogId', '==', cleanId), limit(1));
        const catalogDocs = await getDocs(qCatalog);
        if (!catalogDocs.empty) {
          firestoreData = catalogDocs.docs[0].data();
          resolvedDocId = catalogDocs.docs[0].id;
        }
      }

      // C. Query by id field
      if (!firestoreData) {
        const qId = query(collection(db, 'exams'), where('id', '==', cleanId), limit(1));
        const idDocs = await getDocs(qId);
        if (!idDocs.empty) {
          firestoreData = idDocs.docs[0].data();
          resolvedDocId = idDocs.docs[0].id;
        }
      }
    }

    if (!firestoreData) {
      return null;
    }

    // 5. Check if questions are inside the exam document or in /questions bank
    let rawQuestions: any[] = Array.isArray(firestoreData.questions) ? firestoreData.questions : [];

    if (rawQuestions.length === 0) {
      options?.onStatus?.('Loading practice questions...');
      try {
        const qQuery = query(
          collection(db, 'questions'),
          where('examId', '==', resolvedDocId),
          limit(200)
        );
        const qSnap = await getDocs(qQuery);
        if (!qSnap.empty) {
          rawQuestions = qSnap.docs.map((d) => d.data());
        }
      } catch (qErr) {
        console.warn('Could not query questions bank collection:', qErr);
      }
    }

    const sanitizedExam = sanitizeFirestoreExam(
      {
        ...firestoreData,
        questions: rawQuestions,
      },
      resolvedDocId
    );

    // Optimize: Cache resolved exam locally so future practice launches cost 0 Firestore reads
    try {
      const existing = getCachedOfficialExams();
      const idx = existing.findIndex((e) => e.id === sanitizedExam.id || (e.catalogId && e.catalogId === sanitizedExam.catalogId));
      if (idx >= 0) {
        existing[idx] = sanitizedExam;
      } else {
        existing.push(sanitizedExam);
      }
      localStorage.setItem('exam_master_official_exams_cache', JSON.stringify(existing));
    } catch {
      // ignore storage quota errors gracefully
    }

    return sanitizedExam;
  } catch (err) {
    console.error('Error fetching exam from Firestore:', err);
    throw err;
  }
}
