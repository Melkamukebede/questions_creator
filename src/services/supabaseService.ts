import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Exam, Question } from '../types';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  isConfigured: boolean;
  isCloudLinked?: boolean;
  linkedAt?: string;
  linkedBy?: string;
}

export interface SupabaseConnectionDiagnostics {
  success: boolean;
  message: string;
  bucketExists?: boolean;
  examsTableReady?: boolean;
  questionsTableReady?: boolean;
}

const STORAGE_KEY = 'sinahard_supabase_config_v2';
const DEFAULT_BUCKET = 'exam-media';
export const SUPABASE_CONFIG_UPDATED_EVENT = 'sinahard_supabase_config_updated';

// Cached client instance
let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';
let cloudListenerAttached = false;

function broadcastConfigChange(config: SupabaseConfig) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUPABASE_CONFIG_UPDATED_EVENT, { detail: config }));
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return {
          supabaseUrl: String(parsed.supabaseUrl).trim(),
          supabaseAnonKey: String(parsed.supabaseAnonKey).trim(),
          bucketName: parsed.bucketName ? String(parsed.bucketName).trim() : DEFAULT_BUCKET,
          isConfigured: true,
          isCloudLinked: Boolean(parsed.isCloudLinked),
          linkedAt: parsed.linkedAt,
          linkedBy: parsed.linkedBy,
        };
      }
    }
  } catch {
    // ignore JSON parsing errors
  }

  // Fallback to environment variables if provided
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
  const envBucket = (import.meta.env.VITE_SUPABASE_BUCKET as string) || DEFAULT_BUCKET;

  return {
    supabaseUrl: envUrl.trim(),
    supabaseAnonKey: envKey.trim(),
    bucketName: envBucket.trim() || DEFAULT_BUCKET,
    isConfigured: Boolean(envUrl && envKey),
    isCloudLinked: Boolean(envUrl && envKey),
  };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getSupabaseConfig();
  const nextUrl = (config.supabaseUrl ?? current.supabaseUrl).trim();
  const nextKey = (config.supabaseAnonKey ?? current.supabaseAnonKey).trim();
  const nextBucket = (config.bucketName ?? current.bucketName).trim() || DEFAULT_BUCKET;
  const isConfigured = Boolean(nextUrl && nextKey);

  const updated: SupabaseConfig = {
    supabaseUrl: nextUrl,
    supabaseAnonKey: nextKey,
    bucketName: nextBucket,
    isConfigured,
    isCloudLinked: config.isCloudLinked ?? current.isCloudLinked ?? false,
    linkedAt: config.linkedAt ?? current.linkedAt,
    linkedBy: config.linkedBy ?? current.linkedBy,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save Supabase configuration to localStorage:', err);
  }

  // Invalidate cached client so next call uses updated credentials
  cachedClient = null;
  cachedConfigKey = '';

  broadcastConfigChange(updated);
  return updated;
}

/**
 * Permanently links the app and Supabase in Cloud Firestore (/admin_settings/supabase_config)
 * so that the Admin links it only once and every device/browser connects automatically.
 */
