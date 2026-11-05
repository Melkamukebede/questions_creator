# AI-Assisted Official Exam Studio & Hard-Copy Exam Prompt Generator

An intelligent exam authoring pipeline for verified administrators that automatically parses raw numbered exam text from any AI (ChatGPT, Claude, DeepSeek, Gemini), detects diagrams and tables via a 3-toggle controller, provides inline Supabase Storage uploaders for questions and choices, and integrates a specialized Vision Prompt Generator to convert scanned paper exams into structured test sets.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on user preferences in Phase 1:

- **Confirmed Parser Format**: Raw numbered text parser prioritizing standard educational test formats (`1. Question text... A) ... B) ... Answer: C, Explanation: ...`) with KaTeX math symbols and inline diagram tokens.
- **Confirmed Media Upload Workflow**: Inline upload buttons embedded directly beside flagged questions and choices (A/B/C/D), allowing 1-click image uploads to the Supabase `exam-media` bucket without context switching.
- **Confirmed Admin Prompt Generator Location**: An integrated helper tab directly inside the Official Exam Studio, accompanied by an admin vision preset card in the Prompts Studio.

---

## 1. Overview & Core Concept

### What It Does
1. **Three-Toggle Media Detection Bar**:
   - `[Toggle 1]` **Question Diagrams**: Detects question-level visual diagrams or flags slots with inline uploader buttons.
   - `[Toggle 2]` **Choice Images (A/B/C/D)**: Detects or activates image attachments for individual choices (e.g., circuit schematics, geometric figures).
   - `[Toggle 3]` **Markdown Tables**: Automatically parses and renders markdown tables embedded within question prompts or solutions.
2. **AI Raw Text Parser**:
   - Accepts raw text output from any AI.
   - Intelligently extracts question prompts, options (A, B, C, D), correct answers, step-by-step explanations, KaTeX LaTeX math (`\( ... \)`, `\[ ... \]`), markdown tables, and placeholder image tokens (`[IMAGE: ...]`, `[IMAGE_Q_1]`, `[IMAGE_OPT_A]`).
   - Automatically cleans noise, normalizes numbering, and maps choices to 0-3 index.
3. **Inline Supabase Media Uploaders**:
   - For every question and option flagged with an image, an inline dropzone/upload button allows the admin to select an image from their device.
   - Uploads to the Supabase Storage `exam-media` bucket in real time, generates the secure public CDN URL, and auto-links it to the question `imageUrl` or `optionImages` array.
4. **Admin Hard-Copy Vision Prompt Generator**:
   - Provides an interactive prompt builder tailored for Ethiopian University Freshman and Secondary Matriculation past papers.
   - Admins copy the master prompt and attach scanned paper photos or PDFs to ChatGPT-4o, Claude 3.5 Sonnet, or Gemini. The prompt instructs the external AI to output questions in the exact format recognized by Sinahard's parser with standardized image placeholders.

---

## 2. User Experience & Visual Design

### Visual Identity & Layout Architecture
- **Palette**: Dark slate canvas (`#0c182b` / `#070e1a`) with emerald accent tokens (`emerald-500` / `emerald-400`) reflecting the verified official certification tier.
- **Top Bar Contract & Mode Toggles**:
  - Studio header features 3 unified tabs:
    1. **"Paste AI Questions"**: Clean, spacious raw text editor with real-time parsing stats.
    2. **"Review & Questions Editor"**: Live KaTeX formula rendering, inline image upload zones, option editors, and table previews.
    3. **"Hard-Copy AI Prompt Generator"**: Interactive master prompt customizer for paper exams with 1-click clipboard copy.
  - The 3 Media Toggles sit prominently at the top of the Paste view in a cohesive segmented bar:
    - `[📷 Question Diagrams]`
    - `[🖼️ Choice Diagrams (A-D)]`
    - `[📊 Tables]`
- **Uncluttered Inline Media Slots**:
  - No bloated dialogs or nested popups.
  - When an image is missing or flagged, a sleek dashed upload box appears beside the prompt or choice with drag-and-drop or file pick.
  - Once uploaded, it displays a crisp 48x48 thumbnail, image caption input, and full-screen lightbox preview button.
