import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Copy,
  Check,
  Play,
  Share2,
  Edit3,
  Bot,
  Download,
  PlusCircle,
  FileCode,
  Calculator,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Video,
  Clapperboard,
  Sparkles,
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

interface ManualViewProps {
  onNavigate: (tab: 'home' | 'files' | 'results' | 'create') => void;
  onOpenProfessorModal: () => void;
  onOpenPasteModal: () => void;
  onOpenRegistrationModal?: () => void;
  onOpenCuratedModal?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenNotificationsModal?: () => void;
}

export const ManualView: React.FC<ManualViewProps> = ({
  onNavigate,
  onOpenPasteModal,
  onOpenProfessorModal,
}) => {
  // Expand/collapse for Math & Science formulas section
  const [isMathExpanded, setIsMathExpanded] = useState<boolean>(false);
  const [isVideoPromptExpanded, setIsVideoPromptExpanded] = useState<boolean>(true);

  // Live math formula sandbox state
  const [formulaInput, setFormulaInput] = useState<string>('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedVideoPrompt, setCopiedVideoPrompt] = useState<boolean>(false);
  const [copiedShortVideoPrompt, setCopiedShortVideoPrompt] = useState<boolean>(false);

  const googleVidsSinglePrompt = `Create a 30-second inspiring animated commercial video for Sinahard (the AI Exam Preparation App for Ethiopian students). 
Style: Cinematic 3D animation (Pixar/DreamWorks studio quality), warm and inviting study room lighting. 
Setting: A wooden study desk where an ambitious Ethiopian high school boy (Bekele) wearing a green hoodie sits surrounded by heavy matriculation textbooks next to a friendly, wise silverback gorilla wearing round scholar spectacles and a cozy knitted vest.
Dialogue (Amharic audio with English subtitles): 
The stressed boy drops his pen and turns to the gorilla asking urgently: "እባክህ AI ጥያቄዎችን የሚፈጥር አፕ ንገረኝ!" (Please tell me an AI app that creates exam questions!).
The wise gorilla smiles warmly, shows him the Sinahard app on a smartphone, and explains enthusiastically in Amharic: "አትጨነቅ! መፍትሄው ሲናሃርድ (Sinahard) ነው! በAI ብሔራዊ እና የትምህርት ቤት ፈተናዎችን በሰከንዶች ውስጥ የሚያዘጋጅልህ፣ ለእያንዳንዱ ጥያቄም የሂሳብና የፊዚክስ ቀመሮችን ደረጃ-በደረጃ የሚያብራራልህ ምርጥ አፕ ነው!" (Don't stress! The solution is Sinahard! It generates national & school exams in seconds, complete with step-by-step math formulas!).
The screen shows Sinahard running with a test timer, LaTeX physics equations (F = ma), and 100% score celebration. 
Ending: Bekele scores 100% and high-fives the gorilla with joy. 
Final title card: "ሲናሃርድ (Sinahard) — Ace Your Exams with AI! Start Practicing Today!"`;

  const googleVidsStoryboardPrompt = `================================================================
GOOGLE VIDS PROMPT: SINAHARD EXAM PREP APP VIDEO COMMERCIAL
Concept: Ethiopian Student & Wise Professor Gorilla
Target Audience: Ethiopian High School & Matric Students (Grades 8, 10, 12, University)
Video Aspect Ratio: 16:9 Landscape / 9:16 Shorts
Visual Style: Warm, 3D Cinematic Animation (Pixar/Disney style), rich colors, realistic character expressions.
================================================================

CHARACTERS:
1. Bekele (ዳዊት): 17-year-old ambitious Ethiopian high school student wearing a casual green hoodie, sitting at his wooden desk surrounded by textbooks, looking overwhelmed by upcoming exams.
2. Professor Gorilla: A charismatic, gentle, highly intelligent gorilla wearing vintage round reading spectacles and a knitted academic vest, sitting beside Bekele as his wise study mentor.

SETTING:
A cozy bedroom study desk in Addis Ababa, Ethiopia. Piles of physics and mathematics exercise books, a pencil holder, a traditional Ethiopian Jebena coffee pot in the background, and an ambient warm desk lamp.

----------------------------------------------------------------
SCENE 1: THE OVERWHELMED STUDENT (0:00 - 0:07)
Camera: Medium close-up on Bekele. He groans, drops his pencil onto a stack of past exam papers, rubbing his forehead in frustration.
Bekele turns to Professor Gorilla sitting next to him and pleads in Amharic:
Bekele (Dialogue): "እባክህ AI ጥያቄዎችን የሚፈጥር አፕ ንገረኝ! የፈተና ጊዜ ደረሰ፤ እንዴት ተዘጋጅቼ ከፍተኛ ውጤት ላምጣ?"
(English Subtitle: "Please tell me an AI app that creates exam questions! Exam season is here—how can I practice and score top marks?")

----------------------------------------------------------------
SCENE 2: THE REVELATION & SINAHARD INTRO (0:07 - 0:16)
Camera: Close-up on Professor Gorilla. He smiles knowingly, pushes his round spectacles up his nose with one finger, and pats Bekele's shoulder reassuringly.
The gorilla pulls out a modern smartphone glowing with the sleek Sinahard logo.
Professor Gorilla (Dialogue in warm, motivating Amharic):
"አትጨነቅ ወዳጄ! መፍትሄው ሲናሃርድ (Sinahard) ነው! በAI አማካኝነት ብሔራዊ እና የትምህርት ቤት ፈተናዎችን በሰከንዶች ውስጥ የሚያዘጋጅልህ፣ ለእያንዳንዱ ጥያቄም ደረጃ-በደረጃ ግልጽ ማብራሪያና የሂሳብ ቀመሮችን የሚሰጥ ምርጥ አፕ ነው!"
(English Subtitle: "Don't stress, my friend! The answer is Sinahard! It uses AI to generate national and school exams in seconds, complete with step-by-step solutions and math formulas!")

----------------------------------------------------------------
SCENE 3: SINAHARD IN ACTION (0:16 - 0:24)
Camera: Smooth 3D screen overlay showing the Sinahard application in action:
- Clean KaTeX math & physics formulas rendered with precision: [ a = (v - u)/t ], [ F = ma = 3600 N ].
- Real exam timer countdown ticking with active focus mode.
- Instant score breakdown with green success badges.
- One-tap exam sharing to practice offline with classmates.
Gorilla (Voiceover):
"የፊዚክስ፣ የሂሳብ፣ የባዮሎጂ እና የሁሉንም የትምህርት ዓይነቶች ፈተናዎች በስልክህም ሆነ በኮምፒውተርህ በቀላሉ ተለማመድ!"
(English Subtitle: "Practice physics, math, biology, and all subjects seamlessly on your phone or computer!")

----------------------------------------------------------------
SCENE 4: VICTORY & CALL TO ACTION (0:24 - 0:30)
Camera: Bekele submits his practice exam. The screen bursts with golden stars: "100% EXCELLENT!".
Bekele jumps out of his chair cheering and gives Professor Gorilla an enthusiastic high-five.
Professor Gorilla gives a confident thumbs-up to the camera with a friendly wink.
On-Screen Animated Title Card:
"ሲናሃርድ (Sinahard) — በAI ፈተናዎችን በቀላሉ ይለማመዱ፣ ውጤትዎን ያሳድጉ!"
"Ace Your National Exams with AI! Start Practicing on Sinahard Today!"
Audio: Upbeat, motivating Ethiopian afrobeat / modern lo-fi study beat fading out.
================================================================`;

  const samplePrompt = `================================================================
FORMAT SPECIFICATION:
Grade: 10
Subject: Physics
Topic: Classical Mechanics & Kinematics
Time Limit: 20 minutes
================================================================

1. An object accelerates uniformly from rest to final velocity $v = 20\\text{ m/s}$ in time $t = 4\\text{ s}$. What is its acceleration?
   A) $5\\text{ m/s}^2$
   B) $80\\text{ m/s}^2$
   C) $2.5\\text{ m/s}^2$
   D) $10\\text{ m/s}^2$
   Answer: A
   Explanation: **Formula:**
[ a = \\frac{v - u}{t} ]

**Calculation:**
[ a = \\frac{20 - 0}{4} = 5\\text{ m/s}^2 ]
**Answer:** $5\\text{ m/s}^2$ (Option A)

OUTPUT RULES (PHONE-OPTIMIZED EXACT LATEX):
1. Output pure plain text (.txt format). No markdown code blocks, no greetings or conversational intro.
2. Put Answer: [Letter] on its own line.
3. DO NOT use numbers in the explanation area (avoid 1. Formula 2. Calculation; instead use **Formula:**, **Calculation:**, **Answer:**).
4. EXACT LATEX IN ALL 4 OPTIONS: Wrap EVERY numerical and mathematical option in $...$ (e.g. A) $2400\\text{ N}$, B) $3600\\text{ N}$). Never output raw ASCII like '3/4' or 'sqrt(5)'.
5. FORMULA ISOLATION & PHONE CLIPBOARD COMPLIANCE:
   - Wrap display equations on their own dedicated line using bracket format [ equation ] (e.g. [ a = \\frac{v - u}{t} ] and [ F = ma ]).
   - Place blank lines before and after every equation line to ensure clean phone formatting.
   - Wrap inline variables and units in $...$ with \\text{...} for units (e.g. $m = 1200\\text{ kg}$, $v = 24\\text{ m/s}$).
   - Strictly retain all LaTeX backslashes (\\frac, \\sqrt, \\cdot, \\times, \\pm, \\Delta, \\theta, \\pi, ^2). Never substitute broken plain ASCII.`;

  const formulaShortcuts = [
    { label: 'Acceleration [ a = \\frac{v - u}{t} ]', code: 'a = \\frac{v - u}{t}' },
    { label: 'Displacement [ s = ut + \\frac{1}{2}at^2 ]', code: 's = ut + \\frac{1}{2}at^2' },
    { label: 'Fraction', code: '\\frac{a}{b}' },
    { label: 'Square Root', code: '\\sqrt{x}' },
    { label: 'Power / Exponent', code: 'x^2 + y^2 = r^2' },
    { label: 'Plus or Minus', code: '\\pm' },
    { label: 'Multiplication', code: '\\times' },
    { label: 'Greek Symbols', code: '\\alpha, \\beta, \\theta, \\pi, \\Delta' },
    { label: 'Integration', code: '\\int_{a}^{b} f(x) dx' },
    { label: 'Limit', code: '\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1' },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSymbol(text);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto font-['Plus_Jakarta_Sans',sans-serif] text-slate-900 dark:text-zinc-100">
      {/* ─────────────────────────────────────────────────────────────
          LAYER 2: FLUID GLASS CONTAINER (Guide Header Banner)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative p-6 sm:p-7 rounded-[28px] sm:rounded-[32px] liquid-glass overflow-hidden">
        <div className="space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-subtle text-slate-700 dark:text-zinc-300 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Quick &amp; Clear Guide</span>
          </div>

          <p className="text-base sm:text-lg lg:text-xl font-normal font-['Outfit',sans-serif] text-slate-800 dark:text-zinc-200 leading-relaxed">
            <span className="font-semibold text-slate-950 dark:text-white">Sinahard</span> is comprehensive — you can create any question and practice prepared exams in an interactive app, for all grade level students.
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          LAYER 2: FLUID GLASS CONTAINER (3 Ways to Add Questions)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative p-5 sm:p-7 rounded-[28px] sm:rounded-[32px] liquid-glass space-y-4 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wider">
            <Edit3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Adding Questions</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white mt-1">
            Exam Question Creation &amp; AI Pipelines
          </h2>
        </div>

        {/* Featured: Create with Agent */}
        <div className="relative z-10 p-5 rounded-2xl liquid-glass-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-600 dark:text-zinc-400">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                Create with Agent
              </span>
              <span>·</span>
              <span>Multi-Agent Loop · KaTeX STEM · Offline Ready</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white font-['Outfit',sans-serif]">
              Autonomous 3-Agent AI Pipeline (Curator &rarr; Author &rarr; Adversarial Critic)
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Agent A reads curriculum syllabus · Agent B drafts KaTeX-formatted STEM problems · Agent C audits zero hallucinations before saving to your online &amp; offline exam library.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenProfessorModal}
            className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition shrink-0 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Create with Agent</span>
          </button>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Way 1: Manually */}
          <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-white">
                Manually Question by Question
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Add each question manually while reading your textbooks or right after study sessions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="w-full py-2 px-3 rounded-full liquid-glass-btn text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Create Manually</span>
            </button>
          </div>

          {/* Way 2: Copy & Paste from AI */}
          <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-white">
                Copy &amp; Paste from Any AI
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Copy questions created by any AI like <strong>Claude</strong>, <strong>Gemini</strong>, <strong>ChatGPT</strong>, or <strong>DeepSeek</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPasteModal}
              className="w-full py-2 px-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Paste AI Questions</span>
            </button>
          </div>

          {/* Way 3: Import from Files */}
          <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="font-bold text-sm text-slate-950 dark:text-white">
                Import from Telegram or Files
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Import questions downloaded from Telegram channels or shared by friends (<code className="font-mono text-slate-700 dark:text-zinc-300">.txt</code> file).
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPasteModal}
              className="w-full py-2 px-3 rounded-full liquid-glass-btn text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Import .txt File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Exams with Friends */}
      <div className="relative p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] liquid-glass flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-start gap-3.5 relative z-10">
          <div className="w-10 h-10 rounded-2xl liquid-glass-subtle flex items-center justify-center font-bold shrink-0 mt-0.5">
            <Share2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
              Share Created Questions with Friends
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xl">
              You can share your created questions to your friends to take one exam at a time by clicking the <strong>Export</strong> button on your exam card in the Library!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('files')}
          className="relative z-10 self-start sm:self-auto px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition shrink-0 whitespace-nowrap"
        >
          <span>View Library</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ready-to-Use AI Prompt */}
      <div className="relative p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] liquid-glass space-y-3 overflow-hidden">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wider">
              <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Ready-To-Use AI Prompt</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white mt-1">
              Ask Claude, Gemini, ChatGPT, or DeepSeek
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Copy prompts to AI to create your questions, then paste them back here.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(samplePrompt);
              setCopiedPrompt(true);
              setTimeout(() => setCopiedPrompt(false), 2000);
            }}
            className="px-3.5 py-1.5 rounded-full liquid-glass-btn text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Prompt Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 p-4 rounded-2xl liquid-glass-subtle font-mono text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {samplePrompt}
        </div>
      </div>

      {/* Video Ad Prompts for Google Vids & AI Generators (Student & Gorilla) */}
      <div className="relative p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] liquid-glass space-y-4 overflow-hidden">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wider">
              <Clapperboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Video Ad Generator Prompts · Google Vids Ready</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white mt-1">
              Ethiopian Student &amp; Professor Gorilla Commercial
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Paste these prompts directly into Google Vids, Veo, or AI video creators to generate an Amharic promo video.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(googleVidsSinglePrompt);
                setCopiedShortVideoPrompt(true);
                setTimeout(() => setCopiedShortVideoPrompt(false), 2000);
              }}
              className="px-3.5 py-1.5 rounded-full liquid-glass-btn text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Copy short prompt for Google Vids prompt bar"
            >
              {copiedShortVideoPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Short Prompt Copied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Copy Short (Google Vids)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(googleVidsStoryboardPrompt);
                setCopiedVideoPrompt(true);
                setTimeout(() => setCopiedVideoPrompt(false), 2000);
              }}
              className="px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
              title="Copy complete scene-by-scene storyboard"
            >
              {copiedVideoPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Full Script Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Full Storyboard</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Amharic Dialogue Highlights */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl liquid-glass-subtle text-xs space-y-1.5">
            <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span>ተማሪው ዳዊት (The Student):</span>
            </div>
            <p className="font-medium text-slate-800 dark:text-zinc-200 leading-relaxed font-sans">
              "እባክህ AI ጥያቄዎችን የሚፈጥር አፕ ንገረኝ! የፈተና ጊዜ ደረሰ፤ እንዴት ተዘጋጅቼ ከፍተኛ ውጤት ላምጣ?"
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
              "Please tell me an AI app that creates exam questions! Exam season is here—how can I score top marks?"
            </p>
          </div>

          <div className="p-3.5 rounded-2xl liquid-glass-subtle text-xs space-y-1.5">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span>ፕሮፌሰር ጎሪላ (The Wise Gorilla):</span>
            </div>
            <p className="font-medium text-slate-800 dark:text-zinc-200 leading-relaxed font-sans">
              "አትጨነቅ! መፍትሄው ሲናሃርድ (Sinahard) ነው! በAI አማካኝነት ብሔራዊ እና የትምህርት ቤት ፈተናዎችን በሰከንዶች ውስጥ የሚያዘጋጅልህ፣ ደረጃ-በደረጃ ማብራሪያና የሂሳብ ቀመሮችን የሚሰጥህ ምርጥ አፕ ነው!"
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
              "Don't stress! The answer is Sinahard! It generates national &amp; school exams with step-by-step math formulas in seconds!"
            </p>
          </div>
        </div>

        {/* Toggle full prompt view */}
        <div className="relative z-10 pt-1">
          <button
            type="button"
            onClick={() => setIsVideoPromptExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          >
            <span>{isVideoPromptExpanded ? 'Hide' : 'View'} Full Google Vids Storyboard Script</span>
            {isVideoPromptExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isVideoPromptExpanded && (
          <div className="relative z-10 p-4 rounded-2xl liquid-glass-subtle font-mono text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {googleVidsStoryboardPrompt}
          </div>
        )}
      </div>

      {/* Expandable Math & Science Formulas Area */}
      <div className="relative rounded-[28px] sm:rounded-[32px] liquid-glass overflow-hidden">
        <button
          type="button"
          onClick={() => setIsMathExpanded((prev) => !prev)}
          className="w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left hover:bg-white/40 dark:hover:bg-white/[0.02] transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl liquid-glass-subtle flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                  Math &amp; Science Formulas Manual
                </h2>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  · Optional
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Hint: This type of formula code helps just for creating manual questions.</span>
              </p>
            </div>
          </div>

          <div className="p-2 rounded-full liquid-glass-subtle text-slate-500 dark:text-zinc-300 shrink-0">
            {isMathExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {isMathExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-5 pb-6 sm:px-6 border-t border-slate-200/70 dark:border-white/10 space-y-4 pt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                    Type formula code:
                  </label>
                  <input
                    type="text"
                    value={formulaInput}
                    onChange={(e) => setFormulaInput(e.target.value)}
                    placeholder="e.g. \frac{a}{b} or x^2"
                    className="w-full px-3.5 py-2.5 rounded-full bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                    Instant math appearance:
                  </label>
                  <div className="min-h-[42px] px-4 py-2.5 rounded-full bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 flex items-center text-sm text-slate-900 dark:text-white overflow-x-auto shadow-2xs">
                    <MathRenderer content={`\\[ ${formulaInput} \\]`} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Click any symbol to copy or test it:
                </span>
                <div className="flex flex-wrap gap-2">
                  {formulaShortcuts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setFormulaInput(item.code);
                        handleCopy(item.code);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs liquid-glass-subtle text-slate-700 dark:text-zinc-300 font-mono flex items-center gap-1.5 cursor-pointer transition active:scale-98"
                    >
                      {copiedSymbol === item.code ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Practice Action Banner */}
      <div className="relative p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] liquid-glass flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
            Ready to start practicing?
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Choose an exam from your library or create new questions right now.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('create')}
            className="px-4 py-2 rounded-full liquid-glass-btn text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Create Exam
          </button>
          <button
            type="button"
            onClick={() => onNavigate('files')}
            className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Browse Library</span>
          </button>
        </div>
      </div>
    </div>
  );
};

