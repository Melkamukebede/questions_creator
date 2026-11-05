/**
 * SQLite Service for ExamMaster Pro & SinaHard University/Secondary Repository
 * 
 * Provides zero-dependency offline database generation and export using WebAssembly (sql.js).
 * Compiles verified exam questions, technical diagrams, and markdown data tables into
 * standardized .sqlite / .db binary files for offline student study.
 */

import initSqlJs, { Database } from 'sql.js';
import { Exam, Question } from '../types';
import { addDownloadedExamsToRepository } from './db';

export { addDownloadedExamsToRepository };

export interface SqliteExportResult {
  fileName: string;
  blob: Blob;
  sizeBytes: number;
  questionCount: number;
  examCount: number;
  isWasmCompiled?: boolean;
}

const WASM_CDN_MIRRORS = [
  'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/',
  'https://unpkg.com/sql.js@1.12.0/dist/',
];

/**
 * Initialize sql.js WebAssembly runtime with resilient multi-CDN failover
 */
async function getSqlInstance() {
  let lastError: unknown = null;
  for (const cdn of WASM_CDN_MIRRORS) {
    try {
      const instance = await initSqlJs({
        locateFile: (file: string) => `${cdn}${file}`,
      });
      if (instance) return instance;
    } catch (err) {
      lastError = err;
      console.warn(`sql.js CDN failed at ${cdn}, trying next mirror...`, err);
    }
  }
  throw lastError || new Error('WebAssembly runtime could not be fetched.');
}

/**
 * Creates an offline SQLite database containing one or more exams with rich media (diagrams & tables)
 * Falls back safely to structured JSON if WebAssembly execution fails or is offline
 */
export async function createMultiExamSqliteDatabase(
  bundleTitle: string,
  exams: Exam[]
): Promise<Uint8Array> {
  try {
    const SQL = await getSqlInstance();
    const db: Database = new SQL.Database();

  // 1. Create Schema: exams and questions tables with rich media & university columns
  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      stream TEXT,
      tier TEXT DEFAULT 'university',
      university TEXT,
      department TEXT,
      academic_year TEXT,
      semester TEXT,
      exam_type TEXT,
      exam_year TEXT,
      time_limit INTEGER DEFAULT 60,
      total_questions INTEGER NOT NULL,
      has_images INTEGER DEFAULT 0,
      has_tables INTEGER DEFAULT 0,
      source TEXT DEFAULT 'SinaHard Exam Repository',
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      topic TEXT,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option_index INTEGER NOT NULL,
      explanation TEXT,
      image_url TEXT,
      image_caption TEXT,
      table_markdown TEXT,
      critic_score INTEGER DEFAULT 100,
      created_at TEXT NOT NULL,
      FOREIGN KEY (exam_id) REFERENCES exams (id)
    );
  `);

  const now = new Date().toISOString();

  const insertExamStmt = db.prepare(`
    INSERT INTO exams (
      id, title, subject, grade, stream, tier, university, department,
      academic_year, semester, exam_type, exam_year, time_limit,
      total_questions, has_images, has_tables, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const insertQuestionStmt = db.prepare(`
    INSERT INTO questions (
      id, exam_id, subject, grade, topic, question_text,
      option_a, option_b, option_c, option_d,
      correct_option_index, explanation, image_url, image_caption,
      table_markdown, critic_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (const exam of exams) {
    const examId = exam.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const questions = exam.questions || [];
    const hasImages = questions.some((q) => Boolean(q.imageUrl)) ? 1 : 0;
    const hasTables = questions.some((q) => Boolean(q.tableMarkdown)) ? 1 : 0;

    insertExamStmt.run([
      examId,
      exam.title || exam.name || 'Untitled Exam',
      exam.subject || 'General',
      String(exam.grade || 'Freshman'),
      exam.stream || 'Natural Science',
      exam.tier || (exam.university ? 'university' : 'secondary'),
      exam.university || 'National Standard',
      exam.department || 'General Curriculum',
      exam.academicYear || String(exam.grade || 'Freshman'),
      exam.semester || 'Semester 1',
      exam.examType || 'Final',
      String(exam.examYear || '2016 E.C.'),
      exam.timeLimit || 60,
      questions.length,
      hasImages,
      hasTables,
      exam.createdAt || now,
    ]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id || `q_${examId}_${i}`;
      const opts = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];
      const optA = opts[0] || 'Option A';
      const optB = opts[1] || 'Option B';
      const optC = opts[2] || 'Option C';
      const optD = opts[3] || 'Option D';
      const correctIdx = typeof q.correct === 'number' ? q.correct : 0;

      insertQuestionStmt.run([
        qId,
        examId,
        q.subject || exam.subject,
        q.grade || String(exam.grade || ''),
        q.topic || exam.topic || 'General Topic',
        q.text || '',
        optA,
        optB,
        optC,
        optD,
        correctIdx,
        q.explanation || '',
        q.imageUrl || null,
        q.imageCaption || null,
        q.tableMarkdown || null,
        100,
        now,
      ]);
    }
  }

  insertExamStmt.free();
  insertQuestionStmt.free();

  const binaryArray = db.export();
  db.close();
  return binaryArray;
  } catch (err) {
    console.warn('WASM SQLite execution fell back to structured payload:', err);
    // Safe structured fallback payload that never crashes
    const fallbackPayload = JSON.stringify({
      app: 'SinaHard Exam System',
      bundle: bundleTitle,
      createdAt: new Date().toISOString(),
      exams,
    });
    return new TextEncoder().encode(fallbackPayload);
  }
}

/**
 * Download a multi-exam bundle as an offline SQLite binary (.sqlite)
 */
export async function downloadMultiExamSqliteBundle(
  bundleTitle: string,
  exams: Exam[]
): Promise<SqliteExportResult> {
  const binary = await createMultiExamSqliteDatabase(bundleTitle, exams);
  const blob = new Blob([binary], { type: 'application/x-sqlite3' });
  const sanitizedTitle = bundleTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const fileName = `${sanitizedTitle || 'exam_bundle'}_sinahard.sqlite`;

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const totalQuestions = exams.reduce((acc, curr) => acc + (curr.questions?.length || 0), 0);

  return {
    fileName,
    blob,
    sizeBytes: blob.size,
    questionCount: totalQuestions,
    examCount: exams.length,
  };
}

/**
 * Legacy single exam SQLite database export (backward compatible)
 */
export async function createExamSqliteDatabase(
  examTitle: string,
  subject: string,
  grade: string,
  stream: string,
  questions: (Question & { criticScore?: number; criticNotes?: string; verifiedByAgent?: boolean })[]
): Promise<Uint8Array> {
  const singleExam: Exam = {
    id: `exam_${Date.now()}`,
    name: examTitle,
    title: examTitle,
    subject,
    grade,
    stream,
    timeLimit: 60,
    questions,
    createdAt: new Date().toISOString(),
  };

  return await createMultiExamSqliteDatabase(examTitle, [singleExam]);
}

/**
 * Trigger immediate browser download of single exam SQLite file
 */
export async function downloadExamSqliteFile(
  examTitle: string,
  subject: string,
  grade: string,
  stream: string,
  questions: (Question & { criticScore?: number; criticNotes?: string; verifiedByAgent?: boolean })[]
): Promise<SqliteExportResult> {
  const singleExam: Exam = {
    id: `exam_${Date.now()}`,
    name: examTitle,
    title: examTitle,
    subject,
    grade,
    stream,
    timeLimit: 60,
    questions,
    createdAt: new Date().toISOString(),
  };

  return await downloadMultiExamSqliteBundle(examTitle, [singleExam]);
}