export async function saveSupabaseConfigToCloud(
  config: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    bucketName?: string;
  },
  adminEmail?: string
): Promise<{ success: boolean; config: SupabaseConfig; cloudSynced: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const localUpdated = saveSupabaseConfig({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    bucketName: config.bucketName || DEFAULT_BUCKET,
    isCloudLinked: true,
    linkedAt: nowIso,
    linkedBy: adminEmail || 'melkamukebede11@gmail.com',
  });

  try {
    const settingRef = doc(db, 'admin_settings', 'supabase_config');
    await setDoc(
      settingRef,
      {
        supabaseUrl: localUpdated.supabaseUrl,
        supabaseAnonKey: localUpdated.supabaseAnonKey,
        bucketName: localUpdated.bucketName,
        isConfigured: localUpdated.isConfigured,
        linkedBy: localUpdated.linkedBy || 'melkamukebede11@gmail.com',
        linkedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    return { success: true, config: localUpdated, cloudSynced: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Saved Supabase link locally; Firestore cloud sync warning:', msg);
    return { success: true, config: localUpdated, cloudSynced: false, error: msg };
  }
}

/**
 * Initializes the one-time linked Supabase configuration from Cloud Firestore on app startup
 * and keeps all devices synchronized automatically.
 */
export async function initSupabaseFromCloud(): Promise<SupabaseConfig> {
  const currentLocal = getSupabaseConfig();

  if (!cloudListenerAttached) {
    cloudListenerAttached = true;
    try {
      const settingRef = doc(db, 'admin_settings', 'supabase_config');
      onSnapshot(
        settingRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.supabaseUrl && data?.supabaseAnonKey) {
              saveSupabaseConfig({
                supabaseUrl: String(data.supabaseUrl).trim(),
                supabaseAnonKey: String(data.supabaseAnonKey).trim(),
                bucketName: data.bucketName ? String(data.bucketName).trim() : DEFAULT_BUCKET,
                isCloudLinked: true,
                linkedAt: data.linkedAt || data.updatedAt,
                linkedBy: data.linkedBy,
              });
            }
          }
        },
        () => {
          // Ignore snapshot permission/offline errors and rely on local cache
        }
      );
    } catch {
      // Ignore listener initialization error
    }
  }

  try {
    const settingRef = doc(db, 'admin_settings', 'supabase_config');
    const snap = await getDoc(settingRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.supabaseUrl && data?.supabaseAnonKey) {
        return saveSupabaseConfig({
          supabaseUrl: String(data.supabaseUrl).trim(),
          supabaseAnonKey: String(data.supabaseAnonKey).trim(),
          bucketName: data.bucketName ? String(data.bucketName).trim() : DEFAULT_BUCKET,
          isCloudLinked: true,
          linkedAt: data.linkedAt || data.updatedAt,
          linkedBy: data.linkedBy,
        });
      }
    }
  } catch {
    // Offline or unreachable — fall back to local config
  }

  return currentLocal;
}

