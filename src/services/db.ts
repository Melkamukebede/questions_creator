import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Exam,
  ExamResult,
  AppUser,
  UserSubscription,
  SubscriptionPlan,
  SubscriptionDuration,
} from '../types';

const LOCAL_STORAGE_EXAMS = 'exam_master_exams';
const LOCAL_STORAGE_RESULTS = 'exam_master_results';
const LOCAL_STORAGE_SUBSCRIPTIONS = 'exam_master_subscriptions';

export const ADMIN_EMAIL = 'melkamukebede11@gmail.com';

export const ETHIOPIAN_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_29',
    name: 'Starter Pass',
    durationLabel: '7 Days',
    days: 7,
    priceETB: 29.9,
    coins: 4,
    badge: '4 Coins',
    description: '4 practice coins (7 days access) for full exams, step-by-step solutions, and offline practice.',
  },
  {
    id: 'plan_49',
    name: 'Student Booster',
    durationLabel: '15 Days',
    days: 15,
    priceETB: 49.9,
    coins: 6,
    badge: 'Popular • 6 Coins',
    popular: true,
    description: '6 practice coins with full access, LaTeX step-by-step solutions, and offline exam caching.',
  },
  {
    id: 'plan_74',
    name: 'Scholar Pack',
    durationLabel: '30 Days',
    days: 30,
    priceETB: 74.9,
    coins: 10,
    badge: 'Best Value • 10 Coins',
    description: '10 practice coins for 30 days of comprehensive national entrance exam preparation.',
  },
  {
    id: 'plan_99',
    name: 'Master Bundle',
    durationLabel: '60 Days',
    days: 60,
    priceETB: 99.9,
    coins: 16,
    badge: 'Max Savings • 16 Coins',
    description: '16 practice coins for 60 days covering all curriculum units, unlimited downloads, and VIP support.',
  },
];

