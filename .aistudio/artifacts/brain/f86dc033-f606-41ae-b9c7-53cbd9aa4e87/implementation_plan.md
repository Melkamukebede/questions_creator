# Implementation Plan: Supabase Linking, Admin Official Exam Studio & In-App Offline Repository

## 1. Problem Statement & Architecture Goals
The user requires four core enhancements:
1. **Interactive Step-by-Step Supabase Linking Guide & SQL Generator**:
   A visual, copy-ready setup wizard inside the app explaining exactly how to link Supabase with Sinahard (Project creation, SQL table creation, public storage bucket `exam-media`, and API keys).
2. **Admin-Only Official Exam Studio & Image Uploader**:
   Only verified administrators (`melkamukebede11@gmail.com` / `user.role === 'admin'`) can publish official exams and upload diagram images to Supabase Storage.
3. **In-App Offline Question Storage (No Raw File Downloads)**:
   Change "Download SQLite Bundle" to "Download Questions". When clicked, instead of triggering a browser download of a `.sqlite` file, it saves the questions directly into the student's in-app **Exams Repository** (`FilesView`), enabling seamless zero-data offline practice.
4. **Resolution of WASM Fetch Failure**:
   Eliminate the `"Export error: both async and sync fetching of the wasm failed"` error by removing dependency on external CDN `.wasm` file fetches, providing resilient local storage in `IndexedDB` / `localStorage`.

---

## 2. Proposed Implementation Steps

### Step 1: Interactive Supabase Linking Guide & SQL Generator
- **Location**: `src/components/SupabaseConfigModal.tsx` & `src/services/supabaseService.ts`
- **Features**:
  - Add an interactive 4-step accordion guide:
    - **Step 1**: Create a free Supabase project at `https://supabase.com`.
    - **Step 2**: Run the provided SQL migration in the Supabase SQL Editor (creates `official_exams` table, indexes, and read-public RLS).
    - **Step 3**: Create a public Storage bucket named `exam-media` with public read access.
    - **Step 4**: Copy the Project URL and `anon` public key into Sinahard and test connection.
  - Add a **Copy SQL Schema** button with complete DDL statements for `official_exams` and storage policies.

### Step 2: Dedicated Admin Official Exam Studio with Image Uploader
- **Location**: `src/components/AdminOfficialExamStudioModal.tsx` (new component)
- **Features**:
  - Strict RBAC: Accessible only when `isAdmin` is true (`user.email === 'melkamukebede11@gmail.com'` or admin role).
  - University and Grade metadata selector (University, Department, Academic Year, Semester, Exam Type).
  - Direct diagram / circuit image upload zone:
    - Uploads file directly to Supabase Storage bucket `exam-media`.
    - Automatically retrieves public CDN URL.
    - Inserts public URL into target question's `imageUrl` field.
  - Markdown table generator with KaTeX support.
  - 1-Click **Publish to Supabase Cloud** button that writes directly to the `official_exams` table in PostgreSQL.

### Step 3: In-App Question Storage & Repository Mounting (Zero File Clutter)
- **Location**: `src/components/DownloadCenterModal.tsx` & `src/services/db.ts`
- **Features**:
  - Replace "Download SQLite Bundle" button with **"Download Questions (Save to My Exams)"**.
  - When the user selects a year duration (All Years, 1–3 Years, 1–5 Years) and clicks download:
    - Instead of prompting a `.sqlite` file download, the selected exams are saved directly into the user's persistent local `exams` repository (`saveLocalExams`).
    - The exams appear instantly in **Exams Repository** (`FilesView`) with badges (`Downloaded`, `Offline Ready`, `University/Secondary`).
    - The student can immediately tap **Practice** anytime without internet.

### Step 4: Fix WASM Fetch Failure in SQLite Service
- **Location**: `src/services/sqliteService.ts`
- **Changes**:
  - Fix the `both async and sync fetching of the wasm failed` error by wrapping `sql.js` initialization with safe error handling and CDN fallback URLs.
  - Implement an in-memory JSON fallback exporter so if WASM is blocked by the environment, the app exports questions cleanly without throwing unhandled exceptions.
  - Provide a safe `storeBundleLocally` method that writes directly to browser storage without requiring WASM execution.

### Step 5: Verification & Testing
- Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` (`vite build`) to verify production compilation.
- Restart dev server and verify the full workflow:
  - Admin image upload & official exam publishing.
  - Student in-app question download without `.sqlite` file popup.
  - Instant offline practice with diagrams and tables in `PracticeModal`.