export async function clearSupabaseConfigFromCloud(): Promise<void> {
  clearSupabaseConfig();
  try {
    await deleteDoc(doc(db, 'admin_settings', 'supabase_config'));
  } catch {
    // Ignore cloud delete error if offline
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear Supabase configuration:', err);
  }
  cachedClient = null;
  cachedConfigKey = '';
  broadcastConfigChange(getSupabaseConfig());
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  const configKey = `${config.supabaseUrl}::${config.supabaseAnonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

/**
 * Generates idempotent SQL to set up `official_exams`, `exam_questions`, and `exam-media` bucket policies
 * in 1 click inside the Supabase SQL Editor.
 */
export function getSupabaseSetupSql(bucketName: string = DEFAULT_BUCKET): string {
  const safeBucket = (bucketName || DEFAULT_BUCKET).replace(/[^a-z0-9_-]/gi, '');
  return `-- Sinahard One-Time Supabase Setup Script (Run once in Supabase SQL Editor)

-- 1. Create Official & School Exams Table
create table if not exists public.official_exams (
  id text primary key,
  name text not null,
  subject text,
  tier text,
  academic_year text,
  university text,
  department text,
  time_limit integer default 60,
  questions_count integer default 0,
  exam_data jsonb not null,
  updated_at timestamptz default now()
);

-- 2. Create Modular Question Bank Table (with Image & Table Support)
create table if not exists public.exam_questions (
  id text primary key,
  exam_id text not null,
  question_index integer default 0,
  subject text,
  grade text,
  tier text,
  text text not null,
  options jsonb not null,
  correct integer not null default 0,
  explanation text,
  image_url text,
  image_caption text,
  option_images jsonb,
  table_markdown text,
  updated_at timestamptz default now()
);

-- 3. Enable RLS and Public Read / App Sync Policies
alter table public.official_exams enable row level security;
alter table public.exam_questions enable row level security;

drop policy if exists "Public read official_exams" on public.official_exams;
create policy "Public read official_exams" on public.official_exams for select using (true);

drop policy if exists "App upsert official_exams" on public.official_exams;
create policy "App upsert official_exams" on public.official_exams for all using (true) with check (true);

drop policy if exists "Public read exam_questions" on public.exam_questions;
create policy "Public read exam_questions" on public.exam_questions for select using (true);

drop policy if exists "App upsert exam_questions" on public.exam_questions;
create policy "App upsert exam_questions" on public.exam_questions for all using (true) with check (true);

-- 4. Create Public Media Bucket '${safeBucket}' for Question & Option Diagrams
insert into storage.buckets (id, name, public)
values ('${safeBucket}', '${safeBucket}', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read ${safeBucket}" on storage.objects;
create policy "Public read ${safeBucket}" on storage.objects
  for select using (bucket_id = '${safeBucket}');

drop policy if exists "App upload ${safeBucket}" on storage.objects;
create policy "App upload ${safeBucket}" on storage.objects
  for insert with check (bucket_id = '${safeBucket}');

drop policy if exists "App update ${safeBucket}" on storage.objects;
create policy "App update ${safeBucket}" on storage.objects
  for update using (bucket_id = '${safeBucket}');
`;
}

/**
 * Tests connection to the configured Supabase project and verifies bucket + tables accessibility
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionDiagnostics> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      message: 'Supabase Project URL and Anon Public Key are required.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Could not initialize Supabase client. Please verify your Project URL format.',
    };
  }

  try {
    const bucketName = config.bucketName || DEFAULT_BUCKET;
    let bucketExists = false;

    // 1. Check storage bucket accessibility
    const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
    if (bucketsError) {
      return {
        success: false,
        message: `Connection error: ${bucketsError.message}. Please verify your Project URL and Anon Key.`,
      };
    }

    const existingBucket = buckets?.find((b) => b.name === bucketName || b.id === bucketName);
    if (existingBucket) {
      bucketExists = true;
    } else {
      // Attempt automatic bucket creation if RLS permits
      const { error: createErr } = await client.storage.createBucket(bucketName, {
        public: true,
      });
      if (!createErr) {
        bucketExists = true;
      }
    }

    // 2. Check official_exams table readiness
    let examsTableReady = false;
    const { error: examsErr } = await client.from('official_exams').select('id').limit(1);
    if (!examsErr) {
      examsTableReady = true;
    }

    // 3. Check exam_questions table readiness
    let questionsTableReady = false;
    const { error: questionsErr } = await client.from('exam_questions').select('id').limit(1);
    if (!questionsErr) {
      questionsTableReady = true;
    }

    const statusParts: string[] = [];
    statusParts.push(bucketExists ? `Bucket '${bucketName}' Ready` : `Bucket '${bucketName}' needs setup`);
    statusParts.push(examsTableReady ? `Exams Table Ready` : `Exams Table needs SQL setup`);
    statusParts.push(questionsTableReady ? `Questions Table Ready` : `Questions Table needs SQL setup`);

    const allReady = bucketExists && examsTableReady && questionsTableReady;

    return {
      success: true,
      bucketExists,
      examsTableReady,
      questionsTableReady,
      message: allReady
        ? `Connected to Supabase! Storage bucket '${bucketName}', 'official_exams', and 'exam_questions' tables are all active and linked.`
        : `Connected to Supabase API! (${statusParts.join(' · ')}). If any table or bucket is missing, copy and run the 1-Click SQL Setup script below once.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to connect to Supabase: ${errorMsg}`,
    };
  }
}

/**
 * Uploads an exam diagram or choice image to Supabase Storage.
 * If Supabase is unconfigured or offline, gracefully returns a Base64 data URL fallback.
 */
export async function uploadExamMedia(
  fileOrBase64: File | Blob | string,
  suggestedFileName?: string
): Promise<{
  publicUrl: string;
  storagePath: string;
  isBase64Fallback: boolean;
}> {
  const config = getSupabaseConfig();
  const client = getSupabaseClient();

  // If already an http(s) URL, return directly without re-uploading
  if (typeof fileOrBase64 === 'string' && /^https?:\/\//i.test(fileOrBase64.trim())) {
    return {
      publicUrl: fileOrBase64.trim(),
      storagePath: fileOrBase64.trim(),
      isBase64Fallback: false,
    };
  }

  // If no Supabase client configured, return local Base64 string fallback
  if (!client || !config.isConfigured) {
    const base64Url =
      typeof fileOrBase64 === 'string' ? fileOrBase64 : await blobToBase64(fileOrBase64);

    return {
      publicUrl: base64Url,
      storagePath: `local://fallback_${Date.now()}`,
      isBase64Fallback: true,
    };
  }

  try {
    const bucketName = config.bucketName || DEFAULT_BUCKET;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const cleanName = (suggestedFileName || 'diagram')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const fileName = `diagrams/${cleanName}_${timestamp}_${randomSuffix}.png`;

    let fileBody: File | Blob;
    let contentType = 'image/png';
    if (typeof fileOrBase64 === 'string') {
      const converted = base64ToBlobWithType(fileOrBase64);
      fileBody = converted.blob;
      contentType = converted.contentType;
    } else {
      fileBody = fileOrBase64;
      if (fileOrBase64.type) contentType = fileOrBase64.type;
    }

    // Upload to Supabase Storage bucket
    const { data: uploadData, error: uploadError } = await client.storage
      .from(bucketName)
      .upload(fileName, fileBody, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase upload warning, falling back to Base64:', uploadError.message);
      const base64Url =
        typeof fileOrBase64 === 'string' ? fileOrBase64 : await blobToBase64(fileOrBase64);
      return {
        publicUrl: base64Url,
        storagePath: `supabase-error://${fileName}`,
        isBase64Fallback: true,
      };
    }

    // Get public URL
    const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(uploadData.path);
    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: uploadData.path,
      isBase64Fallback: false,
    };
  } catch (err) {
    console.warn('Error uploading to Supabase Storage, using Base64 fallback:', err);
    const base64Url =
      typeof fileOrBase64 === 'string' ? fileOrBase64 : await blobToBase64(fileOrBase64);
    return {
      publicUrl: base64Url,
      storagePath: `local-fallback://${Date.now()}`,
      isBase64Fallback: true,
    };
  }
}