export const INITIAL_SAMPLE_EXAMS: Exam[] = [
  {
    id: 'sample_math_1',
    name: 'Advanced Mathematics & Calculus',
    title: 'Advanced Mathematics & Calculus',
    subject: 'Mathematics',
    timeLimit: 25,
    description: 'Master quadratic formulas, differentiation, limits, and integral calculus with step-by-step solutions.',
    isPublic: true,
    questions: [
      {
        id: 'q_math_1',
        text: 'What are the real roots of the quadratic equation \\( 2x^2 - 4x - 6 = 0 \\)?',
        options: ['\\( x = 3 \\) and \\( x = -1 \\)', '\\( x = -3 \\) and \\( x = 1 \\)', '\\( x = 2 \\) and \\( x = -3 \\)', '\\( x = 4 \\) and \\( x = -2 \\)'],
        correct: 0,
        explanation: `1. **Divide the equation by 2:**
\\[ x^2 - 2x - 3 = 0 \\]
2. **Factor the quadratic:**
\\[ (x - 3)(x + 1) = 0 \\]
3. **Solve for \\( x \\):**
\\[ x - 3 = 0 \\implies x = 3 \\]
\\[ x + 1 = 0 \\implies x = -1 \\]
**Answer:** \\( x = 3 \\) and \\( x = -1 \\)`
      },
      {
        id: 'q_math_2',
        text: 'What is the derivative with respect to \\( x \\) of \\( f(x) = 3x^4 - 5x^2 + 7 \\)?',
        options: [
          '\\( 12x^3 - 10x \\)',
          '\\( 12x^3 - 5x + 7 \\)',
          '\\( 7x^3 - 10x \\)',
          '\\( 3x^3 - 10x \\)'
        ],
        correct: 0,
        explanation: `1. **Apply the power rule:** \\( \\frac{d}{dx}[x^n] = n x^{n-1} \\)
\\[ \\frac{d}{dx}[3x^4] = 3 \\cdot 4x^3 = 12x^3 \\]
\\[ \\frac{d}{dx}[-5x^2] = -5 \\cdot 2x = -10x \\]
\\[ \\frac{d}{dx}[7] = 0 \\]
2. **Combine the terms:**
\\[ f'(x) = 12x^3 - 10x \\]
**Answer:** \\( 12x^3 - 10x \\)`
      },
      {
        id: 'q_math_3',
        text: 'Evaluate the definite integral: \\[ \\int_{0}^{2} (3x^2 + 2) \\, dx \\]',
        options: ['12', '10', '14', '8'],
        correct: 0,
        explanation: `1. **Find the antiderivative:**
\\[ \\int (3x^2 + 2) \\, dx = x^3 + 2x \\]
2. **Evaluate between limits \\( 0 \\) and \\( 2 \\):**
\\[ [x^3 + 2x]_0^2 = (2^3 + 2(2)) - (0 + 0) = 8 + 4 = 12 \\]
**Answer:** 12`
      },
      {
        id: 'q_math_4',
        text: 'What is the limit as \\( x \\to 0 \\) of \\[ \\lim_{x \\to 0} \\frac{\\sin(3x)}{x} \\]?',
        options: ['3', '1', '0', 'Undefined'],
        correct: 0,
        explanation: `1. **Recall the fundamental trigonometric limit:**
\\[ \\lim_{\\theta \\to 0} \\frac{\\sin(\\theta)}{\\theta} = 1 \\]
2. **Rewrite the expression:**
\\[ \\frac{\\sin(3x)}{x} = 3 \\cdot \\frac{\\sin(3x)}{3x} \\]
3. **Take the limit:**
\\[ 3 \\cdot 1 = 3 \\]
**Answer:** 3`
      }
    ]
  },
  {
    id: 'sample_physics_1',
    name: 'Physics: Classical Mechanics & Energy',
    title: 'Physics: Classical Mechanics & Energy',
    subject: 'Physics',
    timeLimit: 20,
    description: 'Kinematics, Newton\'s laws of motion, work, and conservation of energy.',
    isPublic: true,
    questions: [
      {
        id: 'q_phys_1',
        text: 'A car of mass \\( m = 1200 \\text{ kg} \\) accelerates from rest to \\( v = 20 \\text{ m/s} \\). What is its kinetic energy?',
        options: ['\\( 240,000 \\text{ J} \\)', '\\( 120,000 \\text{ J} \\)', '\\( 480,000 \\text{ J} \\)', '\\( 24,000 \\text{ J} \\)'],
        correct: 0,
        explanation: `1. **Kinetic Energy formula:**
\\[ E_k = \\frac{1}{2} m v^2 \\]
2. **Substitute values:**
\\[ E_k = \\frac{1}{2} (1200)(20^2) = 600 \\times 400 = 240,000 \\text{ J} = 240 \\text{ kJ} \\]
**Answer:** \\( 240,000 \\text{ J} \\)`
      },
      {
        id: 'q_phys_2',
        text: 'According to Newton\'s Second Law, if a net force of \\( 45 \\text{ N} \\) acts on a \\( 5 \\text{ kg} \\) object, what is its acceleration?',
        options: ['\\( 9 \\text{ m/s}^2 \\)', '\\( 225 \\text{ m/s}^2 \\)', '\\( 0.11 \\text{ m/s}^2 \\)', '\\( 40 \\text{ m/s}^2 \\)'],
        correct: 0,
        explanation: `1. **Formula:** \\[ F = ma \\implies a = \\frac{F}{m} \\]
2. **Calculation:**
\\[ a = \\frac{45 \\text{ N}}{5 \\text{ kg}} = 9 \\text{ m/s}^2 \\]
**Answer:** \\( 9 \\text{ m/s}^2 \\)`
      },
      {
        id: 'q_phys_3',
        text: 'An object is dropped from a height \\( h = 20 \\text{ m} \\) in a vacuum where \\( g = 9.8 \\text{ m/s}^2 \\). What is its speed right before hitting the ground?',
        options: ['\\( 19.8 \\text{ m/s} \\)', '\\( 14.0 \\text{ m/s} \\)', '\\( 9.8 \\text{ m/s} \\)', '\\( 39.2 \\text{ m/s} \\)'],
        correct: 0,
        explanation: `1. **Conservation of mechanical energy:**
\\[ mgh = \\frac{1}{2}mv^2 \\implies v = \\sqrt{2gh} \\]
2. **Calculation:**
\\[ v = \\sqrt{2 \\times 9.8 \\times 20} = \\sqrt{392} \\approx 19.8 \\text{ m/s} \\]
**Answer:** \\( 19.8 \\text{ m/s} \\)`
      }
    ]
  },
  {
    id: 'sample_bio_1',
    name: 'Cell Biology & Genetics',
    title: 'Cell Biology & Genetics',
    subject: 'Biology',
    timeLimit: 15,
    description: 'Cell structure, organelle functions, DNA replication, and Mendelian inheritance.',
    isPublic: true,
    questions: [
      {
        id: 'q_bio_1',
        text: 'Which cellular organelle is primarily responsible for ATP synthesis via oxidative phosphorylation?',
        options: ['Mitochondria', 'Ribosome', 'Endoplasmic Reticulum', 'Golgi Apparatus'],
        correct: 0,
        explanation: `**Main Idea:** Mitochondria are known as the cellular powerhouses.
*Details:* They generate most of the cell's supply of adenosine triphosphate (ATP), used as a chemical energy currency, through the citric acid cycle and oxidative phosphorylation.
💡 **Memory Trick:** "Mighty Mitochondria Make Muscle Money (ATP)".`
      },
      {
        id: 'q_bio_2',
        text: 'Which nitrogenous base pairs with Adenine (A) in double-stranded DNA?',
        options: ['Thymine (T)', 'Cytosine (C)', 'Guanine (G)', 'Uracil (U)'],
        correct: 0,
        explanation: `**Main Idea:** Complementary base pairing rules in DNA.
*Details:* Adenine pairs exclusively with Thymine via 2 hydrogen bonds (A = T), while Guanine pairs with Cytosine via 3 hydrogen bonds (G ≡ C). In RNA, Uracil replaces Thymine.
💡 **Memory Trick:** **A**pples on **T**rees, **C**ars in **G**arages.`
      },
      {
        id: 'q_bio_3',
        text: 'What is the overall chemical equation for oxygenic photosynthesis?',
        options: [
          '\\( 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{light} \\to \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\)',
          '\\( \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\to 6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\)',
          '\\( 2\\text{H}_2 + \\text{O}_2 \\to 2\\text{H}_2\\text{O} \\)',
          '\\( 6\\text{CO}_2 + 6\\text{O}_2 \\to \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{light} \\)'
        ],
        correct: 0,
        explanation: `1. **Reactants:** Carbon dioxide and water in the presence of sunlight and chlorophyll.
2. **Products:** Glucose and oxygen.
\\[ 6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{photons}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\]
**Answer:** Option A`
      }
    ]
  }
];

