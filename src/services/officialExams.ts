import {
  collection,
  onSnapshot,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Exam, Question } from '../types';
import { CURATED_EXAMS_CATALOG } from '../data/curatedCatalog';
import { fetchOfficialExams, SUPABASE_CONFIG_UPDATED_EVENT } from './supabaseService';

const LOCAL_STORAGE_OFFICIAL_EXAMS = 'exam_master_official_exams_cache';
export const OFFICIAL_EXAMS_UPDATED_EVENT = 'exam_master_official_exams_updated';

function inferGradeFromName(text: string): string {
  if (/freshman|university|remedial|college|undergrad/i.test(text)) {
    return 'Freshman';
  }
  const match = text.match(/grade\s*(\d{1,2})/i) || text.match(/g(\d{1,2})/i);
  return match ? match[1] : '12';
}

/**
 * Sanitizes Firestore document data into standard typed Exam format
 * while preserving all question diagrams, option images, captions, and Markdown tables.
 */
export function sanitizeFirestoreExam(data: Record<string, any>, docId: string): Exam {
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const sanitizedQuestions: Question[] = rawQuestions.map((q: any, idx: number) => ({
    id: q.id || `q_${docId}_${idx + 1}`,
    text: String(q.text || ''),
    options: Array.isArray(q.options) && q.options.length > 0
      ? q.options.map((o: any) => String(o ?? ''))
      : ['', '', '', ''],
    correct: typeof q.correct === 'number' && !isNaN(q.correct) ? Math.max(0, Math.min(3, q.correct)) : 0,
    explanation: q.explanation ? String(q.explanation) : '',
    ...(q.imageUrl ? { imageUrl: String(q.imageUrl) } : {}),
    ...(q.imageCaption ? { imageCaption: String(q.imageCaption) } : {}),
    ...(Array.isArray(q.optionImages) && q.optionImages.some(Boolean)
      ? { optionImages: q.optionImages.map((img: any) => (img ? String(img) : null)) }
      : {}),
    ...(q.tableMarkdown ? { tableMarkdown: String(q.tableMarkdown) } : {}),
  }));

  const meta = data.metadata || {};
  const name = String(data.name || data.title || 'Official Curriculum Exam').trim();
  const title = String(data.title || data.name || name).trim();
  const grade = meta.grade || data.grade || inferGradeFromName(`${name} ${title}`);
  const subject = String(meta.subject || data.subject || 'General').trim();
  const timeLimit = Number(meta.timeLimit ?? data.timeLimit) || 25;
  const description = String(meta.description || data.description || '').trim();
  const stream = meta.stream || data.stream;
  const topic = meta.topic || data.topic;
  const targetExamYear = meta.targetExamYear || data.targetExamYear;

  return {
    id: docId,
    catalogId: data.catalogId || docId,
    name,
    title,
    subject,
    topic,
    timeLimit,
    description,
    questions: sanitizedQuestions,
    questionCount: typeof data.questionCount === 'number' ? data.questionCount : sanitizedQuestions.length,
    grade,
    stream,
    targetExamYear,
    tier: data.tier || meta.tier,
    university: data.university || meta.university,
    department: data.department || meta.department,
    academicYear: data.academicYear || meta.academicYear,
    semester: data.semester || meta.semester,
    examType: data.examType || meta.examType,
    examYear: data.examYear || meta.examYear,
    hasImages: sanitizedQuestions.some((q) => Boolean(q.imageUrl) || Boolean(q.optionImages?.some(Boolean))),
    hasTables: sanitizedQuestions.some((q) => Boolean(q.tableMarkdown)),
    metadata: {
      subject,
      grade,
      stream,
      topic,
      timeLimit,
      targetExamYear,
      description,
    },
    curator: String(data.curator || data.adminTag || (grade === 'Freshman' ? 'University Higher Education Board' : 'Ministry Curriculum Specialist Team')).trim(),
    rating: typeof data.rating === 'number' ? data.rating : 4.9,
    downloadCount: typeof data.downloadCount === 'number' ? data.downloadCount : 150,
    sourceType: data.sourceType || 'curated_catalog',
    isUploadedToCloud: true,
    cloudStorageEngine: data.cloudStorageEngine || 'firestore',
    cloudUploadedAt: data.cloudUploadedAt || data.updatedAt || data.createdAt || new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    adminTag: data.adminTag || (grade === 'Freshman' ? 'University Freshman Curriculum' : 'Official Exam'),
    isPublic: data.isPublic !== false,
    userId: data.userId || data.authorId,
    authorEmail: data.authorEmail,
  };
}

/**
 * Merge Firestore + Supabase official exams with default curated catalog, eliminating duplicates.
 * Official cloud exams uploaded to Firestore or Supabase take precedence and display newest first.
 */