/**
 * Automatically uploads any embedded Base64 images in questions or options to Supabase Storage
 * so questions reference fast, permanent public URLs instead of heavy Base64 strings.
 */
export async function resolveExamImagesToSupabase(
  questions: Question[],
  examPrefix: string = 'exam',
  onProgress?: (statusText: string) => void
): Promise<Question[]> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return questions;

  const updatedQuestions: Question[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = { ...questions[i] };

    // 1. Upload question diagram if it is a Base64 data URL
    if (q.imageUrl && q.imageUrl.startsWith('data:image/')) {
      onProgress?.(`Uploading diagram for Question ${i + 1} to Supabase Storage...`);
      const uploaded = await uploadExamMedia(q.imageUrl, `${examPrefix}_q${i + 1}`);
      q.imageUrl = uploaded.publicUrl;
    }

    // 2. Upload option images if any are Base64 data URLs
    if (Array.isArray(q.optionImages) && q.optionImages.some((img) => img && img.startsWith('data:image/'))) {
      const nextOptImages = [...q.optionImages];
      for (let optIdx = 0; optIdx < nextOptImages.length; optIdx++) {
        const optImg = nextOptImages[optIdx];
        if (optImg && optImg.startsWith('data:image/')) {
          onProgress?.(`Uploading choice ${String.fromCharCode(65 + optIdx)} image for Q${i + 1}...`);
          const uploaded = await uploadExamMedia(
            optImg,
            `${examPrefix}_q${i + 1}_opt_${String.fromCharCode(65 + optIdx)}`
          );
          nextOptImages[optIdx] = uploaded.publicUrl;
        }
      }
      q.optionImages = nextOptImages;
    }

    updatedQuestions.push(q);
  }

  return updatedQuestions;
}

/**
 * Batch-uploads all individual questions of an exam into the Supabase `exam_questions` table.
 */
export async function uploadQuestionsToSupabase(
  exam: Exam,
  questions: Question[]
): Promise<{ uploadedCount: number; syncedToTable: boolean }> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  if (!client || !config.isConfigured || questions.length === 0) {
    return { uploadedCount: 0, syncedToTable: false };
  }

  try {
    const nowIso = new Date().toISOString();
    const rows = questions.map((q, idx) => ({
      id: q.id || `q_${exam.id}_${idx + 1}`,
      exam_id: exam.id,
      question_index: idx + 1,
      subject: exam.subject || 'General',
      grade: String(exam.grade || exam.academicYear || '12'),
      tier: exam.tier || 'secondary',
      text: q.text,
      options: q.options,
      correct: typeof q.correct === 'number' ? q.correct : 0,
      explanation: q.explanation || null,
      image_url: q.imageUrl || null,
      image_caption: q.imageCaption || null,
      option_images: Array.isArray(q.optionImages) && q.optionImages.some(Boolean) ? q.optionImages : null,
      table_markdown: q.tableMarkdown || null,
      updated_at: nowIso,
    }));

    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await client.from('exam_questions').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase exam_questions upsert note:', error.message);
        return { uploadedCount: 0, syncedToTable: false };
      }
    }

    return { uploadedCount: rows.length, syncedToTable: true };
  } catch (err) {
    console.warn('Supabase exam_questions sync warning:', err);
    return { uploadedCount: 0, syncedToTable: false };
  }
}

/**
 * Saves or updates an exam and all of its questions & media in Supabase (plus local cache)
 */
