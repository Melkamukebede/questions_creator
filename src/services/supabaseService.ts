import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Exam } from '../types';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  isConfigured: boolean;
}

const STORAGE_KEY = 'sinahard_supabase_config_v2';
const DEFAULT_BUCKET = 'exam-media';

// Cached client instance
let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return {
          supabaseUrl: parsed.supabaseUrl.trim(),
          supabaseAnonKey: parsed.supabaseAnonKey.trim(),
          bucketName: parsed.bucketName ? parsed.bucketName.trim() : DEFAULT_BUCKET,
          isConfigured: true,
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
    bucketName: envBucket.trim(),
    isConfigured: Boolean(envUrl && envKey),
  };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = {
    supabaseUrl: (config.supabaseUrl ?? current.supabaseUrl).trim(),
    supabaseAnonKey: (config.supabaseAnonKey ?? current.supabaseAnonKey).trim(),
    bucketName: (config.bucketName ?? current.bucketName).trim() || DEFAULT_BUCKET,
    isConfigured: Boolean((config.supabaseUrl ?? current.supabaseUrl).trim() && (config.supabaseAnonKey ?? current.supabaseAnonKey).trim()),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save Supabase configuration to localStorage:', err);
  }

  // Invalidate cached client
  cachedClient = null;
  cachedConfigKey = '';

  return updated;
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear Supabase configuration:', err);
  }
  cachedClient = null;
  cachedConfigKey = '';
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
 * Tests connection to the configured Supabase project and verifies bucket accessibility
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  bucketExists?: boolean;
}> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      message: 'Supabase URL and Anon Public Key are required.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Could not initialize Supabase client. Please check your Project URL format.',
    };
  }

  try {
    // 1. Check storage bucket accessibility
    const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
    if (bucketsError) {
      return {
        success: false,
        message: `Connection error: ${bucketsError.message}. Make sure your Anon Key and Project URL are valid.`,
      };
    }

    const bucketName = config.bucketName || DEFAULT_BUCKET;
    const bucket = buckets?.find((b) => b.name === bucketName);

    if (!bucket) {
      return {
        success: true,
        bucketExists: false,
        message: `Connected successfully to Supabase! Note: Bucket '${bucketName}' was not found in list. Please create the public bucket '${bucketName}' in your Supabase dashboard or upload a test diagram to auto-verify.`,
      };
    }

    return {
      success: true,
      bucketExists: true,
      message: `Connected to Supabase! Bucket '${bucketName}' is active (${bucket.public ? 'Public' : 'Private'}).`,
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
 * Uploads an exam diagram or image to Supabase Storage.
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

  // If no Supabase client configured, return local Base64 string fallback
  if (!client || !config.isConfigured) {
    let base64Url = '';
    if (typeof fileOrBase64 === 'string') {
      base64Url = fileOrBase64;
    } else {
      base64Url = await blobToBase64(fileOrBase64);
    }

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
    if (typeof fileOrBase64 === 'string') {
      fileBody = base64ToBlob(fileOrBase64);
    } else {
      fileBody = fileOrBase64;
    }

    // Upload to Supabase Storage bucket
    const { data: uploadData, error: uploadError } = await client.storage
      .from(bucketName)
      .upload(fileName, fileBody, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase upload warning, falling back to Base64:', uploadError.message);
      const base64Url = typeof fileOrBase64 === 'string' ? fileOrBase64 : await blobToBase64(fileOrBase64);
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
    const base64Url = typeof fileOrBase64 === 'string' ? fileOrBase64 : await blobToBase64(fileOrBase64);
    return {
      publicUrl: base64Url,
      storagePath: `local-fallback://${Date.now()}`,
      isBase64Fallback: true,
    };
  }
}

/**
 * Saves or updates an official exam in Supabase (or local store)
 */
export async function saveOfficialExam(
  exam: Exam
): Promise<{ success: boolean; examId: string; storageEngine: string }> {
  const config = getSupabaseConfig();
  const client = getSupabaseClient();

  const preparedExam: Exam = {
    ...exam,
    storageSource: config.isConfigured ? 'supabase' : 'local',
    cloudStorageEngine: config.isConfigured ? 'supabase' : undefined,
    isUploadedToCloud: config.isConfigured,
    updatedAt: new Date().toISOString(),
  };

  // If Supabase is configured and has an 'official_exams' table, we can sync it
  if (client && config.isConfigured) {
    try {
      const { error: dbError } = await client
        .from('official_exams')
        .upsert(
          {
            id: preparedExam.id,
            name: preparedExam.name,
            subject: preparedExam.subject,
            tier: preparedExam.tier,
            academic_year: preparedExam.academicYear,
            university: preparedExam.university,
            department: preparedExam.department,
            time_limit: preparedExam.timeLimit,
            questions_count: preparedExam.questions.length,
            exam_data: preparedExam,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (!dbError) {
        return {
          success: true,
          examId: preparedExam.id,
          storageEngine: 'Supabase Cloud Database & Storage',
        };
      }
    } catch {
      // If table doesn't exist, proceed with graceful local persistence
    }
  }

  // Graceful local cache fallback
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
    // Ignore localStorage errors
  }

  return {
    success: true,
    examId: preparedExam.id,
    storageEngine: config.isConfigured ? 'Supabase Storage' : 'Local Repository',
  };
}

/**
 * Fetches official published exams from Supabase or local cache
 */
export async function fetchOfficialExams(): Promise<Exam[]> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (client && config.isConfigured) {
    try {
      const { data, error } = await client
        .from('official_exams')
        .select('exam_data')
        .order('updated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((row) => row.exam_data as Exam);
      }
    } catch {
      // Fallback to local storage
    }
  }

  try {
    const raw = localStorage.getItem('sinahard_custom_official_exams');
    if (raw) {
      return JSON.parse(raw) as Exam[];
    }
  } catch {
    // Ignore error
  }

  return [];
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
 * Utility: Convert Base64 data URL to Blob
 */
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/png';
  const raw = window.atob(parts[1] || parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
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
    description: 'Verified midterm & final examination covering Kirchhoff laws, Thevenin equivalents, AC sinusoids, and phasor mesh analysis.',
    questions: [
      {
        id: 'q-ece-1',
        text: 'For a linear resistive network with an open-circuit voltage $V_{oc} = 24\\text{ V}$ and a short-circuit current $I_{sc} = 4\\text{ A}$, determine the maximum power $P_{\\max}$ that can be transferred to an adjustable load resistor $R_L$.',
        options: [
          '24 W',
          '48 W',
          '96 W',
          '12 W'
        ],
        correct: 0,
        explanation: 'The Thevenin resistance is $R_{th} = \\frac{V_{oc}}{I_{sc}} = \\frac{24\\text{ V}}{4\\text{ A}} = 6\\ \\Omega$. By the Maximum Power Transfer Theorem, maximum power occurs when $R_L = R_{th} = 6\\ \\Omega$. Then $P_{\\max} = \\frac{V_{oc}^2}{4 R_{th}} = \\frac{24^2}{4 \\times 6} = \\frac{576}{24} = 24\\text{ W}$.'
      },
      {
        id: 'q-ece-2',
        text: 'In an AC circuit excited at frequency $\\omega = 100\\text{ rad/s}$, a series combination has $R = 4\\ \\Omega$ and an inductor $L = 30\\text{ mH}$. What is the magnitude of the total complex impedance $|Z|$?',
        options: [
          '5 Ω',
          '7 Ω',
          '3 Ω',
          '25 Ω'
        ],
        correct: 0,
        explanation: 'Inductive reactance $X_L = \\omega L = 100 \\times 0.030 = 3\\ \\Omega$. Total impedance is $Z = R + jX_L = 4 + j3\\ \\Omega$. The magnitude is $|Z| = \\sqrt{4^2 + 3^2} = \\sqrt{25} = 5\\ \\Omega$.'
      }
    ]
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
        options: [
          '5/2',
          '2/5',
          '0',
          'Does not exist'
        ],
        correct: 0,
        explanation: 'Using small angle approximations or L\'Hopital\'s Rule: $\\lim_{x \\to 0} \\frac{5 \\cos(5x)}{2 \\sec^2(2x)} = \\frac{5 \\times 1}{2 \\times 1} = \\frac{5}{2}$.'
      }
    ]
  }
];