// Local storage helpers
export function getLocalExams(): Exam[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EXAMS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_EXAMS, JSON.stringify(INITIAL_SAMPLE_EXAMS));
      return INITIAL_SAMPLE_EXAMS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_STORAGE_EXAMS, JSON.stringify(INITIAL_SAMPLE_EXAMS));
      return INITIAL_SAMPLE_EXAMS;
    }
    return parsed;
  } catch {
    return INITIAL_SAMPLE_EXAMS;
  }
}

export function saveLocalExams(exams: Exam[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EXAMS, JSON.stringify(exams));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('exam_master_exams_updated', { detail: exams }));
    }
  } catch (err) {
    console.warn('Could not save exams to local storage', err);
  }
}

/**
 * Saves downloaded official or bundle exams directly into the local repository
 * so they appear in FilesView (Exams Repository) for zero-data offline practice,
 * avoiding raw .sqlite file download prompts.
 */
export function addDownloadedExamsToRepository(newExams: Exam[]): {
  addedCount: number;
  updatedCount: number;
  totalRepositoryCount: number;
} {
  const current = getLocalExams();
  let addedCount = 0;
  let updatedCount = 0;

  const mergedMap = new Map<string, Exam>();
  current.forEach((e) => mergedMap.set(e.id, e));

  newExams.forEach((e) => {
    const preparedExam: Exam = {
      ...e,
      isDownloaded: true,
      category: 'official',
      sourceType: 'official',
      downloadedAt: new Date().toISOString(),
    };
    if (mergedMap.has(e.id)) {
      updatedCount++;
    } else {
      addedCount++;
    }
    mergedMap.set(e.id, preparedExam);
  });

  const updatedList = Array.from(mergedMap.values());
  saveLocalExams(updatedList);

  return {
    addedCount,
    updatedCount,
    totalRepositoryCount: updatedList.length,
  };
}

export function getLocalResults(): ExamResult[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RESULTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalResults(results: ExamResult[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_RESULTS, JSON.stringify(results));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('exam_master_results_updated', { detail: results }));
    }
  } catch (err) {
    console.warn('Could not save results to local storage', err);
  }
}

// ----------------- LOCAL PERSISTENCE & REAL-TIME EVENT SERVICE -----------------

export function subscribeToExams(
  _user: AppUser | null,
  onUpdate: (exams: Exam[]) => void
): () => void {
  // Always load immediately from local storage - do NOT sync exams to Firestore
  const local = getLocalExams();
  onUpdate(local);

  if (typeof window === 'undefined') return () => {};

  const handleExamsUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<Exam[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      onUpdate(customEvent.detail);
    } else {
      onUpdate(getLocalExams());
    }
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_EXAMS) {
      onUpdate(getLocalExams());
    }
  };

  window.addEventListener('exam_master_exams_updated', handleExamsUpdated);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener('exam_master_exams_updated', handleExamsUpdated);
    window.removeEventListener('storage', handleStorageChange);
  };
}

