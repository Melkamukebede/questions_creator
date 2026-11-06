export interface Question {
  id: string;
  text: string;
  options: string[];
  correct: number; // 0-3 index
  explanation?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  // Rich media extensions (diagrams, graphs, tables)
  imageUrl?: string;
  imageCaption?: string;
  tableMarkdown?: string;
  optionImages?: (string | null | undefined)[];
}

export type SubjectType = 'theory' | 'calculation';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export type ExamCategory = 'official' | 'created';
export type CreatedExamType = 'teacher' | 'student_draft';
export type UserRole = 'student' | 'teacher' | 'admin';

export type ExamTier = 'university' | 'secondary';
export type ExamSemester = 'Semester 1' | 'Semester 2' | 'All';
export type ExamTypeClassification = 'Mid' | 'Final' | 'National' | 'Model' | 'Quiz' | 'Make-up';
export type YearDurationFilter = 'all' | '1-3' | '1-5';

export interface ExamMetadata {
  subject: string;
  grade?: number | string;
  stream?: string;
  topic?: string;
  timeLimit: number;
  targetExamYear?: string;
  description?: string;
  category?: ExamCategory;
  createdType?: CreatedExamType;
  school?: string;
  teacherName?: string;
  examYear?: string | number;
  curator?: string;
  pushedToCloud?: boolean;
  offlineCapped?: boolean;
  originalQuestionCount?: number;
  // University & Extended Classification
  tier?: ExamTier;
  university?: string;
  department?: string;
  academicYear?: string; // 'Freshman', '2nd Year', '3rd Year', 'Grade 12', etc.
  semester?: ExamSemester;
  examType?: ExamTypeClassification | string;
  hasImages?: boolean;
  hasTables?: boolean;
  storageSource?: 'supabase' | 'firestore' | 'local' | 'cloudflare_r2';
}

export interface Exam {
  id: string;
  name: string;
  title?: string;
  subject: string;
  topic?: string;
  grade?: number | string; // e.g. 9, 10, 11, 12, 'Freshman', 'National Exam'
  timeLimit: number; // in minutes
  metadata?: ExamMetadata;
  questions: Question[];
  questionCount?: number;
  description?: string;
  userId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Two-tier Exam Repository Categorization:
  // - 'official': Synced from cloud, created by admins (examYear, subject, grade, stream)
  // - 'created':
  //    * 'student_draft': Local offline only, editable, exportable
  //    * 'teacher': Synced to cloud, created by verified teachers (school, teacherName, grade, subject, topic)
  category?: ExamCategory;
  createdType?: CreatedExamType;
  school?: string;
  teacherName?: string;
  examYear?: string | number;
  // University & College Level Fields
  tier?: ExamTier;
  university?: string;
  department?: string;
  academicYear?: string; // e.g. 'Freshman', '2nd Year', 'Grade 12'
  semester?: ExamSemester;
  examType?: ExamTypeClassification | string;
  hasImages?: boolean;
  hasTables?: boolean;
  storageSource?: 'supabase' | 'firestore' | 'local' | 'cloudflare_r2';
  // Dual-type exam categorization & curated catalog fields
  sourceType?: 'user_created' | 'curated_catalog' | 'firestore' | 'supabase' | 'official' | 'cloudflare_r2';
  isDownloaded?: boolean;
  downloadedAt?: string;
  catalogId?: string;
  stream?: string;
  targetExamYear?: string;
  curator?: string;
  rating?: number;
  downloadCount?: number;
  // Cloud Database Storage tracking
  isUploadedToCloud?: boolean;
  cloudStorageEngine?: 'firestore' | 'supabase' | 'cloudflare_r2';
  cloudUploadedAt?: string;
  authorEmail?: string;
  adminTag?: string;
  cloudId?: string;
  isPushedToCloud?: boolean;
  pushedToCloud?: boolean;
}

export interface CloudUploadProgress {
  status: 'idle' | 'testing' | 'uploading' | 'success' | 'error';
  engine: 'firestore';
  progressPercent: number;
  message: string;
  uploadedExamsCount: number;
  uploadedQuestionsCount: number;
  errorDetail?: string;
}

