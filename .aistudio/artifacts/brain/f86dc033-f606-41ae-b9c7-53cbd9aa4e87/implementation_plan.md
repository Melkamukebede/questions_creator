# Cloudflare R2 Migration & Service Worker / KaTeX Offline Resolution

A comprehensive plan to resolve the Service Worker network error, bundle KaTeX locally for offline mathematics rendering, clarify PWA install behavior, and replace Supabase with a secure Full-Stack Cloudflare R2 storage architecture.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
> - **Storage Architecture**: Full-Stack Cloudflare R2 via a secure server proxy route (`/api/storage/*`), eliminating all Supabase code and packages.
> - **KaTeX Styling & Fonts**: Bundle KaTeX locally inside the application build for 100% offline math rendering, removing external CDN requests to jsDelivr.
> - **PWA Install Banner**: Retain the custom in-app installation flow (`beforeinstallpromptevent.preventDefault()`), which intentionally suppresses the browser's default automated mini-infobar.

---

### 1. Overview & Core Concept

- **What It Delivers**:
  1. **Fix Service Worker & KaTeX Network Error**: Eliminates the `ERR_FAILED` and `"opaque response used for request whose type is not no-cors"` error by bundling `katex/dist/katex.min.css` directly into Vite's asset pipeline, eliminating external network dependencies for formulas and Greek symbols.
  2. **Clean PWA Lifecycle**: Clarifies the Chrome DevTools `Update on reload` setting and preserves the custom in-app PWA install trigger without disruptive browser auto-banners.
  3. **Full Cloudflare R2 Storage Migration**: Replaces Supabase Storage and Postgres client codes with a lightweight, secure Cloudflare R2 integration via Express backend proxy endpoints (`/api/storage/upload`, `/api/storage/config`, `/api/storage/status`), ensuring S3 secret keys never leak to the client browser.
  4. **Resilient Offline Fallbacks**: Automatically falls back to local data URLs and SQLite bundles if Cloudflare R2 credentials are not yet configured or when the device is completely offline.

- **Target Persona**: Ethiopian students, teachers, and university engineering candidates preparing for national entrance, freshman, and senior engineering exams both online and offline.

---

### 2. User Experience & Visual Design

- **Admin Cloudflare Storage Hub**:
  - Replaces the previous Supabase configuration modal with a modern **Cloudflare R2 Storage Configuration Modal** accessible only to administrators.
  - Inputs for: *Cloudflare Account ID*, *R2 Access Key ID*, *R2 Secret Access Key*, *R2 Bucket Name*, and optional *Public R2 Bucket Domain / CDN URL*.
  - Live connection tester testing read/write bucket permissions with a 1-click test ping.
- **Official Exam Studio**:
  - Status indicator changes from "Supabase Ready" to "Cloudflare R2 Ready".
  - Diagram upload buttons directly upload images to Cloudflare R2 via `/api/storage/upload` and immediately insert the public image URL into the exam question.
  - "Publish to Cloudflare R2" button publishes the verified exam record and saves an offline copy in the local repository.
- **Design Alignment**:
  - Consistent deep midnight surfaces (`#070e1a` / `#0c182b`), emerald accents (`emerald-600` / `emerald-500`), clean typography (`Outfit` and `Plus Jakarta Sans`), and zero-pill metadata discipline.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Bundled KaTeX vs. External CDN**
  - *Chosen Approach*: Import `katex/dist/katex.min.css` in `src/index.css` and remove the CDN link from `index.html`.
  - *Why*: The external jsDelivr link caused CORS opaque response failures inside the Service Worker when offline or during DevTools reloads. Bundling KaTeX ensures math renders instantly even in remote regions with zero internet connectivity.
  - *Alternatives Considered*: Tweaking Workbox runtime caching to ignore CORS. Rejected because external CDNs remain a single point of failure in offline environments.

- **Decision 2: Cloudflare R2 via Server Proxy vs. Direct Browser S3 SDK**
  - *Chosen Approach*: Host Cloudflare R2 upload and signing logic on the Node/Express backend (`server.ts` / `/api/storage/*`).
  - *Why*: Cloudflare R2 requires AWS S3 HMAC secret credentials (`SecretAccessKey`). Putting these keys in client React code would expose them in the browser's DevTools Network tab. The server proxy keeps credentials private and secure.
  - *Alternatives Considered*: Supabase (rejected per user request to eliminate Supabase).

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   React Client (Vite)                  │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │  Official Exam Studio │   │ Local KaTeX Bundled  │  │
│  │  (Zero Placeholder)   │   │ (100% Offline Math)  │  │
│  └───────────┬───────────┘   └──────────────────────┘  │
└──────────────┼─────────────────────────────────────────┘
               │ (Admin Diagram Upload / Config)
               ▼
┌────────────────────────────────────────────────────────┐
│              Express Server Proxy (server.ts)          │
│                                                        │
│  POST /api/storage/upload ──► AWS S3 / R2 SDK Client   │
│  GET  /api/storage/status ──► Bucket Ping / Verify     │
│  POST /api/storage/config ──► Store admin credentials  │
└──────────────────────────────┬─────────────────────────┘
                               │ (Secure S3 v4 HMAC)
                               ▼
┌────────────────────────────────────────────────────────┐
│             Cloudflare R2 Object Storage               │
│                                                        │
│  - Bucket: sinahard-exams                              │
│  - Zero Egress Fees for Circuit & Diagram Images       │
│  - Global Cloudflare Edge CDN Delivery                 │
└────────────────────────────────────────────────────────┘
```

#### Detailed Execution Steps:

1. **KaTeX & Service Worker Fix**:
   - In `index.html`: Remove line 38 `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">`.
   - In `src/index.css`: Add `@import "katex/dist/katex.min.css";` to bundle KaTeX CSS directly into the Vite build.
   - In `vite.config.ts`: Remove the jsDelivr runtime caching block from Workbox, as KaTeX is now locally precached.

2. **Cloudflare R2 Backend Implementation (`server.ts`)**:
   - Add backend routes:
     - `POST /api/storage/upload`: Accepts diagram image uploads (multipart/form-data or Base64 payload), uploads to Cloudflare R2 using standard S3 v4 signature protocol, and returns the public CDN URL.
     - `GET /api/storage/status`: Verifies Cloudflare R2 connection credentials and returns bucket health.
     - `POST /api/storage/config`: Allows the admin to update Cloudflare credentials securely.

3. **Frontend Cloudflare Service & Modal**:
   - Create `src/services/cloudflareService.ts` to replace `src/services/supabaseService.ts`.
   - Create `src/components/CloudflareConfigModal.tsx` to replace `src/components/SupabaseConfigModal.tsx`.
   - Cleanly remove `@supabase/supabase-js` references from `AdminOfficialExamStudioModal.tsx`, `AppDrawer.tsx`, `HomeView.tsx`, `DownloadCenterModal.tsx`, and `App.tsx`.
   - Update `package.json` to uninstall `@supabase/supabase-js`.

4. **PWA Install Prompt Verification**:
   - Verify that `beforeinstallpromptevent.preventDefault()` in `usePWAInstall.ts` continues to drive the in-app "Install App" button without throwing errors.

5. **Compilation, Lint & Verification**:
   - Run `compile_applet` and `lint_applet` concurrently to verify clean TypeScript compilation.
   - Restart the dev server on port 3000.
