# Dynamic [IMAGE: label] Detection, Pre-Publish Preview & Student-Friendly Homepage

Refining the Official Exam Studio's media detection to specifically identify `[IMAGE: label...]` markers with targeted upload prompts, introducing a dedicated Pre-Publish Preview tab for full KaTeX LaTeX and diagram auditing before submission, and sanitizing the homepage to replace developer jargon (Supabase, database configurations) with student-centric educational terminology for non-admin users.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on user choices:

- **Confirmed Media UI Behavior**: For questions without an `[IMAGE: ...]` tag, the bulky prompt box ("Does this question contain a circuit diagram...") is hidden by default. Only a subtle `+ Attach Diagram` button is displayed. When `[IMAGE: label...]` is detected, the UI displays a dedicated dropzone labeled with the exact figure title (e.g., `"Upload Diagram: Circuit bridge resistor network"`).
- **Confirmed Pre-Publish Preview**: A dedicated **"Pre-Publish Preview"** tab is introduced in the Official Exam Studio, rendering all questions, KaTeX formulas, tables, choice images, and diagrams in full fidelity with a pre-flight checklist before writing to Supabase.
- **Confirmed Homepage Vocabulary**: Technical jargon ("Supabase", "Cloud SQL", "Postgres") is strictly hidden from non-admin students on the homepage and replaced with **"Official University Archive and Verified Past Papers"**.

---

## 1. Overview & Core Concept

### 1. Dynamic `[IMAGE: label]` Detection in Questions & Choices
- In `AdminOfficialExamStudioModal.tsx`, the editor analyzes the question prompt for `[IMAGE: label...]` or `[DIAGRAM: label...]`:
  - **When Tag Detected**: Renders an accented target dropzone:
    - `"Detected Diagram Marker: [label]"`
    - Button: `"Upload Diagram: [label]"`
    - When clicked, opens the file picker and uploads to the Supabase `exam-media` bucket.
  - **When NO Tag Detected**: Hides the upload box entirely to keep the screen clean and uncrowded. Shows an unobtrusive `+ Attach Diagram` link if the admin wishes to manually add one.
  - **Choice Images**: Similar targeted detection for `[IMAGE_OPT_A: label]` on choices A, B, C, D.

### 2. Dedicated Pre-Publish Preview Tab
- Adds a new tab in the Studio: **"Pre-Publish Preview"**:
  - Displays the complete exam as students will see it in practice mode:
    - KaTeX mathematical and physical formulas (`\( ... \)`, `\[ ... \]`) rendered via `MathRenderer`.
    - Hosted diagrams with zoomable lightbox and captions.
    - Choice diagram options (A, B, C, D) with correct answer highlight.
    - Markdown experimental tables rendered via `MarkdownTableRenderer`.
    - Step-by-step solution explanations.
  - **Pre-Flight Validation Badge Strip**:
    - `✓ Questions Count Valid`
    - `✓ KaTeX Formulas Formatted`
    - `✓ N Diagrams Attached`
    - `✓ All Options Populated`
  - Primary Action: **"Confirm & Publish Official Exam to Supabase"**.

### 3. Homepage Jargon Sanitization for Non-Admins
- In `HomeView.tsx` & `DownloadCenterModal.tsx`:
  - Replace `"Offline Multi-Year Exam Download Center & Supabase Storage"` with `"Official University Archive & Verified Past Papers"`.
  - Condition developer buttons (like the `"Supabase"` config button) strictly on `isAdmin === true` (`melkamukebede11@gmail.com`).
  - Standard students and guests see only educational, trust-building copy without developer terminology.

---

## 2. User Experience & Visual Design

### Official Studio Tab Bar
```
[ 📋 Paste AI Text ]   [ 📝 Questions Editor ]   [ 👁️ Pre-Publish Preview ]   [ 💡 Hard-Copy AI ]
```

### Dynamic Image Detection Card
```
┌────────────────────────────────────────────────────────────────────────┐
│  📷 Detected Diagram Marker: "DC Bridge Resistor Circuit Network"      │
│  The AI flagged a schematic for this question.                         │
│                                                                        │
│  [ Upload Diagram: "DC Bridge Resistor Circuit Network" ]              │
└────────────────────────────────────────────────────────────────────────┘
```
*(If no `[IMAGE: ...]` tag exists, this box is absent, replaced by a quiet `+ Attach Diagram` text link).*

### Pre-Publish Preview Layout
- Full-width clean container with realistic student test view.
- Question prompt with equations rendered in KaTeX.
- Diagrams centered with elegant dark borders and captions.
- 2x2 grid of choices A, B, C, D with choice images.
- Verification status card at the top indicating readiness for Supabase.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Label Preservation from `[IMAGE: ...]`
- **Chosen Approach**: When the parser encounters `[IMAGE: Kinematic trajectory parabola]`, it stores `"Kinematic trajectory parabola"` in `question.imageCaption` and sets a detection flag.
- **Rationale**: The admin immediately knows which diagram to upload from their device without checking the paper exam.

### Decision 2: Homepage RBAC on Developer Links
- **Chosen Approach**: Only render the `Supabase` storage configuration trigger if `isAdmin === true`.
- **Rationale**: Students have no need to configure cloud buckets or API keys; exposing it confuses users and clutters the interface.

---

## 4. Technical Architecture & File Plan

### Planned File Modifications:
1. **`src/components/AdminOfficialExamStudioModal.tsx`**:
   - Update tabs: add `'preview'` to `StudioTab = 'paste' | 'editor' | 'preview' | 'prompt'`.
   - Implement dynamic `[IMAGE: label]` detection on `currentQ.text` and `currentQ.imageCaption`.
   - Render targeted upload button when marker is present; hide upload box and show simple `+ Attach Diagram` when absent.
   - Build complete **Pre-Publish Preview** tab with live KaTeX, tables, diagrams, choices, and final publish trigger.
2. **`src/components/HomeView.tsx`**:
   - Replace technical titles with `"Official University Archive & Verified Past Papers"`.
   - Guard `onOpenSupabaseConfig` button so only admins (`isAdmin`) see it.
3. **`src/components/DownloadCenterModal.tsx`**:
   - Guard cloud storage config link so it is visible only to admins.
4. **Verification**:
   - Run `lint_applet` (`tsc --noEmit`) and `compile_applet`.
   - Verify non-admin view contains no developer jargon.
