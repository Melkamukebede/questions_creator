import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  ArrowRight,
  FileText,
  HelpCircle,
  Code,
  Zap,
  Loader2,
  Plus,
  Minus,
  Smartphone,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  BookOpen,
  Key,
  ExternalLink,
  Trash2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Brain,
  Cpu,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { isMobileUserDevice } from '../services/latexClipboardService';
import { MathRenderer } from './MathRenderer';
import { Question, Exam } from '../types';
import {
  getUserGeminiApiKey,
  saveUserGeminiApiKey,
  clearUserGeminiApiKey,
  hasUserGeminiApiKey,
} from '../services/geminiClientService';
import {
  runLangGraphPipeline,
  PipelineCandidateQuestion,
  CriticReview,
  AgentLogEntry,
} from '../services/langGraphPipeline';
import { downloadExamSqliteFile } from '../services/sqliteService';
import { saveExamToFirestore, isUserAdmin } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { generateHardCopyExamVisionPrompt } from '../services/aiExamParserService';
import {
  isStudentClassLocked,
  normalizeClassLevel,
  formatClassLevelLabel,
} from '../utils/classLevelFilter';

interface ProfessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToQuestionTextEditor?: () => void;
  onGoToPaste?: () => void;
  onAddGeneratedQuestions?: (questions: Question[], examTitle?: string) => void;
  onStartDirectPractice?: (exam: Exam) => void;
  onOpenAdminOfficialStudio?: () => void;
}

type SubjectType = 'calculation' | 'theory';
type ActiveView = 'prompt' | 'agent' | 'txt_preview' | 'admin_vision';
type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type PromptStyle = 'brief' | 'detailed';
type ExamFocusStyle = 'National Exam (EUEE)' | 'University Final' | 'Conceptual Mastery' | 'Olympiad / Challenger';

const GRADE_LIST = ['7', '8', '9', '10', '11', '12', 'Freshman', 'Senior University'];

