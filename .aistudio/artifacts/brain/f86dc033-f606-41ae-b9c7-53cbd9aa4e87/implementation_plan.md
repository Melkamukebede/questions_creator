# Supabase Storage Migration (No Credit Card) & System Color Theme Restoration

A complete plan to transition Sinahard's diagram and exam media storage from Cloudflare R2 to **Supabase Storage** (which requires **no credit card** on its free tier), restore the original **Emerald & Navy** visual system colors, and maintain 100% offline KaTeX and SQLite capabilities.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Key Decisions & Rationale:**
> - **Zero-Cost Storage Without Credit Card**: Cloudflare R2 requires entering a credit card during onboarding even for its free tier. In contrast, **Supabase Storage** provides 1 GB of free storage, 2 GB of bandwidth, and 50,000 monthly active users on its Free tier with **zero credit card required** (sign up with GitHub or email).
> - **Color Theme Restoration**: All temporary orange Cloudflare accents (`text-orange-500`, `bg-orange-500/10`) will be replaced with Sinahard's cohesive **Emerald & Deep Navy** system colors (`emerald-500/600`, `teal-500`, `#070e1a`, `#0c182b`).
> - **Strict Admin Access**: Supabase cloud credentials management is strictly restricted to `melkamukebede11@gmail.com`. Non-admins see zero configuration triggers or setup prompts.
> - **Preserved Offline Engine**: The offline KaTeX math rendering and SQLite multi-year exam downloader will remain 100% intact with automatic Base64 image fallback when offline.

---

### 1. Overview & Core Concept

- **What It Delivers**:
  1. **Credit-Card-Free Media Storage**: Seamless diagram upload to Supabase's `exam-media` bucket using Supabase's public URL and Anonymous Key (safe for frontend use with Row Level Security).
  2. **Harmonious System Color Palette**: Restores the original Emerald (`#10b981`), Cyan (`#06b6d4`), and Deep Midnight Navy (`#070e1a` / `#0c182b`) design language throughout the navigation bar, drawer, home view, and official exam studio.
  3. **Multi-Tier Academic Levels**: Full support for Ethiopian Secondary (Grades 9–12, Matric) and University levels (Freshman, Sophomore, Junior, Senior, and Exit Exam) including First Year Electrical and Computer Engineering (ECE).
  4. **Fail-Safe Offline Mode**: If Supabase is unconfigured or the user is without internet, diagrams automatically save and render as Base64 data URLs in local IndexedDB and SQLite bundles.

- **Target Persona**: Ethiopian students, teachers, and university engineering candidates who need instant, offline-first exam practice with diagrams, without requiring credit cards or complex cloud billing.

---

### 2. User Experience & Visual Design

- **Admin Supabase Cloud Storage Hub**:
  - Modal with inputs for:
    - **Supabase Project URL** (e.g., `https://xyzproject.supabase.co`)
    - **Supabase Anon / Public Key** (safe public key)
    - **Storage Bucket Name** (default: `exam-media`)
  - A friendly "How to get your free credentials without a credit card in 2 minutes" quick guide.
  - Live **Test Connection** button that validates bucket read/write permissions.
- **Official Exam Studio**:
  - Top indicator displays a clean emerald badge: **"Supabase Ready"** (or **"Local Storage Mode"** when offline).
  - Pre-Publish Preview displaying full question stems, answer choices ($A, B, C, D$) with interactive radio options, step-by-step explanations, and rendered KaTeX formulas.
  - "Publish to Supabase" button with progress feedback and automatic local cache synchronization.
- **Visual Design Restoration**:
  - Dominant Dark Surface: `#070e1a` (Background) and `#0c182b` / `#0f1d33` (Elevated Cards).
  - Primary Accent: `emerald-500` / `emerald-600` with subtle `emerald-500/20` border glows.
  - Secondary Accent: `cyan-400` / `teal-400` for engineering courses and exit exam badges.
  - Removal of all orange badges and Cloudflare labels in the Navbar, Drawer, Home View, and Download Center.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Supabase Storage vs. Cloudflare R2 vs. Firebase Storage**
  - *Chosen Approach*: Supabase Storage (Free tier, no credit card required) combined with existing Firebase Firestore auth/metadata sync.
  - *Why*: Cloudflare R2 mandates credit card verification during account creation. Supabase allows immediate free tier creation with standard email/password or GitHub with zero billing hurdles.
  - *Alternatives Considered*: Firebase Storage (requires enabling Blaze pay-as-you-go plan for custom bucket rules, which also asks for billing verification).