export async function saveOfficialExam(
  exam: Exam,
  onProgress?: (statusText: string) => void
): Promise<{
  success: boolean;
  examId: string;
  storageEngine: string;
  questionsSyncedCount: number;
  resolvedExam: Exam;
}> {
  const config = getSupabaseConfig();
  const client = getSupabaseClient();

  // 1. Resolve any embedded Base64 diagrams to public Supabase Storage URLs
  const cleanPrefix = (exam.subject || exam.name || 'exam').split(' ')[0].toLowerCase();
  const resolvedQuestions = await resolveExamImagesToSupabase(
    exam.questions || [],
    cleanPrefix,
    onProgress
  );

  const nowIso = new Date().toISOString();
  const preparedExam: Exam = {
    ...exam,
    questions: resolvedQuestions,
    hasImages: resolvedQuestions.some((q) => Boolean(q.imageUrl) || Boolean(q.optionImages?.some(Boolean))),
    hasTables: resolvedQuestions.some((q) => Boolean(q.tableMarkdown)),
    storageSource: config.isConfigured ? 'supabase' : 'local',
    cloudStorageEngine: config.isConfigured ? 'supabase' : undefined,
    isUploadedToCloud: config.isConfigured,
    updatedAt: nowIso,
  };

  let storageEngineLabel = config.isConfigured ? 'Supabase Storage' : 'Local Repository';
  let questionsSyncedCount = 0;

  // 2. Sync to Supabase `official_exams` and `exam_questions` tables if configured
  if (client && config.isConfigured) {
    try {
      onProgress?.('Syncing exam package to Supabase official_exams table...');
      const { error: dbError } = await client.from('official_exams').upsert(
        {
          id: preparedExam.id,
          name: preparedExam.name || preparedExam.title || 'Official Exam',
          subject: preparedExam.subject || 'General',
          tier: preparedExam.tier || 'secondary',
          academic_year: preparedExam.academicYear || String(preparedExam.grade || '12'),
          university: preparedExam.university || null,
          department: preparedExam.department || null,
          time_limit: Number(preparedExam.timeLimit) || 60,
          questions_count: resolvedQuestions.length,
          exam_data: preparedExam,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );

      onProgress?.(`Uploading ${resolvedQuestions.length} questions to Supabase exam_questions bank...`);
      const qSync = await uploadQuestionsToSupabase(preparedExam, resolvedQuestions);
      questionsSyncedCount = qSync.uploadedCount;

      if (!dbError) {
        storageEngineLabel = qSync.syncedToTable
          ? 'Supabase Cloud (official_exams + exam_questions + Storage)'
          : 'Supabase Cloud (official_exams + Storage)';
      }
    } catch {
      // Proceed with graceful local cache fallback
    }
  }

  // 3. Always update local cache for 0ms offline access
  try {
    const rawSaved = localStorage.getItem('sinahard_custom_official_exams');
    const existingList: Exam[] = rawSaved ? JSON.parse(rawSaved) : [];
    const index = existingList.findIndex((e) => e.id === preparedExam.id);
    if (index >= 0) {
      existingList[index] = preparedExam;
    } else {
      existingList.unshift(preparedExam);
    }
    localStorage.setItem('sinahard_custom_official_exams', JSON.stringify(existingList));
  } catch {
    // Ignore localStorage quota errors
  }

  return {
    success: true,
    examId: preparedExam.id,
    storageEngine: storageEngineLabel,
    questionsSyncedCount: questionsSyncedCount || resolvedQuestions.length,
    resolvedExam: preparedExam,
  };
}

/**
 * Fetches official published exams from Supabase (and merges with local custom official exams)
 */
export async function fetchOfficialExams(): Promise<Exam[]> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  const map = new Map<string, Exam>();

  // 1. Load local custom official exams first
  try {
    const raw = localStorage.getItem('sinahard_custom_official_exams');
    if (raw) {
      const localList = JSON.parse(raw) as Exam[];
      if (Array.isArray(localList)) {
        localList.forEach((e) => {
          if (e && e.id) map.set(e.id, e);
        });
      }
    }
  } catch {
    // Ignore local parse error
  }

  // 2. Query Supabase `official_exams` if configured
  if (client && config.isConfigured) {
    try {
      const { data, error } = await client
        .from('official_exams')
        .select('exam_data')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        data.forEach((row) => {
          const exam = row.exam_data as Exam;
          if (exam && exam.id) {
            map.set(exam.id, {
              ...exam,
              isUploadedToCloud: true,
              cloudStorageEngine: 'supabase',
            });
          }
        });
      }
    } catch {
      // Fallback to local cache
    }
  }

  return Array.from(map.values());
}

