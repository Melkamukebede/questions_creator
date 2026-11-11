import { AppUser, Exam } from '../types';
import { isUserAdmin, isUserTeacher } from '../services/db';

/**
 * Normalizes a raw grade or academic level string into a canonical class ID:
 * '12' | '11' | '10' | '9' | '8' | '7' | 'Freshman' | 'Senior University'
 */
export function normalizeClassLevel(raw?: string | number | null): string {
  const str = String(raw ?? '').trim();
  if (!str) return '12';

  if (/senior|exit\s*exam|sophomore|junior|2nd\s*year|3rd\s*year|4th\s*year|5th\s*year/i.test(str)) {
    return 'Senior University';
  }
  if (/freshman|1st\s*year|university|college/i.test(str)) {
    return 'Freshman';
  }
  const numMatch = str.match(/\b(12|11|10|9|8|7)\b/);
  if (numMatch) {
    return numMatch[1];
  }
  return '12';
}

/**
 * Determines the canonical class level of an Exam.
 */
export function getExamClassLevel(exam: Exam): string {
  const candidates = [
    exam.grade,
    exam.academicYear,
    exam.metadata?.grade,
    exam.metadata?.academicYear,
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      const s = String(c).trim();
      if (/senior|exit\s*exam|sophomore|junior|2nd\s*year|3rd\s*year|4th\s*year|5th\s*year/i.test(s)) {
        return 'Senior University';
      }
      if (/freshman|1st\s*year/i.test(s)) {
        return 'Freshman';
      }
      const numMatch = s.match(/\b(12|11|10|9|8|7)\b/);
      if (numMatch) {
        return numMatch[1];
      }
    }
  }

  const combinedTitle = `${exam.title || ''} ${exam.name || ''} ${exam.topic || ''}`;
  if (/senior|exit\s*exam|sophomore|junior|ece\s*[2345]/i.test(combinedTitle)) {
    return 'Senior University';
  }
  if (/freshman|1011|1012/i.test(combinedTitle) || exam.tier === 'university' || exam.university) {
    return 'Freshman';
  }
  const titleGradeMatch = combinedTitle.match(/(?:grade|gr|g)\s*(12|11|10|9|8|7)\b/i);
  if (titleGradeMatch) {
    return titleGradeMatch[1];
  }

  return '12';
}

/**
 * Returns true if the current user is a registered student (not Admin, not Guest, and not Teacher),
 * meaning the app should restrict displayed exams to their registered class level.
 */
export function isStudentClassLocked(user?: AppUser | null, isAdminProp?: boolean): boolean {
  if (!user) return false;
  if (user.isAnonymous || user.uid === 'guest') return false;
  const adminStatus = Boolean(isAdminProp || isUserAdmin(user));
  if (adminStatus) return false;
  if (isUserTeacher(user) || user.role === 'teacher' || user.role === 'admin') return false;
  return Boolean(user.grade);
}

/**
 * Checks whether an exam should be visible to the current user based on their registered class.
 * - Admins, Guests, and Teachers see all exams.
 * - Registered students only see exams matching their registered class (plus their own created drafts).
 */
export function doesExamMatchStudentClass(
  exam: Exam,
  user?: AppUser | null,
  isAdminProp?: boolean
): boolean {
  if (!isStudentClassLocked(user, isAdminProp)) {
    return true;
  }

  // Always show exams personally authored by this user
  if (user?.uid && exam.userId && exam.userId === user.uid) {
    return true;
  }

  const studentClass = normalizeClassLevel(user?.grade);
  const examClass = getExamClassLevel(exam);
  return examClass === studentClass;
}

/**
 * Returns a clean human-readable label for a canonical class ID.
 */
export function formatClassLevelLabel(levelId: string): string {
  const normalized = normalizeClassLevel(levelId);
  if (normalized === 'Freshman') return 'University Freshman';
  if (normalized === 'Senior University') return 'University Senior';
  return `Grade ${normalized}`;
}