export function subscribeToResults(
  user: AppUser | null,
  onUpdate: (results: ExamResult[]) => void
): () => void {
  // Always load immediately from local storage for 0ms initial UI update
  const local = getLocalResults();
  onUpdate(local);

  const handleResultsUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<ExamResult[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      onUpdate(customEvent.detail);
    } else {
      onUpdate(getLocalResults());
    }
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_RESULTS) {
      onUpdate(getLocalResults());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('exam_master_results_updated', handleResultsUpdated);
    window.addEventListener('storage', handleStorageChange);
  }

  if (!user || user.uid === 'guest') {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_results_updated', handleResultsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }

  try {
    const attemptsRef = collection(db, 'user_attempts');
    // Optimize: query only recent practice activity (20 most recent sessions) to minimize read units & payload size
    const q = query(attemptsRef, where('userId', '==', user.uid), limit(20));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreResults: ExamResult[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const score = Number(d.score) || 0;
          const total = Number(d.total) || 0;
          const percentage = typeof d.percentage === 'number'
            ? d.percentage
            : Math.round((score / (total || 1)) * 100);
          firestoreResults.push({
            id: docSnap.id,
            ...d,
            score,
            total,
            percentage,
          } as ExamResult);
        });

        // Merge firestore results with local results, keeping only recent active sessions
        const currentLocal = getLocalResults();
        const mergedMap = new Map<string, ExamResult>();
        currentLocal.forEach((r) => mergedMap.set(String(r.id), r));
        firestoreResults.forEach((r) => mergedMap.set(String(r.id), r));
        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Optimize local storage footprint: keep up to 30 most recent practice sessions
        const recentOnlyList = mergedList.slice(0, 30);
        saveLocalResults(recentOnlyList);
        onUpdate(recentOnlyList);
      },
      (error) => {
        console.warn('Firestore user_attempts subscription fallback to local:', error);
      }
    );

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_results_updated', handleResultsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  } catch (err) {
    console.warn('Firestore results subscription fallback:', err);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_results_updated', handleResultsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }
}

export async function saveExamToDb(exam: Exam, _user: AppUser | null): Promise<void> {
  const localExams = getLocalExams();
  const existingIndex = localExams.findIndex((e) => e.id === exam.id);
  if (existingIndex >= 0) {
    localExams[existingIndex] = exam;
  } else {
    localExams.unshift(exam);
  }
  saveLocalExams(localExams);
  // Do NOT sync to Firestore as explicitly requested: purely stored in local storage and updated instantly
}

export async function deleteExamFromDb(examId: string, _user: AppUser | null): Promise<void> {
  const localExams = getLocalExams().filter((e) => e.id !== examId);
  saveLocalExams(localExams);
  // Do NOT sync to Firestore as explicitly requested: purely stored in local storage and updated instantly
}

export async function saveResultToDb(result: ExamResult, user: AppUser | null): Promise<void> {
  const localResults = getLocalResults();
  const resWithId: ExamResult = {
    ...result,
    id: result.id || 'res_' + Date.now(),
    userId: user ? user.uid : 'guest',
  };
  localResults.unshift(resWithId);
  // Keep local storage lean by saving up to 30 most recent practice attempts
  saveLocalResults(localResults.slice(0, 30));

  if (user) {
    try {
      // Optimize & sanitize payload keys for Firestore:
      // Cap individual answer text/explanation to prevent document bloat while preserving essential review data
      const sanitizedAnswers = (resWithId.answers || []).map((ans) => {
        const item: {
          userAnswer: string;
          correctAnswer: string;
          isCorrect: boolean;
          text?: string;
          explanation?: string;
        } = {
          userAnswer: String(ans.userAnswer ?? '').slice(0, 150),
          correctAnswer: String(ans.correctAnswer ?? '').slice(0, 150),
          isCorrect: Boolean(ans.isCorrect),
        };
        if (ans.text) item.text = String(ans.text).slice(0, 400);
        if (ans.explanation) item.explanation = String(ans.explanation).slice(0, 400);
        return item;
      });

      // Lean, optimized keys strictly typed without undefineds or shadow keys
      const firestoreResultPayload = {
        id: String(resWithId.id),
        examId: String(resWithId.examId || ''),
        examTitle: String(resWithId.examTitle || '').slice(0, 160),
        userId: user.uid,
        date: resWithId.date || new Date().toISOString(),
        score: Math.max(0, Number(resWithId.score) || 0),
        total: Math.max(1, Number(resWithId.total) || 1),
        percentage: Math.min(100, Math.max(0, Number(resWithId.percentage) || 0)),
        timeSpent: Math.max(0, Number(resWithId.timeSpent) || 0),
        answers: sanitizedAnswers,
        ...(resWithId.subjectType ? { subjectType: String(resWithId.subjectType).slice(0, 60) } : {}),
      };

      const attemptDocRef = doc(db, 'user_attempts', String(resWithId.id));
      await setDoc(attemptDocRef, firestoreResultPayload);

      // Backwards-compatible mirror to legacy results collection
      try {
        const legacyDocRef = doc(db, 'results', String(resWithId.id));
        await setDoc(legacyDocRef, firestoreResultPayload);
      } catch {
        // Ignored
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `user_attempts/${resWithId.id}`);
    }
  }
}