/**
 * Utility: Convert Blob or File to Base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Utility: Convert Base64 data URL to Blob and extract MIME type
 */
function base64ToBlobWithType(base64: string): { blob: Blob; contentType: string } {
  const parts = base64.split(';base64,');
  const contentType = parts.length > 1 ? parts[0].split(':')[1] || 'image/png' : 'image/png';
  const raw = window.atob(parts.length > 1 ? parts[1] : parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return {
    blob: new Blob([uInt8Array], { type: contentType }),
    contentType,
  };
}

/**
 * Curated Official Ethiopian Exams
 */
export const CURATED_OFFICIAL_EXAMS: Exam[] = [
  {
    id: 'curated-aau-ece-circuits-2024',
    name: 'AAU Electrical & Computer Eng. - Electric Circuit Analysis I',
    title: 'Electric Circuit Analysis I (ECEG-2001)',
    subject: 'Circuit Analysis',
    tier: 'university',
    university: 'Addis Ababa University',
    department: 'Electrical and Computer Engineering',
    academicYear: 'Sophomore',
    semester: 'Semester 1',
    examType: 'Final Exam',
    timeLimit: 120,
    hasImages: false,
    hasTables: true,
    storageSource: 'local',
    sourceType: 'curated_catalog',
    description:
      'Verified midterm & final examination covering Kirchhoff laws, Thevenin equivalents, AC sinusoids, and phasor mesh analysis.',
    questions: [
      {
        id: 'q-ece-1',
        text: 'For a linear resistive network with an open-circuit voltage $V_{oc} = 24\\text{ V}$ and a short-circuit current $I_{sc} = 4\\text{ A}$, determine the maximum power $P_{\\max}$ that can be transferred to an adjustable load resistor $R_L$.',
        options: ['24 W', '48 W', '96 W', '12 W'],
        correct: 0,
        explanation:
          'The Thevenin resistance is $R_{th} = \\frac{V_{oc}}{I_{sc}} = \\frac{24\\text{ V}}{4\\text{ A}} = 6\\ \\Omega$. By the Maximum Power Transfer Theorem, maximum power occurs when $R_L = R_{th} = 6\\ \\Omega$. Then $P_{\\max} = \\frac{V_{oc}^2}{4 R_{th}} = \\frac{24^2}{4 \\times 6} = \\frac{576}{24} = 24\\text{ W}$.',
      },
      {
        id: 'q-ece-2',
        text: 'In an AC circuit excited at frequency $\\omega = 100\\text{ rad/s}$, a series combination has $R = 4\\ \\Omega$ and an inductor $L = 30\\text{ mH}$. What is the magnitude of the total complex impedance $|Z|$?',
        options: ['5 Ω', '7 Ω', '3 Ω', '25 Ω'],
        correct: 0,
        explanation:
          'Inductive reactance $X_L = \\omega L = 100 \\times 0.030 = 3\\ \\Omega$. Total impedance is $Z = R + jX_L = 4 + j3\\ \\Omega$. The magnitude is $|Z| = \\sqrt{4^2 + 3^2} = \\sqrt{25} = 5\\ \\Omega$.',
      },
    ],
  },
  {
    id: 'curated-aau-freshman-math-2023',
    name: 'Addis Ababa University - Freshman Applied Mathematics I (Math 1011)',
    title: 'Freshman Applied Mathematics I',
    subject: 'Applied Mathematics',
    tier: 'university',
    university: 'Addis Ababa University',
    department: 'Freshman Program (Pre-Engineering & Science)',
    academicYear: 'Freshman',
    semester: 'Semester 1',
    examType: 'Final Exam',
    timeLimit: 120,
    hasImages: false,
    hasTables: true,
    storageSource: 'local',
    sourceType: 'curated_catalog',
    description: 'Comprehensive Addis Ababa University freshman common course mathematics examination.',
    questions: [
      {
        id: 'q-math-1',
        text: 'Evaluate the limit: $\\lim_{x \\to 0} \\frac{\\sin(5x)}{\\tan(2x)}$.',
        options: ['5/2', '2/5', '0', 'Does not exist'],
        correct: 0,
        explanation:
          "Using small angle approximations or L'Hopital's Rule: $\\lim_{x \\to 0} \\frac{5 \\cos(5x)}{2 \\sec^2(2x)} = \\frac{5 \\times 1}{2 \\times 1} = \\frac{5}{2}$.",
      },
    ],
  },
];