export function mergeWithCuratedCatalog(cloudExams: Exam[]): Exam[] {
  const map = new Map<string, Exam>();

  // 1. Baseline curated catalog
  CURATED_EXAMS_CATALOG.forEach((e) => {
    map.set(e.id, { ...e, sourceType: 'curated_catalog' });
  });

  // 2. Merge Firestore + Supabase official exams
  cloudExams.forEach((e) => {
    const existing = map.get(e.id);
    map.set(e.id, {
      ...(existing || {}),
      ...e,
      sourceType: 'curated_catalog',
      isUploadedToCloud: true,
    });
  });

  const merged = Array.from(map.values());

  // Sort: newest uploaded/updated official exams at top
  return merged.sort((a, b) => {
    const timeA = new Date(a.cloudUploadedAt || a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.cloudUploadedAt || b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

/**
 * Get cached official exams with 0ms startup time.
 */
export function getCachedOfficialExams(): Exam[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OFFICIAL_EXAMS);
    if (!raw) return CURATED_EXAMS_CATALOG;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return CURATED_EXAMS_CATALOG;
    return mergeWithCuratedCatalog(parsed);
  } catch {
    return CURATED_EXAMS_CATALOG;
  }
}

/**
 * Optimistically broadcast and cache an official exam locally for instant 0ms sync.
 */
export function publishOfficialExamLocally(newExam: Exam) {
  try {
    const current = getCachedOfficialExams();
    const map = new Map<string, Exam>();
    const formatted: Exam = {
      ...newExam,
      sourceType: 'curated_catalog',
      isUploadedToCloud: true,
      cloudStorageEngine: newExam.cloudStorageEngine || 'firestore',
      cloudUploadedAt: new Date().toISOString(),
    };
    map.set(formatted.id, formatted);
    current.forEach((e) => {
      if (!map.has(e.id)) map.set(e.id, e);
    });

    const updated = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.cloudUploadedAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.cloudUploadedAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    localStorage.setItem(LOCAL_STORAGE_OFFICIAL_EXAMS, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OFFICIAL_EXAMS_UPDATED_EVENT, { detail: updated }));
    }
  } catch (err) {
    console.warn('Could not cache official exam locally:', err);
  }
}

/**
 * Real-time subscription to Official Exams:
 * 1. Emits cached exams immediately for instant 0ms UI.
 * 2. Listens to Firestore /exams collection for live real-time synchronization.
 * 3. Fetches published exams from linked Supabase `official_exams` table.
 * 4. Listens to local custom events for instant zero-latency admin uploads.
 */
export function subscribeToOfficialExams(
  onUpdate: (officialExams: Exam[]) => void
): () => void {
  // 1. Instant optimistic update from local cache
  const initial = getCachedOfficialExams();
  onUpdate(initial);

  let latestFirestoreExams: Exam[] = [];
  let latestSupabaseExams: Exam[] = [];

  const recomputeAndBroadcast = () => {
    const combined = [...latestFirestoreExams, ...latestSupabaseExams];
    const merged = mergeWithCuratedCatalog(combined);
    try {
      localStorage.setItem(LOCAL_STORAGE_OFFICIAL_EXAMS, JSON.stringify(merged));
    } catch {
      // ignore storage quota error
    }
    onUpdate(merged);
  };

  // 2. Sync from Supabase official_exams if linked
  const refreshSupabaseExams = () => {
    fetchOfficialExams()
      .then((supaExams) => {
        if (supaExams.length > 0) {
          latestSupabaseExams = supaExams;
          recomputeAndBroadcast();
        }
      })
      .catch(() => {
        // ignore offline
      });
  };
  refreshSupabaseExams();

  // 3. Listen to local synchronous updates and Supabase config changes
  const handleLocalUpdate = (e: Event) => {
    const customEvent = e as CustomEvent<Exam[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      onUpdate(customEvent.detail);
    } else {
      onUpdate(getCachedOfficialExams());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(OFFICIAL_EXAMS_UPDATED_EVENT, handleLocalUpdate);
    window.addEventListener(SUPABASE_CONFIG_UPDATED_EVENT, refreshSupabaseExams);
  }

  // 4. Attach real-time Firestore listener
  let unsubscribeFirestore: Unsubscribe = () => {};

  try {
    const examsCol = collection(db, 'exams');
    const q = query(examsCol, limit(100));
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const firestoreExams: Exam[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && (data.isPublic !== false || data.sourceType === 'curated_catalog' || data.isUploadedToCloud)) {
            firestoreExams.push(sanitizeFirestoreExam(data, docSnap.id));
          }
        });

        latestFirestoreExams = firestoreExams;
        recomputeAndBroadcast();
      },
      (err) => {
        console.warn('Firestore official exams subscription error (falling back to cache):', err);
      }
    );
  } catch (err) {
    console.warn('Failed to attach Firestore official exams listener:', err);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener(OFFICIAL_EXAMS_UPDATED_EVENT, handleLocalUpdate);
      window.removeEventListener(SUPABASE_CONFIG_UPDATED_EVENT, refreshSupabaseExams);
    }
  };
}