export async function deleteResultFromDb(resultId: string | number, user: AppUser | null): Promise<void> {
  const localResults = getLocalResults().filter((r) => String(r.id) !== String(resultId));
  saveLocalResults(localResults);

  if (user) {
    try {
      const attemptDocRef = doc(db, 'user_attempts', String(resultId));
      await deleteDoc(attemptDocRef);
      try {
        const legacyDocRef = doc(db, 'results', String(resultId));
        await deleteDoc(legacyDocRef);
      } catch {
        // Ignored
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `user_attempts/${resultId}`);
    }
  }
}

export async function clearAllResultsFromDb(user: AppUser | null): Promise<void> {
  saveLocalResults([]);

  if (user) {
    try {
      const attemptsRef = collection(db, 'user_attempts');
      const q = query(attemptsRef, where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Also clean legacy results if any exist
      try {
        const legacyRef = collection(db, 'results');
        const legacyQ = query(legacyRef, where('userId', '==', user.uid));
        const legacySnap = await getDocs(legacyQ);
        await Promise.all(legacySnap.docs.map((d) => deleteDoc(d.ref)));
      } catch {
        // Ignored
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'user_attempts');
    }
  }
}

// ----------------- SUBSCRIPTION & CHAPA / FIRESTORE PAYMENT SERVICE -----------------

export function getLocalSubscriptions(): UserSubscription[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUBSCRIPTIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalSubscriptions(subs: UserSubscription[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SUBSCRIPTIONS, JSON.stringify(subs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('exam_master_subscriptions_updated', { detail: subs }));
    }
  } catch (err) {
    console.warn('Could not save subscriptions to local storage:', err);
  }
}

export function isUserAdmin(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.email) return false;
  return user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

export function isUserTeacher(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'teacher';
}

export function isTeacherVerified(user: AppUser | null): boolean {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  if (user.role !== 'teacher') return false;
  return Boolean(
    user.isVerifiedTeacher === true ||
    (user as any).isVerifiedTeacher === 'true' ||
    (user as any).isVerified === true ||
    (user as any).isVerified === 'true' ||
    (user as any).status === 'verified' ||
    (user as any).verified === true
  );
}

export function canUserUploadExam(user: AppUser | null): boolean {
  return isUserAdmin(user) || isTeacherVerified(user);
}

export interface RegisteredTeacherRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  teacherName?: string;
  schoolName?: string;
  school?: string;
  teachingSubject?: string;
  region?: string;
  phoneNumber?: string;
  isVerifiedTeacher: boolean;
  registeredAt?: string;
  createdAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  photoURL?: string;
}

/**
 * Real-time listener for registered teachers from Firestore users collection.
 * Admin can monitor, verify, or revoke teacher access.
 */
export function subscribeToRegisteredTeachers(
  onUpdate: (teachers: RegisteredTeacherRecord[]) => void
): () => void {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'teacher'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const teachers: RegisteredTeacherRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          teachers.push({
            id: docSnap.id,
            uid: data.id || data.uid || docSnap.id,
            email: data.email || 'No email',
            displayName: data.displayName || data.teacherName || 'Teacher',
            teacherName: data.teacherName || data.displayName,
            schoolName: data.schoolName || data.school || 'Unspecified School',
            school: data.school || data.schoolName || 'Unspecified School',
            teachingSubject: data.teachingSubject || data.subject || 'General Curriculum',
            region: data.region || 'Ethiopia',
            phoneNumber: data.phoneNumber,
            isVerifiedTeacher: Boolean(data.isVerifiedTeacher),
            registeredAt: data.registeredAt || data.createdAt,
            createdAt: data.createdAt,
            verifiedAt: data.verifiedAt,
            verifiedBy: data.verifiedBy,
            photoURL: data.photoURL,
          });
        });
        // Sort: pending verification first, then most recently registered
        teachers.sort((a, b) => {
          if (a.isVerifiedTeacher === b.isVerifiedTeacher) {
            return (b.registeredAt || b.createdAt || '').localeCompare(a.registeredAt || a.createdAt || '');
          }
          return a.isVerifiedTeacher ? 1 : -1;
        });
        onUpdate(teachers);
      },
      (error) => {
        console.warn('Teacher snapshot listener warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to subscribe to teachers:', err);
    return () => {};
  }
}

/**
 * Admin action to verify or revoke a teacher in Firestore users collection.
 */