export const ProfessorModal: React.FC<ProfessorModalProps> = ({
  isOpen,
  onClose,
  onGoToQuestionTextEditor,
  onGoToPaste,
  onAddGeneratedQuestions,
  onStartDirectPractice,
  onOpenAdminOfficialStudio,
}) => {
  const { user } = useAuth();
  const isAdmin = Boolean(user && !user.isAnonymous && user.uid !== 'guest' && isUserAdmin(user));
  const classLocked = isStudentClassLocked(user, isAdmin);

  // Mobile device detection and Phone LaTeX optimization toggle
  const isMobileDevice = isMobileUserDevice();
  const [optimizeForPhone, setOptimizeForPhone] = useState<boolean>(() => isMobileDevice || true);

  // Core Configuration - Brief & Focused
  const [subjectType, setSubjectType] = useState<SubjectType>('calculation');
  const [grade, setGrade] = useState<string>(() =>
    user?.grade ? normalizeClassLevel(user.grade) : '12'
  );
  const [subject, setSubject] = useState<string>('Physics');
  const [topics, setTopics] = useState<string>('Classical Mechanics & Kinematics');
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number>(20);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [promptStyle, setPromptStyle] = useState<PromptStyle>('brief');
  const [examFocusStyle, setExamFocusStyle] = useState<ExamFocusStyle>(() => {
    const norm = user?.grade ? normalizeClassLevel(user.grade) : '12';
    return norm === 'Freshman' || norm === 'Senior University'
      ? 'University Final'
      : 'National Exam (EUEE)';
  });
  const [includeLatexTables, setIncludeLatexTables] = useState<boolean>(false);
  const [showLatexLivePreview, setShowLatexLivePreview] = useState<boolean>(true);

  // Sync grade with registered student's class when modal opens
  React.useEffect(() => {
    if (isOpen && classLocked && user?.grade) {
      const lockedLevel = normalizeClassLevel(user.grade);
      setGrade(lockedLevel);
      if (lockedLevel === 'Freshman' || lockedLevel === 'Senior University') {
        setExamFocusStyle('University Final');
      }
    }
  }, [isOpen, classLocked, user?.grade]);

  // Admin Hard-Copy Vision Prompt States
  const [visionUniversity, setVisionUniversity] = useState('Addis Ababa University (AAU)');
  const [visionSubject, setVisionSubject] = useState('Phys 1011 (General Physics)');
  const [visionTier, setVisionTier] = useState<'university' | 'secondary'>('university');
  const [visionExamType, setVisionExamType] = useState('Final');
  const [visionExamYear, setVisionExamYear] = useState('2016 E.C.');
  const [visionIncludeDiagrams, setVisionIncludeDiagrams] = useState(true);
  const [visionIncludeChoiceImages, setVisionIncludeChoiceImages] = useState(false);
  const [visionIncludeTables, setVisionIncludeTables] = useState(true);
  const [visionCopied, setVisionCopied] = useState(false);

  // UI View Tab & Interactive States
  const [activeView, setActiveView] = useState<ActiveView>('prompt');
  const [copied, setCopied] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const [aiError, setAiError] = useState<string | null>(null);

  // Client-side Gemini API key configuration (for Cloudflare Pages / Static Hosting)
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getUserGeminiApiKey());
  const [apiKeySuccessMsg, setApiKeySuccessMsg] = useState<string | null>(null);

  // LangGraph Multi-Agent Pipeline State (ExamMaster Pro)
  const [langgraphSyllabus, setLanggraphSyllabus] = useState<string>(
    'Ethiopian National Curriculum: Rotational Dynamics, Electromagnetism, Wave Optics & KaTeX Calculus Formulas'
  );
  const [langgraphStream, setLanggraphStream] = useState<'Natural Science' | 'Social Science'>('Natural Science');
  const [langgraphBatchCount, setLanggraphBatchCount] = useState<number>(3);
  const [isLanggraphRunning, setIsLanggraphRunning] = useState<boolean>(false);
  const [langgraphCurrentStep, setLanggraphCurrentStep] = useState<'Curator' | 'Author' | 'Critic' | 'Finalizing' | null>(null);
  const [langgraphStepMessage, setLanggraphStepMessage] = useState<string>('');
  const [langgraphLogs, setLanggraphLogs] = useState<AgentLogEntry[]>([]);
  const [langgraphObjectives, setLanggraphObjectives] = useState<string[]>([]);
  const [langgraphQuestions, setLanggraphQuestions] = useState<PipelineCandidateQuestion[]>([]);
  const [langgraphCriticReview, setLanggraphCriticReview] = useState<CriticReview | null>(null);
  const [langgraphIterations, setLanggraphIterations] = useState<number>(1);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState<boolean>(false);
  const [firestoreSuccessNotice, setFirestoreSuccessNotice] = useState<string | null>(null);
  const [isExportingSqlite, setIsExportingSqlite] = useState<boolean>(false);
  const [sqliteSuccessNotice, setSqliteSuccessNotice] = useState<string | null>(null);

  const triggerRegeneration = () => {
    setIsRegenerating(true);
    setTimeout(() => setIsRegenerating(false), 120);
  };

  // Grade Stepper Helpers
  const currentGradeIndex = useMemo(() => {
    const idx = GRADE_LIST.indexOf(String(grade));
    return idx >= 0 ? idx : 5; // Default to Grade 12
  }, [grade]);

  const handlePrevGrade = () => {
    if (classLocked) return;
    if (currentGradeIndex > 0) {
      triggerRegeneration();
      setGrade(GRADE_LIST[currentGradeIndex - 1]);
    }
  };

  const handleNextGrade = () => {
    if (classLocked) return;
    if (currentGradeIndex < GRADE_LIST.length - 1) {
      triggerRegeneration();
      setGrade(GRADE_LIST[currentGradeIndex + 1]);
    }
  };

  // Question Count Stepper (1 to 25)
  const handleDecrementQuestions = () => {
    triggerRegeneration();
    setTotalQuestions((prev) => Math.max(1, prev - 1));
  };

  const handleIncrementQuestions = () => {
    triggerRegeneration();
    setTotalQuestions((prev) => Math.min(25, prev + 1));
  };

  // Time Limit Stepper (5-minute increments)
  const handleDecrementTime = () => {
    triggerRegeneration();
    setTimeLimit((prev) => Math.max(5, prev - 5));
  };

  const handleIncrementTime = () => {
    triggerRegeneration();
    setTimeLimit((prev) => Math.min(180, prev + 5));
  };

  // Quick curriculum presets (respects student's locked class if registered student)
  const applyPreset = (preset: 'physics' | 'math12' | 'chemistry' | 'biology' | 'social' | 'freshman_math') => {
    triggerRegeneration();
    const targetGrade = classLocked && user?.grade ? normalizeClassLevel(user.grade) : null;
    if (preset === 'physics') {
      setSubjectType('calculation');
      if (!targetGrade) setGrade('12');
      setSubject('Physics');
      setTopics('Classical Mechanics, Newton Laws & Work-Energy');
      setTotalQuestions(10);
      setTimeLimit(20);
      setDifficulty('Medium');
    } else if (preset === 'math12') {
      setSubjectType('calculation');
      if (!targetGrade) setGrade('12');
      setSubject('Mathematics');
      setTopics('Calculus, Limits, Derivatives & Integrals');
      setTotalQuestions(10);
      setTimeLimit(25);
      setDifficulty('Hard');
    } else if (preset === 'chemistry') {
      setSubjectType('calculation');
      if (!targetGrade) setGrade('12');
      setSubject('Chemistry');
      setTopics('Chemical Equilibrium, Kinetics & Stoichiometry');
      setTotalQuestions(10);
      setTimeLimit(20);
      setDifficulty('Medium');
    } else if (preset === 'biology') {
      setSubjectType('theory');
      if (!targetGrade) setGrade('12');
      setSubject('Biology');
      setTopics('Cell Biology, Genetics & Human Physiology');
      setTotalQuestions(10);
      setTimeLimit(15);
      setDifficulty('Medium');
    } else if (preset === 'social') {
      setSubjectType('theory');
      if (!targetGrade) setGrade('12');
      setSubject('Economics & History');
      setTopics('Macroeconomic Policy, Modern Ethiopian History & Geography');
      setTotalQuestions(10);
      setTimeLimit(15);
      setDifficulty('Medium');
    } else if (preset === 'freshman_math') {
      setSubjectType('calculation');
      if (!targetGrade) setGrade('Freshman');
      setSubject('Applied Mathematics I');
      setTopics('Propositional Logic, Set Theory, Matrices & Conic Sections');
      setTotalQuestions(10);
      setTimeLimit(25);
      setDifficulty('Medium');
      setExamFocusStyle('University Final');
    }
  };

  // Calibrated Difficulty Guides
  const difficultyConfig = useMemo(() => {
    if (difficulty === 'Easy') {
      return {
        label: 'Easy (Foundational Mastery)',
        summary: 'Direct single-step formulas and core conceptual recall.',
        briefGuide: 'Direct 1-step substitution (e.g. F = ma directly) with clear, distinct distractors.',
        distractorRule: 'Distractors must represent simple arithmetic slips or misplaced signs.',
      };
    } else if (difficulty === 'Hard') {
      return {
        label: 'Hard (Challenger & Olympiad)',
        summary: 'Multi-stage synthesis, variable isolation, and non-trivial calculations.',
        briefGuide: 'Multi-stage problems requiring derivation and synthesis across multiple concepts before final evaluation.',
        distractorRule: 'Distractors must be mathematically plausible intermediate results from alternative missteps.',
      };
    } else {
      return {
        label: 'Medium (Standard Exam)',
        summary: 'National exam benchmark with 2-step algebraic reasoning.',
        briefGuide: 'Standard preparatory exam standard: 2-step reasoning (e.g. solve for intermediate acceleration first), algebraic rearrangement, and plausible distractors.',
        distractorRule: 'Distractors must reflect common student math slips like forgetting to square velocity or inverted fractions.',
      };
    }
  }, [difficulty]);

  // Generate standardized Plain Text (.TXT format) prompt for AI with Gold-Standard LaTeX/KaTeX
  const generatedPrompt = useMemo(() => {
    const isMath = subjectType === 'calculation';
    const isMobile = isMobileDevice || optimizeForPhone;
    const mainTopic = topics.split(',')[0]?.trim() || 'Classical Mechanics';
    const cleanGrade = String(grade || '12');
    const formattedLevel = formatClassLevelLabel(cleanGrade);

    const focusDirective =
      examFocusStyle === 'National Exam (EUEE)'
        ? 'Align strictly with Ethiopian University Entrance Examination (EUEE / ESLCE) competency standards.'
        : examFocusStyle === 'University Final'
        ? 'Align with Ethiopian Public University (AAU, ASTU, Hawassa, Jimma) Freshman/Senior Departmental Final Exam rigor.'
        : examFocusStyle === 'Olympiad / Challenger'
        ? 'Design multi-concept analytical synthesis problems that test deep mathematical derivation and edge-case reasoning.'
        : 'Prioritize deep conceptual intuition, physical meaning of equations, and common misconception traps.';

    const latexMatrixRule = includeLatexTables
      ? `\n- LATEX MATRICES, PIECEWISE FUNCTIONS & DATA TABLES: When a problem involves matrices, systems of equations, or experimental data tables, format them inside inline or display LaTeX using \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}, \\begin{cases} ... \\end{cases}, or \\begin{array}{|c|c|} \\hline x & y \\\\ \\hline 1 & 2 \\\\ \\hline \\end{array}.`
      : '';

    // BRIEF PROMPT MODE: High-impact, concise, holistic
    if (promptStyle === 'brief') {
      if (isMath || isMobile) {
        return `Please generate ${totalQuestions} professional multiple choice questions in plain .txt format for:
Grade: ${cleanGrade} (${formattedLevel})
Subject: ${subject}
Topic: ${mainTopic}
Exam Focus: ${examFocusStyle}
Time Limit: ${timeLimit} minutes

FORMAT SPECIFICATION:
================================================================
Grade: ${cleanGrade}
Subject: ${subject}
Topic: ${mainTopic}
Time Limit: ${timeLimit} minutes
================================================================

For each question:
1. [Question statement with exact LaTeX notation for all quantities: $m = 1200\\text{ kg}$, $v = 24\\text{ m/s}$, $t = 8\\text{ s}$]
   A) [Option with exact LaTeX $...$: e.g. $2400\\text{ N}$ or $\\frac{3}{4}\\text{ m/s}$]
   B) [Option with exact LaTeX $...$]
   C) [Option with exact LaTeX $...$]
   D) [Option with exact LaTeX $...$]
   Answer: [Correct Option Letter: A, B, C, or D]
   Explanation: **Formula:**
[ a = \\frac{v - u}{t} ]

[ F = ma ]

**Calculation:**
[ a = \\frac{24 - 0}{8} = 3\\text{ m/s}^2 ]

[ F = 1200 \\times 3 = 3600\\text{ N} ]

**Answer:** $3600\\text{ N}$ (Option B)

CRITICAL RULES FOR EXACT LATEX & CROSS-PLATFORM COMPLIANCE (PC & PHONES):
1. DELIMIT EVERY MATHEMATICAL QUANTITY, SYMBOL & UNIT:
   - In Question statements, wrap ALL variables, constants, vectors, chemical formulas, and quantities with units in $...$ (e.g. $m = 1200\\text{ kg}$, $v_0 = 24\\text{ m/s}$, $\\vec{F}_{\\text{net}}$, $\\text{H}_2\\text{SO}_4$, $\\theta = 30^\\circ$).
   - NEVER leave naked \\text{...}, raw Greek letters, or unwrapped units in the question or options. Always enclose in $...$.
2. EXACT LATEX IN ALL 4 OPTIONS (A, B, C, D):
   - Wrap EVERY mathematical, symbolic, or numerical option in $...$ (e.g. A) $2400\\text{ N}$, B) $3600\\text{ N}$, C) $\\frac{3\\sqrt{2}}{4}\\text{ m/s}$, D) $1.44 \\times 10^4\\text{ N}$).
   - NEVER output plain ASCII math like '5 m/s^2', '3/4', or 'sqrt(5)'. Always use $\\frac{3}{4}$ and $\\sqrt{5}$.
3. STRICTLY NO NUMBERS IN EXPLANATIONS:
   - Do NOT write numbered lists like "1. Formula", "2. Calculation", or "Step 1", "Step 2".
   - Use ONLY bold thematic labels (**Formula:**, **Calculation:**, **Answer:**).
4. FORMULA ISOLATION & BRACKETS:
   - Wrap display equations on their own dedicated line using bracket format [ equation ] (e.g. [ a = \\frac{v - u}{t} ] and [ \\int_0^{\\pi} \\sin(x)\\,dx = 2 ]).
   - Place blank lines before and after every display equation for clean rendering on mobile phones and PC.
   - Strictly retain all LaTeX commands and backslashes (\\frac, \\sqrt, \\times, \\cdot, \\pm, ^2, _0, \\Delta, \\theta, \\pi, \\Omega, \\int, \\sum, \\lim_{x \\to 0}).
   - Wrap physical units in \\text{...} inside math mode (e.g. \\text{ kg}, \\text{ m/s}^2, \\text{ N}, \\text{ J}, \\text{ mol/L}).${latexMatrixRule}
5. BALANCED RANDOM ANSWER SELECTION:
   - Randomize correct option letters evenly and unpredictably across A, B, C, and D. Avoid letter bias.
6. EXAM FOCUS & DIFFICULTY (${difficulty.toUpperCase()} - ${examFocusStyle}):
   - ${focusDirective}
   - ${difficultyConfig.briefGuide}
7. REALISTIC DISTRACTORS: Options B, C, D must reflect realistic student calculation slips (${difficultyConfig.distractorRule}).
8. OUTPUT: Return strictly pure plain text. Do not wrap in markdown code blocks (\`\`\`). Start immediately with the FORMAT SPECIFICATION header.`;
      } else {
        return `Please generate ${totalQuestions} professional multiple choice questions in plain .txt format for:
Grade: ${cleanGrade} (${formattedLevel})
Subject: ${subject}
Topic: ${mainTopic}
Exam Focus: ${examFocusStyle}
Time Limit: ${timeLimit} minutes

FORMAT SPECIFICATION:
================================================================
Grade: ${cleanGrade}
Subject: ${subject}
Topic: ${mainTopic}
Time Limit: ${timeLimit} minutes
================================================================

For each question:
1. [Clear conceptual or scenario-based question statement; wrap any scientific symbols or formulas in $...$]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]
   Answer: [Correct Option Letter: A, B, C, or D]
   Explanation: **Core Concept:**
[Scientific principle, historical context, or fundamental definition]

**Key Reason:**
[Why the chosen option is correct and accurate]

**Distractor Analysis:**
[Brief reason why other plausible choices are incorrect]

**Answer:** Option [Letter]

CRITICAL RULES:
1. STRICTLY NO NUMBERS IN EXPLANATION: Do NOT write "1. Concept 2. Reason". Use ONLY bold thematic labels (**Core Concept:**, **Key Reason:**, **Distractor Analysis:**, **Answer:**).
2. BALANCED RANDOM ANSWER SELECTION: Distribute the correct answer evenly across A, B, C, and D without bias.
3. EXAM FOCUS & DIFFICULTY (${difficulty.toUpperCase()} - ${examFocusStyle}): ${focusDirective} ${difficultyConfig.briefGuide}
4. OUTPUT: Return strictly pure plain text. Do not wrap in markdown code blocks (\`\`\`). Start immediately with the FORMAT SPECIFICATION header.`;
      }
    }

    // DETAILED MASTER PROMPT MODE: Comprehensive curriculum rubric
    let subjectRules = '';
    if (isMath) {
      subjectRules = `CRITICAL FORMATTING & VERTICAL STEP-WISE EXPLANATION RULES (MANDATORY):
1. EXACT LATEX IN QUESTION STATEMENT & ALL OPTIONS:
   - In problem statements, wrap every variable, quantity, vector, chemical formula, and unit in $...$ (e.g. $m = 1200\\text{ kg}$, $v = 24\\text{ m/s}$, $\\theta = 30^\\circ$).
   - NEVER leave raw \\text{...} or numbers unwrapped without $...$.
   - In multiple-choice options (A, B, C, D), EVERY numerical or formula option MUST be enclosed in $...$ (e.g. A) $2400\\text{ N}$, B) $3600\\text{ N}$, C) $\\frac{3}{4}\\text{ m/s}$).
   - NEVER output raw plain ASCII fractions (3/4) or roots (sqrt). Use \\frac{3}{4} and \\sqrt{2}.${latexMatrixRule}
2. STRICTLY NO NUMBERS IN EXPLANATION:
   - Do NOT write numbered lists in the explanation (NEVER write "1. Formula", "2. Calculation", or "Step 1", "Step 2").
   - Structure every explanation vertically using clean, bold thematic labels:
     **Formula:**
     [ a = \\frac{v - u}{t} ]
     
     [ F = ma ]
     
     **Calculation:**
     [ a = \\frac{24 - 0}{8} = 3\\text{ m/s}^2 ]
     
     [ F = 1200 \\times 3 = 3600\\text{ N} ]
     
     **Answer:** $3600\\text{ N}$ (Option B)
3. PHONE-SAFE LATEX MATHEMATICAL NOTATION & FORMULA ISOLATION:
   - To make equations 100% resilient across mobile phones and desktop touch clipboards:
     a) Always put display formulas on their own dedicated line using bracket notation [ equation ] (e.g. [ a = \\frac{v - u}{t} ] or [ F = ma ]).
     b) Separate equations with blank lines above and below for clean formatting.
     c) Always keep backslashes intact on all LaTeX keywords: \\frac{numerator}{denominator}, \\sqrt{x}, \\times, \\cdot, \\pm, \\Delta, \\theta, \\pi, \\Omega, \\mu, \\int, \\sum.
     d) Wrap physical units in \\text{...} inside math mode (e.g. $50\\text{ m/s}$, $1200\\text{ kg}$, $3600\\text{ N}$).
4. BALANCED RANDOM ANSWER DISTRIBUTION:
   - Randomize correct option letters evenly across A, B, C, and D.
5. DISTRACTOR INTEGRITY:
   - ${difficultyConfig.distractorRule}`;
    } else {
      subjectRules = `CRITICAL THEORY & CONCEPTUAL EXPLANATION RULES:
1. STRICTLY NO NUMBERS IN EXPLANATION:
   - Do NOT use numbered lists like "1. Definition 2. Reason".
   - Structure explanations using bold thematic sections:
     **Core Concept:** [State underlying scientific law, definition, or historical context]
     **Key Reason:** [Explain exactly why the correct answer is valid]
     **Distractor Analysis:** [Briefly clarify why plausible incorrect choices fail]
     **Answer:** [Option Letter and summary statement]
2. BALANCED RANDOM ANSWER DISTRIBUTION:
   - Randomize correct option letters evenly across A, B, C, and D.`;
    }

    return `You are an expert exam professor and Ethiopian curriculum specialist creating a standardized ${totalQuestions}-question examination for ${formattedLevel} students in ${subject} (${examFocusStyle}).

OUTPUT FORMAT REQUIREMENT:
Return the exam strictly in clean plain text (.TXT format), ready for direct import into Sinahard Exam Studio.
- DO NOT wrap the output in markdown code fences (\`\`\`txt or \`\`\`).
- DO NOT include conversational greetings, intros, or outros.
- Start directly on line 1 with the FORMAT SPECIFICATION header below, followed by question 1.

REQUIRED EXAM HEADER:
================================================================
FORMAT SPECIFICATION:
Grade: ${cleanGrade}
Subject: ${subject}
Topic: ${mainTopic}
Time Limit: ${timeLimit} minutes
================================================================

QUESTION STRUCTURE (Repeat for all ${totalQuestions} questions):
1. [Question text or scenario with exact LaTeX: $m = 1200\\text{ kg}$, $v = 24\\text{ m/s}$]
   A) [Option A with exact LaTeX: $2400\\text{ N}$]
   B) [Option B with exact LaTeX: $3600\\text{ N}$]
   C) [Option C with exact LaTeX: $4800\\text{ N}$]
   D) [Option D with exact LaTeX: $14400\\text{ N}$]
   Answer: [Correct Option Letter: A, B, C, or D]
   Explanation:
[Provide step-wise explanation without numbers according to rules below]

${focusDirective}
${difficultyConfig.summary}

${subjectRules}

EXAM PARAMETERS:
- Total Questions: ${totalQuestions}
- Class Level: ${formattedLevel} (Grade: ${cleanGrade})
- Specific Topics to Cover: ${topics || 'Standard curriculum'}
- Exam Focus Style: ${examFocusStyle}
- Difficulty Setting: ${difficulty}
- Answer Key Balance: Randomize correct option letters evenly across A, B, C, and D.`;
  }, [subjectType, grade, subject, topics, totalQuestions, timeLimit, difficulty, promptStyle, examFocusStyle, includeLatexTables, difficultyConfig, isMobileDevice, optimizeForPhone]);

  // Sample TXT Output Preview matching format
  const sampleTxtPreview = useMemo(() => {
    const cleanGrade = String(grade || '12');
    const mainTopic = topics.split(',')[0]?.trim() || 'Classical Mechanics';
    if (subjectType === 'calculation') {
      return `================================================================
FORMAT SPECIFICATION:
Grade: ${cleanGrade}
Subject: ${subject || 'Physics'}
Topic: ${mainTopic}
Time Limit: ${timeLimit} minutes
================================================================

1. A car of mass $m = 1200\\text{ kg}$ accelerates uniformly from rest to a velocity of $v = 24\\text{ m/s}$ in $t = 8\\text{ s}$. What is the net force acting on the car?
   A) $2400\\text{ N}$
   B) $3600\\text{ N}$
   C) $4800\\text{ N}$
   D) $14400\\text{ N}$
   Answer: B
   Explanation: **Formula:**
[ a = \\frac{v - u}{t} ]

[ F = ma ]

**Calculation:**
[ a = \\frac{24 - 0}{8} = 3\\text{ m/s}^2 ]

[ F = 1200 \\times 3 = 3600\\text{ N} ]

**Answer:** $3600\\text{ N}$ (Option B)

2. An object accelerates uniformly from initial velocity $u = 5\\text{ m/s}$ to final velocity $v = 25\\text{ m/s}$ in time $t = 4\\text{ s}$. What is its displacement?
   A) $60\\text{ m}$
   B) $120\\text{ m}$
   C) $30\\text{ m}$
   D) $50\\text{ m}$
   Answer: A
   Explanation: **Formula:**
[ s = ut + \\frac{1}{2}at^2 ]

**Calculation:**
[ a = \\frac{25 - 5}{4} = 5\\text{ m/s}^2 ]

[ s = (5)(4) + \\frac{1}{2}(5)(4^2) = 20 + 40 = 60\\text{ m} ]

**Answer:** $60\\text{ m}$ (Option A)`;
    } else {
      return `================================================================
FORMAT SPECIFICATION:
Grade: ${cleanGrade}
Subject: ${subject || 'Biology'}
Topic: ${mainTopic}
Time Limit: ${timeLimit} minutes
================================================================

1. Which organelle is primarily responsible for generating cellular ATP through oxidative phosphorylation?
   A) Ribosome
   B) Mitochondria
   C) Golgi apparatus
   D) Endoplasmic reticulum
   Answer: B
   Explanation: **Core Concept:**
Mitochondria are the primary biochemical powerhouses of eukaryotic cells, executing the Krebs cycle and oxidative phosphorylation.

**Key Reason:**
Option B is correct because the inner mitochondrial cristae host the electron transport chain synthesizing ATP.

**Distractor Analysis:**
Ribosomes synthesize proteins, the Golgi modifies macromolecules, and the ER facilitates lipid/protein synthesis.

**Answer:** Option B`;
    }
  }, [subjectType, grade, subject, topics, timeLimit]);

  const handleCopy = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(generatedPrompt);
      setTimeout(() => {
        setIsCopying(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }, 150);
    } catch {
      setIsCopying(false);
    }
  };

  const handleCopyAndProceed = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
    } catch {
      // ignore
    }
    onClose();
    if (onGoToQuestionTextEditor) {
      onGoToQuestionTextEditor();
    } else if (onGoToPaste) {
      onGoToPaste();
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    saveUserGeminiApiKey(apiKeyInput.trim());
    setApiKeySuccessMsg('API key saved! You can now run agent pipelines with your key.');
    setTimeout(() => setApiKeySuccessMsg(null), 4000);
  };

  const handleClearApiKey = () => {
    clearUserGeminiApiKey();
    setApiKeyInput('');
    setApiKeySuccessMsg('API key removed from browser storage.');
    setTimeout(() => setApiKeySuccessMsg(null), 3000);
  };

  // Syllabus Presets Helper for LangGraph Multi-Agent Studio
  const applySyllabusPreset = (type: 'physics' | 'math' | 'chem' | 'bio' | 'econ' | 'geo') => {
    switch (type) {
      case 'physics':
        setSubject('Physics');
        setGrade('12');
        setLanggraphStream('Natural Science');
        setTopics('Rotational Dynamics & Wave Optics');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Physics Unit 3 & 4: Rotational kinematics, angular momentum conservation, electromagnetic induction (Faraday & Lenz laws), and wave optics.'
        );
        break;
      case 'math':
        setSubject('Mathematics');
        setGrade('12');
        setLanggraphStream('Natural Science');
        setTopics('Differential & Integral Calculus');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Mathematics Unit 2 & 3: Limits, differentiation, mean value theorem, curve sketching, optimization problems, and definite integrals with KaTeX notation.'
        );
        break;
      case 'chem':
        setSubject('Chemistry');
        setGrade('12');
        setLanggraphStream('Natural Science');
        setTopics('Acid-Base Equilibrium & Electrochemistry');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Chemistry Unit 2 & 4: Acid-base equilibria, buffer solutions, pH calculations, Nernst equation, and electrochemical galvanic cells.'
        );
        break;
      case 'bio':
        setSubject('Biology');
        setGrade('12');
        setLanggraphStream('Natural Science');
        setTopics('Molecular Genetics & Protein Synthesis');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Biology Unit 3: Nucleic acids, DNA replication mechanisms, transcription, genetic code, translation, and chromosomal inheritance.'
        );
        break;
      case 'econ':
        setSubject('Economics');
        setGrade('12');
        setLanggraphStream('Social Science');
        setTopics('Macroeconomic Equilibrium & Fiscal Policy');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Economics Unit 3: National income accounting, GDP deflator, aggregate expenditure model, inflation dynamics, and Ethiopian macroeconomic stabilization policies.'
        );
        break;
      case 'geo':
        setSubject('Geography');
        setGrade('12');
        setLanggraphStream('Social Science');
        setTopics('Physical Geography & Topography of Ethiopia');
        setLanggraphSyllabus(
          'Ethiopian Grade 12 Geography Unit 1 & 2: Ethiopian drainage systems, rift valley formations, agro-ecological zones, rainfall patterns, and spatial development in the Horn of Africa.'
        );
        break;
    }
  };

  // Run the LangGraph Multi-Agent pipeline
  const handleRunLangGraph = async () => {
    setIsLanggraphRunning(true);
    setAiError(null);
    setFirestoreSuccessNotice(null);
    setSqliteSuccessNotice(null);
    setLanggraphCurrentStep('Curator');
    setLanggraphStepMessage('Agent A is analyzing curriculum competencies...');

    try {
      const output = await runLangGraphPipeline({
        syllabus: langgraphSyllabus,
        subject,
        grade,
        stream: langgraphStream,
        difficulty,
        count: langgraphBatchCount,
        onStepProgress: (step, msg) => {
          setLanggraphCurrentStep(step);
          setLanggraphStepMessage(msg);
        },
      });

      setLanggraphLogs(output.logs);
      setLanggraphObjectives(output.curriculumObjectives);
      setLanggraphQuestions(output.questions);
      setLanggraphCriticReview(output.criticReview);
      setLanggraphIterations(output.iterationCount);

      if (output.status === 'error') {
        setAiError(output.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Agent pipeline execution failed.';
      setAiError(msg);
    } finally {
      setIsLanggraphRunning(false);
      setLanggraphCurrentStep(null);
    }
  };

  // Save LangGraph verified questions into Firestore Cloud Database
  const handleSaveLangGraphToFirestore = async () => {
    if (langgraphQuestions.length === 0) return;
    setIsSavingToFirestore(true);
    setFirestoreSuccessNotice(null);
    try {
      const examTitle = `${subject} Gr ${grade} (${langgraphStream}) - LangGraph Verified`;
      const examId = await saveExamToFirestore({
        title: examTitle,
        name: examTitle,
        subject,
        grade,
        topic: topics || 'National Curriculum Standards',
        questions: langgraphQuestions,
        questionCount: langgraphQuestions.length,
        timeLimit,
      });

      setFirestoreSuccessNotice(`Saved to Exam Library! (ID: ${examId})`);
      if (onAddGeneratedQuestions) {
        onAddGeneratedQuestions(langgraphQuestions, examTitle);
      }
      setTimeout(() => setFirestoreSuccessNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save to Exam Library.';
      setAiError(msg);
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  // Export LangGraph verified questions into offline backup file
  const handleExportLangGraphToSqlite = async () => {
    if (langgraphQuestions.length === 0) return;
    setIsExportingSqlite(true);
    setSqliteSuccessNotice(null);
    try {
      const examTitle = `${subject}_Gr${grade}_${langgraphStream}`;
      const res = await downloadExamSqliteFile(
        examTitle,
        subject,
        grade,
        langgraphStream,
        langgraphQuestions
      );
      setSqliteSuccessNotice(`Offline backup downloaded: ${res.fileName} (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
      setTimeout(() => setSqliteSuccessNotice(null), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate offline backup file.';
      setAiError(msg);
    } finally {
      setIsExportingSqlite(false);
    }
  };

  // Launch direct practice mode with the LangGraph verified questions
  const handleLaunchPracticeWithLangGraph = () => {
    if (langgraphQuestions.length === 0) return;
    const examObj: Exam = {
      id: `langgraph-exam-${Date.now()}`,
      name: `${subject} (${formatClassLevelLabel(grade)}) - Verified Exam`,
      title: `${subject} (${formatClassLevelLabel(grade)}) - Verified Exam`,
      subject,
      topic: topics,
      grade,
      timeLimit,
      questions: langgraphQuestions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onClose();
    if (onStartDirectPractice) {
      onStartDirectPractice(examObj);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="professor-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div
        id="professor-modal-container"
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-[28px] sm:rounded-[32px] liquid-glass-elevated text-slate-900 dark:text-white overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-5 sm:px-6 py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl liquid-glass-subtle text-slate-900 dark:text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                  AI Prompt &amp; LaTeX Studio
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setOptimizeForPhone((prev) => !prev);
                    triggerRegeneration();
                  }}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                    optimizeForPhone
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'liquid-glass-subtle text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Toggle Phone-Safe Exact LaTeX prompt directives"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>{optimizeForPhone ? 'Exact LaTeX: Active' : 'Exact LaTeX: Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowApiKeyInput((prev) => !prev)}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                    hasUserGeminiApiKey()
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                      : showApiKeyInput
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 border-transparent'
                      : 'liquid-glass-subtle text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Configure personal API Key for direct in-browser generation"
                >
                  <Key className="w-3 h-3" />
                  <span>{hasUserGeminiApiKey() ? 'API Key: Set' : 'API Key'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {classLocked
                  ? `Tailored LaTeX exam prompts for your registered class (${formatClassLevelLabel(grade)})`
                  : 'Create gold-standard KaTeX/LaTeX prompts for ChatGPT, Claude, Gemini & DeepSeek'}
              </p>
            </div>
          </div>

          <button
            id="professor-modal-close-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full liquid-glass-subtle text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close AI Prompt Studio"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Quick Curriculum Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('physics')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Physics'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Physics (Mechanics)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('math12')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Mathematics'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Calculus &amp; Algebra
            </button>
            <button
              type="button"
              onClick={() => applyPreset('freshman_math')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Applied Mathematics I'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              University Math I
            </button>
            <button
              type="button"
              onClick={() => applyPreset('chemistry')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Chemistry'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Chemistry
            </button>
            <button
              type="button"
              onClick={() => applyPreset('biology')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Biology'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Biology
            </button>
            <button
              type="button"
              onClick={() => applyPreset('social')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer border ${
                subject === 'Economics & History'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                  : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Economics &amp; Social
            </button>
          </div>

          {/* Stepper Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Subject Type Segmented Switch */}
            <div className="p-3 rounded-2xl liquid-glass-subtle flex flex-col justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Question Mode
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-[#070e1a] rounded-xl border border-white/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setSubjectType('calculation');
                    triggerRegeneration();
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    subjectType === 'calculation'
                      ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Math / LaTeX
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubjectType('theory');
                    triggerRegeneration();
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    subjectType === 'theory'
                      ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Conceptual
                </button>
              </div>
            </div>

            {/* Grade Stepper (Locked for registered students, unlocked for Admin/Guest) */}
            <div className="p-3 rounded-2xl liquid-glass-subtle flex flex-col justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                {classLocked ? 'Registered Class' : 'Class Level'}
              </label>
              {classLocked ? (
                <div className="flex items-center justify-center bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 rounded-xl px-2.5 py-1.5">
                  <span className="font-bold text-xs text-sky-700 dark:text-sky-300 truncate">
                    {formatClassLevelLabel(grade)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 rounded-xl px-2 py-1">
                  <button
                    type="button"
                    onClick={handlePrevGrade}
                    disabled={currentGradeIndex <= 0}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                    aria-label="Previous grade"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate px-1">
                    {grade === 'Freshman' || grade === 'Senior University'
                      ? grade
                      : `Grade ${grade}`}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextGrade}
                    disabled={currentGradeIndex >= GRADE_LIST.length - 1}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                    aria-label="Next grade"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Questions Stepper */}
            <div className="p-3 rounded-2xl liquid-glass-subtle flex flex-col justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Questions Count
              </label>
              <div className="flex items-center justify-between bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={handleDecrementQuestions}
                  disabled={totalQuestions <= 1}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                  aria-label="Decrease question count"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                  {totalQuestions} Questions
                </span>
                <button
                  type="button"
                  onClick={handleIncrementQuestions}
                  disabled={totalQuestions >= 25}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                  aria-label="Increase question count"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Time Limit Stepper */}
            <div className="p-3 rounded-2xl liquid-glass-subtle flex flex-col justify-between">
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Time Limit
              </label>
              <div className="flex items-center justify-between bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={handleDecrementTime}
                  disabled={timeLimit <= 5}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                  aria-label="Decrease time limit"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                  {timeLimit} min
                </span>
                <button
                  type="button"
                  onClick={handleIncrementTime}
                  disabled={timeLimit >= 180}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0f1d33] hover:bg-slate-200 dark:hover:bg-[#132238] flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                  aria-label="Increase time limit"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Subject & Topics Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  triggerRegeneration();
                }}
                placeholder="e.g. Physics, Chemistry, Applied Calculus"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Topics / Concept Focus
              </label>
              <input
                type="text"
                value={topics}
                onChange={(e) => {
                  setTopics(e.target.value);
                  triggerRegeneration();
                }}
                placeholder="e.g. Classical Mechanics, Work & Energy, Matrices"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition"
              />
            </div>
          </div>

          {/* Exam Focus Style & Difficulty Calibration Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Exam Style Focus */}
            <div className="p-3 rounded-2xl liquid-glass-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Exam Standard &amp; LaTeX Scope
                </span>
                {subjectType === 'calculation' && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLatexTables}
                      onChange={(e) => {
                        setIncludeLatexTables(e.target.checked);
                        triggerRegeneration();
                      }}
                      className="rounded accent-sky-600"
                    />
                    <span>Include Matrices / Tables</span>
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    'National Exam (EUEE)',
                    'University Final',
                    'Conceptual Mastery',
                    'Olympiad / Challenger',
                  ] as ExamFocusStyle[]
                ).map((styleName) => (
                  <button
                    key={styleName}
                    type="button"
                    onClick={() => {
                      setExamFocusStyle(styleName);
                      triggerRegeneration();
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer text-left truncate border ${
                      examFocusStyle === styleName
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-2xs'
                        : 'bg-white/70 dark:bg-[#070e1a] text-slate-700 dark:text-zinc-300 border-slate-200/70 dark:border-white/10 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {styleName}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Segmented Selector */}
            <div className="p-3 rounded-2xl liquid-glass-subtle flex flex-col justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Difficulty: {difficultyConfig.label}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {difficultyConfig.summary}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/60 dark:bg-[#070e1a] rounded-xl border border-white/60 dark:border-white/10">
                {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setDifficulty(lvl);
                      triggerRegeneration();
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      difficulty === lvl
                        ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Client-Side API Key Card */}
          {showApiKeyInput && (
            <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-950 dark:text-white">
                      Personal AI API Key
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                      Generates verified exams directly in your browser without external copy-pasting.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded-lg cursor-pointer"
                  title="Close API Key panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Gemini API Key (e.g. AIzaSy...)"
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition active:scale-98 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Key</span>
                  </button>
                  {hasUserGeminiApiKey() && (
                    <button
                      type="button"
                      onClick={handleClearApiKey}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer shrink-0"
                      title="Clear stored key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {apiKeySuccessMsg && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{apiKeySuccessMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1 flex-wrap gap-2">
                  <span>Saved privately on your device.</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Get Free API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* AI Generation Error Banner */}
          {aiError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-2">
                <p className="font-semibold">{aiError}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {!showApiKeyInput && (
                    <button
                      type="button"
                      onClick={() => setShowApiKeyInput(true)}
                      className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>Enter API Key</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Prompt for External AI</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Selector Tabs & Action Bar */}
          <div className="pt-1 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/70 dark:border-white/10 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Main View Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-[#0c182b] border border-white/80 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveView('prompt')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeView === 'prompt'
                        ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>LaTeX Prompt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('agent')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeView === 'agent'
                        ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Create with Agent</span>
                    {langgraphQuestions.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-500/30">
                        {langgraphQuestions.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('txt_preview')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      activeView === 'txt_preview'
                        ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Output Sample</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveView('admin_vision')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        activeView === 'admin_vision'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Past-Exam Vision</span>
                    </button>
                  )}
                </div>

                {/* Brief vs Detailed Toggle (Only in Prompt view) */}
                {activeView === 'prompt' && (
                  <div className="flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-[#0c182b] border border-white/80 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        triggerRegeneration();
                        setPromptStyle('brief');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        promptStyle === 'brief'
                          ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Concise high-impact prompt"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Brief</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerRegeneration();
                        setPromptStyle('detailed');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        promptStyle === 'detailed'
                          ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Full pedagogical rubric"
                    >
                      <span>Full Rubric</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons in Tab Header */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isCopying}
                  onClick={handleCopy}
                  className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-98 disabled:opacity-50"
                  title="Copy prompt for external AI chatbots"
                >
                  {isCopying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Copying...</span>
                    </>
                  ) : copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: PROMPT */}
            {activeView === 'prompt' && (
              <div className="space-y-3">
                <textarea
                  id="generated-prompt-textarea"
                  rows={9}
                  readOnly
                  value={generatedPrompt}
                  className="w-full p-4 font-mono text-xs leading-relaxed rounded-[22px] bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-zinc-100 select-all focus:outline-none"
                />

                {/* Live KaTeX Math Rendering Preview Card */}
                <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Live KaTeX Math Rendering Preview
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                        · Inline <code className="font-mono">$...$</code> &amp; Display <code className="font-mono">[ ... ]</code>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLatexLivePreview((prev) => !prev)}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {showLatexLivePreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>

                  {showLatexLivePreview && (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200/70 dark:border-white/10 space-y-2 text-xs text-slate-900 dark:text-zinc-100">
                      <MathRenderer
                        text={
                          includeLatexTables
                            ? `Sample Question: For the linear system with coefficient matrix $A = \\begin{pmatrix} 2 & -1 \\\\ 1 & 3 \\end{pmatrix}$ and force $F = 3600\\text{ N}$, the derived acceleration is:\n[ a = \\frac{v - u}{t} = \\frac{24 - 0}{8} = 3\\text{ m/s}^2 ]\nOptions: A) $2400\\text{ N}$  B) $3600\\text{ N}$  C) $\\frac{3\\sqrt{2}}{4}\\text{ m/s}$`
                            : `Sample Question: A body of mass $m = 1200\\text{ kg}$ accelerates uniformly to $v = 24\\text{ m/s}$ in $t = 8\\text{ s}$ at $\\theta = 30^\\circ$.\n[ a = \\frac{v - u}{t} = 3\\text{ m/s}^2 \\quad \\Rightarrow \\quad F = ma = 3600\\text{ N} ]\nOptions: A) $2400\\text{ N}$  B) $3600\\text{ N}$  C) $\\frac{3\\sqrt{2}}{4}\\text{ m/s}$`
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 px-1 flex-wrap gap-2">
                  <span>Compatible with ChatGPT, Claude, Gemini &amp; DeepSeek.</span>
                  <span className="text-slate-900 dark:text-white font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Exact KaTeX Math &amp; Balanced Answer Keys (A, B, C, D)
                  </span>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: SAMPLE TXT OUTPUT PREVIEW */}
            {activeView === 'txt_preview' && (
              <div className="space-y-2">
                <textarea
                  rows={10}
                  readOnly
                  value={sampleTxtPreview}
                  className="w-full p-4 font-mono text-xs leading-relaxed rounded-[22px] bg-white dark:bg-[#070e1a] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-zinc-100 select-all focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 px-1">
                  Format standard: questions, options A–D, Answer letter, and bracket formula display <strong>{'[ a = \\frac{v - u}{t} ]'}</strong>.
                </p>
              </div>
            )}

            {/* TAB CONTENT 2.5: ADMIN HARD-COPY PAST EXAM VISION PROMPT */}
            {activeView === 'admin_vision' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-bold text-sm text-slate-950 dark:text-white">
                        Admin Hard-Copy Past Exam Vision Prompt
                      </h4>
                    </div>
                    {onOpenAdminOfficialStudio && (
                      <button
                        type="button"
                        onClick={onOpenAdminOfficialStudio}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Open Official Exam Studio</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">
                    Use this prompt with ChatGPT-4o, Claude 3.5 Sonnet, or Gemini 2.0 to transcribe scanned past Ethiopian exam papers with KaTeX math and diagram placeholders.
                  </p>
                </div>

                {/* Quick Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">Tier</label>
                    <select
                      value={visionTier}
                      onChange={(e) => setVisionTier(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                    >
                      <option value="university">University Tier</option>
                      <option value="secondary">Secondary Tier</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
                      {visionTier === 'university' ? 'University' : 'Grade'}
                    </label>
                    <input
                      type="text"
                      value={visionUniversity}
                      onChange={(e) => setVisionUniversity(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">Subject</label>
                    <input
                      type="text"
                      value={visionSubject}
                      onChange={(e) => setVisionSubject(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">Year / Exam</label>
                    <input
                      type="text"
                      value={`${visionExamType} ${visionExamYear}`}
                      onChange={(e) => setVisionExamYear(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* 3 Toggles */}
                <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={visionIncludeDiagrams}
                      onChange={(e) => setVisionIncludeDiagrams(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>Detect Question Diagrams</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={visionIncludeChoiceImages}
                      onChange={(e) => setVisionIncludeChoiceImages(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>Detect Choice Images (A-D)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={visionIncludeTables}
                      onChange={(e) => setVisionIncludeTables(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>Detect Tables</span>
                  </label>
                </div>

                {/* Prompt Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-zinc-300">Generated Master Vision Prompt</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const txt = generateHardCopyExamVisionPrompt({
                          universityOrGrade: visionUniversity,
                          subject: visionSubject,
                          examType: visionExamType,
                          examYear: visionExamYear,
                          includeDiagrams: visionIncludeDiagrams,
                          includeChoiceImages: visionIncludeChoiceImages,
                          includeTables: visionIncludeTables,
                        });
                        await navigator.clipboard.writeText(txt);
                        setVisionCopied(true);
                        setTimeout(() => setVisionCopied(false), 2500);
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {visionCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{visionCopied ? 'Copied to Clipboard!' : 'Copy Prompt'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={10}
                    readOnly
                    value={generateHardCopyExamVisionPrompt({
                      universityOrGrade: visionUniversity,
                      subject: visionSubject,
                      examType: visionExamType,
                      examYear: visionExamYear,
                      includeDiagrams: visionIncludeDiagrams,
                      includeChoiceImages: visionIncludeChoiceImages,
                      includeTables: visionIncludeTables,
                    })}
                    className="w-full p-4 font-mono text-xs leading-relaxed rounded-[22px] bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100 select-all focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: CREATE WITH AGENT */}
            {activeView === 'agent' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Agent Pipeline Architecture Banner */}
                <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                            Create with Agent: 3-Stage Verification Loop
                          </h3>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            KaTeX Verified
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 dark:text-zinc-400">
                          <strong>Stage A</strong> curates syllabus topics, <strong>Stage B</strong> crafts KaTeX math questions, and <strong>Stage C</strong> verifies accuracy before saving to your Exam Library.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-xl">
                        Instant Library &amp; Offline Save
                      </span>
                    </div>
                  </div>

                  {/* Syllabus Presets Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 no-scrollbar text-xs">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
                      Curriculum Presets:
                    </span>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('physics')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Physics
                    </button>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('math')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Calculus
                    </button>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('chem')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Chemistry
                    </button>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('bio')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Biology
                    </button>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('econ')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Economics
                    </button>
                    <button
                      type="button"
                      onClick={() => applySyllabusPreset('geo')}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 hover:border-slate-400 text-slate-800 dark:text-zinc-200 transition shrink-0 cursor-pointer"
                    >
                      Geography
                    </button>
                  </div>
                </div>

                {/* Configuration Row: Stream, Batch Count & Syllabus Text */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                      Target Academic Stream
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-[#070e1a] rounded-xl border border-white/60 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setLanggraphStream('Natural Science')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                          langgraphStream === 'Natural Science'
                            ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                        }`}
                      >
                        Natural Science
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanggraphStream('Social Science')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                          langgraphStream === 'Social Science'
                            ? 'bg-white dark:bg-white text-slate-950 dark:text-zinc-950 shadow-2xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                        }`}
                      >
                        Social Science
                      </button>
                    </div>

                    <div className="pt-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Question Batch Size
                      </label>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/60 dark:bg-[#070e1a] rounded-xl border border-white/60 dark:border-white/10">
                        {[2, 3, 5, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setLanggraphBatchCount(num)}
                            className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                              langgraphBatchCount === num
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {num} Qs
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 p-3.5 rounded-2xl liquid-glass-subtle space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          Curriculum Syllabus &amp; Learning Objectives
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatClassLevelLabel(grade)}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={langgraphSyllabus}
                        onChange={(e) => setLanggraphSyllabus(e.target.value)}
                        placeholder="Paste syllabus unit objectives, formula specifications, or chapter guidelines..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#070e1a] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-zinc-100 font-medium focus:outline-none transition"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                        <Cpu className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
                        <span>3-Stage Verification &bull; KaTeX Math</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleRunLangGraph}
                        disabled={isLanggraphRunning || !langgraphSyllabus.trim()}
                        className="px-5 py-2.5 rounded-full bg-slate-900 hover:opacity-90 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs active:scale-98 transition disabled:opacity-50 shrink-0"
                      >
                        {isLanggraphRunning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                        <span>
                          {isLanggraphRunning
                            ? 'Generating Questions...'
                            : `Generate Exam (${langgraphBatchCount} Qs)`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feedback Notices */}
                {firestoreSuccessNotice && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{firestoreSuccessNotice}</span>
                  </div>
                )}

                {sqliteSuccessNotice && (
                  <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-200 text-xs font-semibold flex items-center gap-2">
                    <Download className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{sqliteSuccessNotice}</span>
                  </div>
                )}

                {/* Real-Time Agent Stepper & Graph Flow Display */}
                {(isLanggraphRunning || langgraphQuestions.length > 0) && (
                  <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                          Verification Pipeline Progress
                        </h4>
                      </div>
                      {langgraphCriticReview && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            langgraphCriticReview.pass
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          }`}>
                            Quality Score: {langgraphCriticReview.score}/100 &bull; {langgraphIterations} Pass
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stepper Nodes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Node A */}
                      <div className={`p-3 rounded-xl border text-xs space-y-1 transition ${
                        langgraphCurrentStep === 'Curator'
                          ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20 dark:bg-sky-950/20'
                          : langgraphObjectives.length > 0
                          ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10'
                          : 'border-slate-200 dark:border-white/5 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
                              A
                            </span>
                            <span>Syllabus Curator</span>
                          </span>
                          {langgraphObjectives.length > 0 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {langgraphObjectives.length > 0
                            ? `${langgraphObjectives.length} competencies extracted`
                            : 'Analyzing curriculum standards...'}
                        </p>
                      </div>

                      {/* Node B */}
                      <div className={`p-3 rounded-xl border text-xs space-y-1 transition ${
                        langgraphCurrentStep === 'Author'
                          ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20'
                          : langgraphQuestions.length > 0
                          ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10'
                          : 'border-slate-200 dark:border-white/5 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                              B
                            </span>
                            <span>KaTeX Problem Author</span>
                          </span>
                          {langgraphQuestions.length > 0 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {langgraphQuestions.length > 0
                            ? `${langgraphQuestions.length} KaTeX questions formulated`
                            : 'Formulating LaTeX equations...'}
                        </p>
                      </div>

                      {/* Node C */}
                      <div className={`p-3 rounded-xl border text-xs space-y-1 transition ${
                        langgraphCurrentStep === 'Critic'
                          ? 'border-slate-900 ring-2 ring-slate-500/20 bg-slate-100 dark:bg-zinc-800'
                          : langgraphCriticReview
                          ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10'
                          : 'border-slate-200 dark:border-white/5 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-[10px] flex items-center justify-center font-bold">
                              C
                            </span>
                            <span>Accuracy Verifier</span>
                          </span>
                          {langgraphCriticReview?.pass && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {langgraphCriticReview
                            ? `Verified • Score ${langgraphCriticReview.score}/100`
                            : 'Checking solutions & KaTeX brackets...'}
                        </p>
                      </div>
                    </div>

                    {isLanggraphRunning && (
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-2 pt-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900 dark:text-white" />
                        <span>{langgraphStepMessage}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Critic Audit Results Card */}
                {langgraphCriticReview && (
                  <div className="p-4 rounded-2xl liquid-glass-subtle space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          Quality &amp; Math Verification Report
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {langgraphCriticReview.hallucinationCheck}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                      <strong>Review Summary:</strong> {langgraphCriticReview.critiqueNotes}
                    </p>
                  </div>
                )}

                {/* Verified Questions Review List */}
                {langgraphQuestions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-white/10 pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Verified Questions ({langgraphQuestions.length})</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          KaTeX Certified
                        </span>
                      </h4>

                      {/* Export & Save Action Bar */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleExportLangGraphToSqlite}
                          disabled={isExportingSqlite}
                          className="px-3 py-1.5 rounded-full liquid-glass-btn font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                          title="Download an offline backup file of these questions"
                        >
                          {isExportingSqlite ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          )}
                          <span>Offline Backup</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveLangGraphToFirestore}
                          disabled={isSavingToFirestore}
                          className="px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                          title="Save verified questions to your Exam Library"
                        >
                          {isSavingToFirestore ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>Save to Library</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleLaunchPracticeWithLangGraph}
                          className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Practice Now</span>
                        </button>
                      </div>
                    </div>

                    {/* Question Items */}
                    <div className="space-y-3">
                      {langgraphQuestions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-4 rounded-2xl liquid-glass-subtle space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2">
                            <span className="font-bold text-xs text-slate-950 dark:text-white">
                              Question {idx + 1} &bull; {q.topic || subject}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#0c182b] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
                              Verified: {q.criticScore || 95}%
                            </span>
                          </div>

                          {/* Problem Text with KaTeX */}
                          <div className="text-xs text-slate-900 dark:text-zinc-100 font-medium leading-relaxed">
                            <MathRenderer text={q.text} />
                          </div>

                          {/* 4 Choices */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = q.correct === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                    isCorrect
                                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-semibold'
                                      : 'border-slate-200/80 dark:border-white/5 bg-white/80 dark:bg-[#070e1a] text-slate-700 dark:text-zinc-300'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                  }`}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <MathRenderer text={opt} />
                                  </div>
                                  {isCorrect && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Step-by-Step Explanation */}
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-white/80 dark:bg-[#070e1a] border border-slate-200/70 dark:border-white/5 text-[11px] text-slate-700 dark:text-zinc-300 space-y-1">
                              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider block text-[10px]">
                                Step-by-Step Solution &amp; Formula Derivation:
                              </span>
                              <MathRenderer text={q.explanation} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>
              {activeView === 'agent'
                ? 'Create with Agent • KaTeX Math Verified'
                : activeView === 'admin_vision'
                ? 'Past-Exam Vision Pipeline • KaTeX & Diagrams'
                : `Formatted for ${formatClassLevelLabel(grade)} • ChatGPT, Claude, Gemini & DeepSeek`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="professor-footer-close-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full liquid-glass-subtle text-slate-700 dark:text-zinc-300 font-bold text-xs hover:text-slate-950 dark:hover:text-white cursor-pointer transition"
            >
              Close
            </button>

            {activeView === 'admin_vision' && onOpenAdminOfficialStudio ? (
              <button
                type="button"
                onClick={onOpenAdminOfficialStudio}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Open in Official Studio</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : activeView === 'agent' && langgraphQuestions.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportLangGraphToSqlite}
                  disabled={isExportingSqlite}
                  className="px-4 py-2 rounded-full liquid-glass-btn font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Offline Backup</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchPracticeWithLangGraph}
                  className="px-5 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition"
                >
                  <span>Practice ({langgraphQuestions.length} Qs)</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ) : (
              <button
                id="professor-go-to-editor-btn"
                type="button"
                onClick={handleCopyAndProceed}
                className="px-5 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition"
                title="Copy prompt to clipboard and open Question Editor"
              >
                <span>Copy &amp; Open Editor</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