export interface ExamAnswerRecord {
  text: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface ExamResult {
  id?: string | number;
  examId: string;
  examTitle: string;
  date: string;
  score: number; // correct count
  total: number; // total count
  percentage: number;
  timeSpent: number; // in seconds
  answers: ExamAnswerRecord[];
  userId?: string;
  subjectType?: string;
}

/**
 * Dedicated practice performance metric decoupled from exams library
 */
export type UserAttempt = ExamResult;

export interface StudyReminder {
  id: string;
  userId: string;
  time: string; // "HH:MM"
  enabled: boolean;
  days: string[]; // ["Mon", "Tue", ...]
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
  role?: UserRole; // 'student' | 'teacher' | 'admin'
  grade?: number | string;
  stream?: 'Natural Science' | 'Social Science' | 'General';
  schoolName?: string;
  school?: string;
  teacherName?: string;
  teachingSubject?: string;
  isVerifiedTeacher?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  registeredAt?: string;
  isPaid?: boolean;
  region?: string;
  targetExamYear?: string | number;
  phoneNumber?: string;
  isRegistered?: boolean;
  firstRegisteredEmail?: string | null;
  deviceId?: string;
  coins?: number;
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

export type SubscriptionDuration = 'plan_29' | 'plan_49' | 'plan_74' | 'plan_99' | '1day' | '1week' | '1month' | '3months' | '6months' | string;

export type PaymentMethod = 'chapa' | 'telebirr' | 'cbe' | 'abyssinia';

export type PaymentStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface SubscriptionPlan {
  id: SubscriptionDuration;
  name: string;
  durationLabel: string;
  days: number;
  priceETB: number;
  coins: number;
  badge?: string;
  popular?: boolean;
  description: string;
}

export interface UserSubscription {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  planDuration: SubscriptionDuration;
  amountETB: number;
  coinsAdded?: number;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  paymentStatus: PaymentStatus;
  startDate?: string;
  expiresAt?: string;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
}

export const ETHIOPIAN_UNIVERSITIES = [
  'Addis Ababa University (AAU)',
  'Adama Science & Technology University (ASTU)',
  'Addis Ababa Science & Technology University (AASTU)',
  'Hawassa University (HU)',
  'Jimma University (JU)',
  'Bahir Dar University (BDU)',
  'University of Gondar (UoG)',
  'Haramaya University',
  'Mekelle University',
  'Arba Minch University',
  'Dilla University',
  'Wollo University',
  'Dire Dawa University',
  'Debre Markos University',
  'Debre Berhan University',
  'Jigjiga University',
  'Wachemo University',
  'Ambo University',
  'Assosa University',
  'Semera University',
] as const;

export const FRESHMAN_SUBJECTS = [
  'General Physics (Phys 1011)',
  'Calculus I (Math 1011)',
  'Calculus II (Math 1012)',
  'Applied Mathematics I',
  'General Chemistry (Chem 1011)',
  'Introduction to Emerging Technologies',
  'Communicative English Language Skills I',
  'Communicative English Language Skills II',
  'Critical Thinking & Logic',
  'General Psychology',
  'Geography of Ethiopia & the Horn',
  'Physical Fitness & Health',
  'Social Anthropology',
  'Inclusiveness',
  'Moral & Civic Education',
] as const;

export const SECONDARY_SUBJECTS = [
  'Physics',
  'Mathematics',
  'Chemistry',
  'Biology',
  'English',
  'General Aptitude',
  'Economics',
  'Geography',
  'History',
  'Civics & Ethical Education',
  'Information Technology (IT)',
  'Amharic',
  'Afaan Oromoo',
  'Tigrigna',
] as const;

export const ETHIOPIAN_EXAM_YEARS = [
  '2017 E.C. (2025 G.C.)',
  '2016 E.C. (2024 G.C.)',
  '2015 E.C. (2023 G.C.)',
  '2014 E.C. (2022 G.C.)',
  '2013 E.C. (2021 G.C.)',
  '2012 E.C. (2020 G.C.)',
  '2011 E.C. (2019 G.C.)',
  '2010 E.C. (2018 G.C.)',
] as const;

export const UNIVERSITY_ACADEMIC_LEVELS = [
  'Freshman (1st Year)',
  'Sophomore (2nd Year)',
  'Junior (3rd Year)',
  'Senior (4th/5th Year)',
  'University Exit Exam',
] as const;

export const UNIVERSITY_DEPARTMENTS = [
  'Electrical & Computer Engineering (ECE)',
  'Pre-Engineering / Natural Science',
  'Computer Science & Software Eng',
  'Civil & Environmental Engineering',
  'Mechanical & Thermal Engineering',
  'Chemical & Bio-Engineering',
  'Medicine & Health Sciences',
  'Business & Economics',
] as const;

export const ECE_AND_ENGINEERING_SUBJECTS = [
  'Circuit Theory & Network Analysis I & II',
  'Signals and Systems Analysis',
  'Digital Logic Design (ECE 2041)',
  'Electronic Devices and Circuits',
  'Electromagnetic Fields and Waves',
  'Computer Programming for Engineers (C++/Python)',
  'Microprocessors & Microcontrollers',
  'Data Structures and Algorithms (ECE 3021)',
  'Linear Control Systems Engineering',
  'Electrical Machines & Drives',
  'Power System Analysis & Protection',
  'Communication Systems & Telecom Networks',
  'Digital Signal Processing (DSP)',
  'Computer Architecture & Embedded Systems',
  'Applied Mathematics I & II (Engineering Math)',
  'General Physics for Engineers (Phys 1011)',
] as const;

export const SECONDARY_ACADEMIC_LEVELS = [
  'Grade 12 (National Matriculation)',
  'Grade 11',
  'Grade 10',
  'Grade 9',
] as const;