export async function verifyTeacherInDb(
  teacherUid: string,
  verified: boolean,
  adminUser: AppUser | null
): Promise<boolean> {
  try {
    const teacherRef = doc(db, 'users', teacherUid);
    await updateDoc(teacherRef, {
      isVerifiedTeacher: verified,
      verifiedBy: adminUser?.email || ADMIN_EMAIL,
      verifiedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Failed to verify teacher in Firestore:', err);
    handleFirestoreError(err, OperationType.UPDATE, `users/${teacherUid}`);
    return false;
  }
}

/**
 * Real-time listener for school-specific teacher exams from Firestore.
 * If student has a school, queries exams for that school.
 * If user is admin, retrieves all teacher exams across schools.
 */
export function subscribeToSchoolTeacherExams(
  schoolName: string | undefined,
  grade: string | number | undefined,
  onUpdate: (exams: Exam[]) => void
): () => void {
  try {
    const examsRef = collection(db, 'exams');
    let q;
    const cleanSchool = schoolName?.trim();
    if (cleanSchool && cleanSchool !== 'General') {
      q = query(
        examsRef,
        where('category', '==', 'created'),
        where('createdType', '==', 'teacher'),
        where('school', '==', cleanSchool),
        limit(50)
      );
    } else {
      q = query(
        examsRef,
        where('category', '==', 'created'),
        where('createdType', '==', 'teacher'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const exams: Exam[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          exams.push({
            id: docSnap.id,
            name: data.title || data.name || 'School Teacher Exam',
            title: data.title || data.name || 'School Teacher Exam',
            subject: data.subject || data.metadata?.subject || 'General',
            grade: data.grade || data.metadata?.grade || '12',
            topic: data.topic || data.metadata?.topic || '',
            school: data.school || data.metadata?.school || cleanSchool || '',
            teacherName: data.teacherName || data.metadata?.teacherName || 'School Teacher',
            category: 'created',
            createdType: 'teacher',
            timeLimit: data.timeLimit || data.metadata?.timeLimit || 20,
            questions: Array.isArray(data.questions) ? data.questions : [],
            questionCount: data.questionCount || (data.questions ? data.questions.length : 0),
            sourceType: 'user_created',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            userId: data.userId,
            authorEmail: data.authorEmail,
            isUploadedToCloud: true,
          } as Exam);
        });
        onUpdate(exams);
      },
      (error) => {
        console.warn('School teacher exams listener error:', error);
        onUpdate([]);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.warn('Error subscribing to school teacher exams:', err);
    return () => {};
  }
}

/**
 * Validates if the user currently has an active verified premium subscription.
 */
export function isUserSubscriptionActive(subscription: UserSubscription | null): boolean {
  if (!subscription) return false;
  if (subscription.paymentStatus !== 'verified') return false;
  if (!subscription.expiresAt) return false;

  const now = new Date().getTime();
  const expiry = new Date(subscription.expiresAt).getTime();
  return expiry > now;
}

/**
 * Calculates start and expiry dates given a plan duration.
 */
export function calculateSubscriptionExpiry(duration: SubscriptionDuration): {
  startDate: string;
  expiresAt: string;
} {
  const start = new Date();
  const matchedPlan = ETHIOPIAN_SUBSCRIPTION_PLANS.find((p) => p.id === duration);
  const daysMap: Record<string, number> = {
    plan_29: 7,
    plan_49: 15,
    plan_74: 30,
    plan_99: 60,
    '1day': 1,
    '1week': 7,
    '1month': 30,
    '3months': 90,
    '6months': 180,
  };
  const daysToAdd = matchedPlan?.days || daysMap[duration] || 7;
  const expiry = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  return {
    startDate: start.toISOString(),
    expiresAt: expiry.toISOString(),
  };
}

/**
 * Real-time listener for current user's active subscription with 0ms instant local resolution.
 */
export function subscribeToUserSubscription(
  user: AppUser | null,
  onUpdate: (subscription: UserSubscription | null) => void
): () => void {
  const findActive = (s: UserSubscription) => isUserSubscriptionActive(s);

  const getBestSub = (subs: UserSubscription[]): UserSubscription | null => {
    if (user && user.uid !== 'guest') {
      return (
        subs.find((s) => s.userId === user.uid && findActive(s)) ||
        subs.find(
          (s) =>
            s.userEmail &&
            user.email &&
            s.userEmail.toLowerCase() === user.email.toLowerCase() &&
            findActive(s)
        ) ||
        subs.find((s) => s.userId === user.uid) ||
        subs.find(
          (s) =>
            s.userEmail &&
            user.email &&
            s.userEmail.toLowerCase() === user.email.toLowerCase()
        ) ||
        null
      );
    }
    return (
      subs.find((s) => s.userId === 'guest' && findActive(s)) ||
      subs.find((s) => s.userId === 'guest') ||
      null
    );
  };

  // 1. Instant local storage dispatch (0ms delay)
  const local = getLocalSubscriptions();
  onUpdate(getBestSub(local));

  const handleSubsUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<UserSubscription[]>;
    const subs = customEvent.detail && Array.isArray(customEvent.detail) ? customEvent.detail : getLocalSubscriptions();
    onUpdate(getBestSub(subs));
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_SUBSCRIPTIONS) {
      onUpdate(getBestSub(getLocalSubscriptions()));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
    window.addEventListener('storage', handleStorageChange);
  }

  if (!user || user.uid === 'guest') {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }

  try {
    const subsRef = collection(db, 'subscriptions');
    // Optimize: limit to 10 most recent records per user to minimize reads
    const q = query(
      subsRef,
      where('userId', '==', user.uid),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userSubs: UserSubscription[] = [];
        snapshot.forEach((docSnap) => {
          userSubs.push({ id: docSnap.id, ...docSnap.data() } as UserSubscription);
        });

        // Merge with local storage
        const currentLocal = getLocalSubscriptions();
        const mergedMap = new Map<string, UserSubscription>();
        currentLocal.forEach((s) => mergedMap.set(s.id, s));
        userSubs.forEach((s) => mergedMap.set(s.id, s));
        const mergedAll = Array.from(mergedMap.values());
        saveLocalSubscriptions(mergedAll);

        const best = getBestSub(mergedAll);
        onUpdate(best);
      },
      (error) => {
        console.warn('Subscription snapshot listener error (using local):', error);
      }
    );

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  } catch (err) {
    console.warn('Error subscribing to user subscription:', err);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }
}

/**
 * Real-time listener for all subscriptions (Admin only).
 */
export function subscribeToAllSubscriptions(
  user: AppUser | null,
  onUpdate: (subscriptions: UserSubscription[]) => void
): () => void {
  // Always emit local subscriptions immediately
  onUpdate(getLocalSubscriptions());

  const handleSubsUpdated = (e: Event) => {
    const customEvent = e as CustomEvent<UserSubscription[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      onUpdate(customEvent.detail);
    } else {
      onUpdate(getLocalSubscriptions());
    }
  };

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_SUBSCRIPTIONS) {
      onUpdate(getLocalSubscriptions());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
    window.addEventListener('storage', handleStorageChange);
  }

  if (!user || !isUserAdmin(user)) {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }

  try {
    const subsRef = collection(db, 'subscriptions');
    // Optimize: query with limit(150) to avoid pulling unbounded historical subscriptions
    const q = query(subsRef, limit(150));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all: UserSubscription[] = [];
        snapshot.forEach((docSnap) => {
          all.push({ id: docSnap.id, ...docSnap.data() } as UserSubscription);
        });
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveLocalSubscriptions(all);
        onUpdate(all);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'subscriptions');
      }
    );
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  } catch (err) {
    console.warn('Error subscribing to all subscriptions:', err);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('exam_master_subscriptions_updated', handleSubsUpdated);
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }
}