- **Zero-Pill Discipline**:
  - Metadata (e.g. `University · AAU · Semester 1 · 2016 E.C.`) rendered cleanly with typographic middots (`·`).
  - Strict button-like styling for interactive state selectors only.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Hybrid AI Parser Architecture
- **Chosen Approach**: A fault-tolerant regex and line-scanner parser that accepts both raw human/AI test formatting (`1. Question... A) ... B) ... Answer: C`) and JSON if pasted.
- **Rationale**: External AIs frequently produce slight formatting variations (e.g. `A.` vs `A)` vs `(A)`, `Ans:`, `Correct Answer:`, `Key:`). The parser normalizes all variations and produces clean `Question` objects.
- **Trade-off**: Requires comprehensive regex patterns for choice extraction and answer normalization, which will be encapsulated in a dedicated utility (`src/services/aiExamParserService.ts`).

### Decision 2: Inline Storage Direct-Link vs Staged Uploads
- **Chosen Approach**: Inline Supabase bucket uploads immediately when a file is selected.
- **Rationale**: Immediate upload provides instant CDN URLs, eliminates massive base64 payloads from bloating client memory, and provides instant visual confirmation with a thumbnail.
- **Fallback**: If Supabase credentials are not connected or offline, provides an inline alert directing the admin to connect credentials via the Supabase config modal.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram
```
┌────────────────────────────────────────────────────────────────────────┐
│                   AdminOfficialExamStudioModal.tsx                     │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ 1. Classification Bar │  │  3 Media Toggles:                     │  │
│  │ [University / Matric] │  │  [✓] Diagrams  [✓] Choice Img  [✓] Tbl│  │
│  └───────────────────────┘  └──────────────────────────────────────┘  │
│                                                                        │
│  Tabs: [ 📋 Paste AI Text ]  [ 📝 Review & Media ]  [ 💡 Hard-Copy AI] │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Tab 1: AI Raw Text Parser (aiExamParserService.ts)                │  │
│  │  - Parses: 1. Prompt, A/B/C/D, Answer, Explanation, Tables       │  │
│  │  - Flags: [IMAGE_Q_1], [IMAGE_OPT_A_1]                            │  │
│  │  - Auto-arranges into questions state                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Tab 2: Review & Inline Uploaders                                 │  │
│  │  - KaTeX Math Preview (MathRenderer)                             │  │
│  │  - Inline Supabase Dropzone (uploadExamMedia -> 'exam-media')    │  │
│  │  - Option A/B/C/D Image Slots                                    │  │
│  │  - Markdown Tables (MarkdownTableRenderer)                       │  │
│  │  - Action: "Publish Official Exam to Supabase"                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Tab 3: Hard-Copy Past Exam AI Vision Prompt Generator            │  │
│  │  - Custom prompts for ChatGPT-4o / Claude 3.5 Sonnet / Gemini     │  │
│  │  - Instructs AI to transcribe paper exams with image placeholders │  │
│  │  - 1-Click Copy Master Prompt with syntax guidelines              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Additions
```typescript
// Extended Question option media support:
export interface Question {
  id: string;
  text: string;
  options: string[];
  correct: number;
  explanation?: string;
  imageUrl?: string;
  imageCaption?: string;
  tableMarkdown?: string;
  optionImages?: (string | null | undefined)[]; // Maps image URLs to choice indexes A(0), B(1), C(2), D(3)
}
```

### Planned File Modifications
1. **`src/services/aiExamParserService.ts` (New)**:
   - High-precision parser with regex rules for Ethiopian university & secondary exams.
   - Handles multi-line math formulas, table markdown blocks, and image tokens.
2. **`src/components/AdminOfficialExamStudioModal.tsx`**:
   - Add the 3 top toggles (`hasQuestionImages`, `hasOptionImages`, `hasTables`).
   - Add the 3 tabs (`Paste AI Text`, `Review & Edit Questions`, `Hard-Copy Vision Prompt`).
   - Add inline dropzones and image upload triggers for question prompt and choices.
3. **`src/components/ProfessorModal.tsx`**:
   - For `isAdmin === true`, add a dedicated "Admin Vision Paper Exam" prompt preset with a direct launch action to the Official Studio.
4. **Verification**:
   - Run `lint_applet` and `compile_applet`.
   - Test parsing sample text with diagrams and tables.