- **Decision 2: Client-Side Supabase Anon Key vs. Server Proxy**
  - *Chosen Approach*: Supabase client initialized with Project URL and Anonymous Public Key, supplemented by a lightweight backend proxy endpoint in `server.ts` for credential persistence.
  - *Why*: Supabase's `anon` key is architected specifically for safe browser usage protected by Row Level Security (RLS) and bucket policies, unlike AWS S3 secret access keys.

- **Decision 3: Retaining Bundled KaTeX & Offline First Design**
  - *Chosen Approach*: Keep `katex/dist/katex.min.css` bundled in `main.tsx`.
  - *Why*: Completely resolves the Service Worker CORS/opaque response error and ensures math formulas render instantly offline without external jsDelivr requests.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   React Client (Vite)                  │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │  Official Exam Studio │   │ Local KaTeX Bundled  │  │
│  │  (Emerald & Navy UI)  │   │ (100% Offline Math)  │  │
│  └───────────┬───────────┘   └──────────────────────┘  │
└──────────────┼─────────────────────────────────────────┘
               │ (Diagram Upload & Cloud Sync)
               ▼
┌────────────────────────────────────────────────────────┐
│             Supabase Service (supabaseService.ts)      │
│                                                        │
│  - uploadExamMedia(file) ──► /storage/v1/object/upload │
│  - saveOfficialExam(exam)──► Cloud + Local DB sync     │
│  - testConnection()      ──► Ping storage bucket       │
└──────────────┬───────────────────────────────┬─────────┘
               │ (Online with credentials)     │ (Offline / No keys)
               ▼                               ▼
┌──────────────────────────────┐ ┌───────────────────────────┐
│     Supabase Free Cloud      │ │   Local IndexedDB/SQLite  │
│                              │ │                           │
│ - Bucket: 'exam-media'       │ │ - Offline Base64 Fallback │
│ - 1 GB Free (No Credit Card) │ │ - Multi-Year .db Bundles  │
│ - Public CDN image URLs      │ │ - 100% Zero-Network Ready │
└──────────────────────────────┘ └───────────────────────────┘
```

#### Step-by-Step Implementation Sequence:

1. **Package Management & Dependencies**:
   - Re-install `@supabase/supabase-js` and uninstall `@aws-sdk/client-s3`.
   - Run `npm install` to keep `package.json` and `package-lock.json` in sync, preventing Cloudflare/CI `npm ci` build failures.

2. **Supabase Service Implementation (`src/services/supabaseService.ts`)**:
   - Recreate `supabaseService.ts` with:
     - `getSupabaseConfig()`, `saveSupabaseConfig(url, anonKey, bucket)`
     - `testSupabaseConnection()`
     - `uploadExamMedia()`: Uploads PNG/JPG/WebP diagrams to Supabase Storage; generates public asset URL; falls back to Base64 data URL if unconfigured or offline.
     - `saveOfficialExam()`, `fetchOfficialExams()`

3. **Supabase Admin Configuration Modal (`src/components/SupabaseConfigModal.tsx`)**:
   - Restore the modal with Emerald system styling (`border-emerald-500/20`, emerald connection badge).
   - Clear guidance on creating a free Supabase bucket (`exam-media`) with public access.
   - Restricted strictly to `melkamukebede11@gmail.com`.

4. **Official Exam Studio & System Colors Restoration**:
   - In `AdminOfficialExamStudioModal.tsx`:
     - Update all handlers and state from Cloudflare to Supabase.
     - Replace orange badges with emerald "Supabase Ready" / "Local Storage Mode" pills.
   - In `HomeView.tsx`, `Navbar.tsx`, `AppDrawer.tsx`, and `DownloadCenterModal.tsx`:
     - Replace "Cloudflare R2" button and orange accents with "Supabase Cloud" and the app's native emerald theme colors.

5. **Clean Server Endpoints (`server.ts`)**:
   - Replace Cloudflare proxy endpoints with `/api/storage/supabase-config` and `/api/storage/test-connection`.

6. **Build & Lint Verification**:
   - Run `compile_applet` and `lint_applet` together to verify 0 errors.
   - Verify `npm ci --dry-run` passes cleanly.