/**
 * Submit or record a subscription payment request (Chapa, Telebirr, CBE, etc.)
 */
export async function createSubscriptionRecord(
  subscription: Omit<UserSubscription, 'id'>,
  user: AppUser | null
): Promise<UserSubscription> {
  const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const fullSub: UserSubscription = {
    ...subscription,
    id,
  };

  // Save to local cache
  const local = getLocalSubscriptions();
  local.unshift(fullSub);
  saveLocalSubscriptions(local);

  if (user && user.uid !== 'guest') {
    try {
      const docRef = doc(db, 'subscriptions', id);
      await setDoc(docRef, fullSub);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subscriptions/${id}`);
    }
  }

  // Push notification alert email to admin if payment is pending
  if (fullSub.paymentStatus === 'pending') {
    import('./adminNotificationService')
      .then(({ sendPaymentNotification }) => {
        const plan = ETHIOPIAN_SUBSCRIPTION_PLANS.find((p) => p.id === fullSub.planDuration);
        sendPaymentNotification({
          subscriptionId: fullSub.id,
          studentName: fullSub.userName || user?.displayName || 'Student',
          studentEmail: fullSub.userEmail || user?.email || 'No email',
          studentPhone: user?.phoneNumber,
          planName: plan?.name || fullSub.planDuration,
          amount: fullSub.amountETB,
          paymentMethod: fullSub.paymentMethod.toUpperCase(),
          transactionReference: fullSub.transactionReference,
          bankName: fullSub.paymentMethod,
        }).catch((err) => console.warn('[Notification] Payment alert warning:', err));
      })
      .catch((err) => console.warn('[Notification] Could not load notification service:', err));
  }

  return fullSub;
}

/**
 * Admin action to verify and activate student subscription.
 */
export async function verifySubscriptionInDb(
  subscriptionId: string,
  user: AppUser | null
): Promise<void> {
  const local = getLocalSubscriptions();
  const found = local.find((s) => s.id === subscriptionId);
  const { startDate, expiresAt } = calculateSubscriptionExpiry(found?.planDuration || '1month');

  const updatedFields: Partial<UserSubscription> = {
    paymentStatus: 'verified',
    startDate,
    expiresAt,
    verifiedAt: new Date().toISOString(),
    verifiedBy: user?.email || 'admin',
  };

  if (found) {
    Object.assign(found, updatedFields);
    saveLocalSubscriptions(local);
  }

  if (user) {
    try {
      const docRef = doc(db, 'subscriptions', subscriptionId);
      await updateDoc(docRef, updatedFields);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
    }
  }
}

/**
 * Auto-verifies a subscription document by its unique Chapa transaction reference.
 */
export async function verifySubscriptionByTxRef(
  txRef: string,
  user: AppUser | null
): Promise<UserSubscription | null> {
  const local = getLocalSubscriptions();
  const found = local.find((s) => s.transactionReference === txRef);
  let planDuration: SubscriptionDuration = found?.planDuration || '1month';

  try {
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where('transactionReference', '==', txRef));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data() as UserSubscription;
      planDuration = data.planDuration || planDuration;
      const { startDate, expiresAt } = calculateSubscriptionExpiry(planDuration);
      const updatedFields = {
        paymentStatus: 'verified' as const,
        startDate,
        expiresAt,
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'chapa-automated',
      };
      await updateDoc(docSnap.ref, updatedFields);
      const verifiedSub: UserSubscription = {
        ...data,
        ...updatedFields,
        id: docSnap.id,
      };
      if (found) {
        Object.assign(found, updatedFields);
        saveLocalSubscriptions(local);
      }
      return verifiedSub;
    }
  } catch (err) {
    console.warn('Error auto-verifying subscription by tx_ref in Firestore:', err);
  }

  if (found) {
    const { startDate, expiresAt } = calculateSubscriptionExpiry(planDuration);
    Object.assign(found, {
      paymentStatus: 'verified',
      startDate,
      expiresAt,
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'chapa-automated',
    });
    saveLocalSubscriptions(local);
    return found;
  }

  // Fallback if record was not previously stored locally
  if (user) {
    const { startDate, expiresAt } = calculateSubscriptionExpiry(planDuration);
    const newSub: UserSubscription = {
      id: `sub-${txRef}`,
      userId: user.uid,
      userEmail: user.email || '',
      userName: user.displayName || 'Student',
      planDuration,
      amountETB: 199,
      paymentMethod: 'chapa',
      transactionReference: txRef,
      paymentStatus: 'verified',
      startDate,
      expiresAt,
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'chapa-automated',
      createdAt: new Date().toISOString(),
    };
    local.push(newSub);
    saveLocalSubscriptions(local);
    return newSub;
  }

  return null;
}

/**
 * Admin action to reject an invalid subscription reference.
 */
export async function rejectSubscriptionInDb(
  subscriptionId: string,
  reason: string,
  user: AppUser | null
): Promise<void> {
  const local = getLocalSubscriptions();
  const found = local.find((s) => s.id === subscriptionId);
  const updatedFields: Partial<UserSubscription> = {
    paymentStatus: 'rejected',
    notes: reason,
    verifiedAt: new Date().toISOString(),
    verifiedBy: user?.email || 'admin',
  };

  if (found) {
    Object.assign(found, updatedFields);
    saveLocalSubscriptions(local);
  }

  if (user) {
    try {
      const docRef = doc(db, 'subscriptions', subscriptionId);
      await updateDoc(docRef, updatedFields);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
    }
  }
}

/**
 * Save an ExamMaster Pro verified exam with questions directly into Firestore cloud database
 */
export async function saveExamToFirestore(
  exam: Partial<Exam>,
  user?: AppUser | null
): Promise<string> {
  const examId = exam.id || `exam_${Date.now()}`;
  const now = new Date().toISOString();

  const fullExam: Exam = {
    id: examId,
    title: exam.title || exam.name || 'ExamMaster Pro Exam',
    name: exam.title || exam.name || 'ExamMaster Pro Exam',
    category: 'created',
    createdType: 'teacher',
    subject: exam.subject || 'General Science',
    grade: exam.grade || '12',
    topic: exam.topic || 'General Topic',
    school: exam.school || user?.schoolName || 'National Examination',
    teacherName: exam.teacherName || user?.displayName || 'Educator',
    timeLimit: exam.timeLimit || 20,
    questions: Array.isArray(exam.questions) ? exam.questions : [],
    questionCount: Array.isArray(exam.questions) ? exam.questions.length : 0,
    sourceType: 'user_created',
    createdAt: exam.createdAt || now,
    updatedAt: now,
    userId: user?.uid || 'guest',
    authorEmail: user?.email || '',
    isPublic: true,
    isUploadedToCloud: true,
  };

  try {
    const docRef = doc(db, 'exams', examId);
    await setDoc(docRef, fullExam);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `exams/${examId}`);
  }

  // Also update local cache so it appears instantly across the app
  const local = getLocalExams();
  const existingIdx = local.findIndex((e) => e.id === examId);
  if (existingIdx >= 0) {
    local[existingIdx] = fullExam;
  } else {
    local.unshift(fullExam);
  }
  saveLocalExams(local);

  return examId;
}

