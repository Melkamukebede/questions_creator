import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Eye,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Building2,
  BookOpen,
  Clipboard,
  Check,
  FileText,
  Sliders,
  Copy,
  ArrowRight,
  ArrowLeft,
  CheckCheck,
} from 'lucide-react';
import {
  Exam,
  Question,
  ETHIOPIAN_UNIVERSITIES,
  FRESHMAN_SUBJECTS,
  SECONDARY_SUBJECTS,
  ETHIOPIAN_EXAM_YEARS,
} from '../types';
import { uploadExamMedia, saveOfficialExamToSupabase, getSupabaseConfig } from '../services/supabaseService';
import { parseAiExamText, generateHardCopyExamVisionPrompt } from '../services/aiExamParserService';
import { MarkdownTableRenderer } from './MarkdownTableRenderer';
import { MathRenderer } from './MathRenderer';
import { MediaLightboxModal } from './MediaLightboxModal';
import { addDownloadedExamsToRepository } from '../services/db';

type StudioTab = 'paste' | 'editor' | 'preview' | 'prompt';

interface AdminOfficialExamStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamPublished?: (exam: Exam) => void;
  isAdmin: boolean;
}

export const AdminOfficialExamStudioModal: React.FC<AdminOfficialExamStudioModalProps> = ({
  isOpen,
  onClose,
  onExamPublished,
  isAdmin,
}) => {
  const supabaseConfig = getSupabaseConfig();

  // Active Workflow Tab
  const [activeTab, setActiveTab] = useState<StudioTab>('paste');

  // Three Top Media Detection Toggles
  const [detectQuestionImages, setDetectQuestionImages] = useState<boolean>(true);
  const [detectOptionImages, setDetectOptionImages] = useState<boolean>(false);
  const [detectTables, setDetectTables] = useState<boolean>(true);

  // Raw AI Paste State
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // Basic Metadata
  const [tier, setTier] = useState<'university' | 'secondary'>('university');
  const [university, setUniversity] = useState<string>('Addis Ababa University (AAU)');
  const [department, setDepartment] = useState<string>('Pre-Engineering / Natural Science');
  const [subject, setSubject] = useState<string>('Phys 1011 (General Physics)');
  const [academicYear, setAcademicYear] = useState<string>('Freshman');
  const [semester, setSemester] = useState<'Semester 1' | 'Semester 2'>('Semester 1');
  const [examType, setExamType] = useState<'Mid' | 'Final' | 'Make-up'>('Final');
  const [examYear, setExamYear] = useState<string>('2016 E.C.');
  const [examName, setExamName] = useState<string>('AAU General Physics (Phys 1011) Final Exam 2016');
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [description, setDescription] = useState<string>('Official Addis Ababa University Freshman Semester 1 final exam with circuit schematic and kinematics parameters table.');

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_admin_1',
      text: 'For the DC resistor network shown in the diagram, what is the equivalent resistance between terminals A and B if each branch resistor has \\( R = 12\\,\\Omega \\)?',
      options: ['\\( 8\\,\\Omega \\)', '\\( 16\\,\\Omega \\)', '\\( 4\\,\\Omega \\)', '\\( 12\\,\\Omega \\)'],
      correct: 0,
      explanation: 'Using standard delta-wye transformation: 12 ohms in parallel with 24 ohms gives an equivalent resistance of \\( R_{eq} = 8\\,\\Omega \\).',
      imageUrl: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=700&q=80',
      imageCaption: 'Figure 1.1: DC Bridge Resistor Circuit Network with terminals A and B.',
      tableMarkdown: '| Resistor | Branch | Nominal Resistance (\\(\\Omega\\)) |\n| :--- | :--- | :--- |\n| \\(R_1\\) | Upper Bridge | \\(12\\,\\Omega\\) |\n| \\(R_2\\) | Lower Bridge | \\(12\\,\\Omega\\) |\n| \\(R_3\\) | Cross Shunt | \\(12\\,\\Omega\\) |',
    },
  ]);

  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [uploadingImageTarget, setUploadingImageTarget] = useState<{ qIdx: number; optIdx?: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string; title?: string } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadRef = useRef<{ qIdx: number; optIdx?: number } | null>(null);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0c182b] text-center space-y-4 border border-red-500/30">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Admin Privileges Required</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Only verified administrators (such as <code>melkamukebede11@gmail.com</code>) have permission to upload official exams and diagram media to the Supabase cloud.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Handle Triggering File Input for a Question or Choice
  const triggerImageUpload = (qIdx: number, optIdx?: number) => {
    activeUploadRef.current = { qIdx, optIdx };
    fileInputRef.current?.click();
  };

  // Handle direct diagram image upload to Supabase Storage
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = activeUploadRef.current;
    if (!file || !target) return;

    setUploadingImageTarget(target);
    setStatusMsg(null);

    try {
      const cleanSubject = subject.split(' ')[0] || 'stem';
      const fileLabel = target.optIdx !== undefined
        ? `choice_${String.fromCharCode(65 + target.optIdx)}_q${target.qIdx + 1}`
        : `diagram_${cleanSubject}_q${target.qIdx + 1}`;

      const uploadResult = await uploadExamMedia(file, fileLabel);

      const updated = [...questions];
      const targetQ = { ...updated[target.qIdx] };

      if (target.optIdx !== undefined) {
        // Choice option image
        const optImages = targetQ.optionImages ? [...targetQ.optionImages] : [null, null, null, null];
        optImages[target.optIdx] = uploadResult.url;
        targetQ.optionImages = optImages;
      } else {
        // Question prompt image
        targetQ.imageUrl = uploadResult.url;
        targetQ.imageCaption = targetQ.imageCaption || `Figure ${target.qIdx + 1}: ${file.name.replace(/\.[^/.]+$/, '')}`;
      }

      updated[target.qIdx] = targetQ;
      setQuestions(updated);

      setStatusMsg({
        type: 'success',
        text: uploadResult.storageSource === 'supabase'
          ? 'Image uploaded to Supabase Storage "exam-media" bucket!'
          : 'Image embedded as Base64 fallback (Supabase credentials unconfigured).',
      });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatusMsg({ type: 'error', text: `Failed to upload image: ${msg}` });
    } finally {
      setUploadingImageTarget(null);
      activeUploadRef.current = null;
      e.target.value = '';
    }
  };

  // Parse Raw AI Text
  const handleParseRawText = () => {
    if (!pastedRawText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste raw AI exam text into the box.' });
      return;
    }

    setIsParsing(true);
    setStatusMsg(null);

    try {
      const result = parseAiExamText(pastedRawText, {
        detectQuestionImages,
        detectOptionImages,
        detectTables,
      });

      if (!result.success || result.questions.length === 0) {
        setStatusMsg({
          type: 'error',
          text: result.errors[0] || 'Failed to detect numbered questions. Ensure questions start with "1. ", "2. ", etc.',
        });
        return;
      }

      setQuestions(result.questions);
      setActiveQuestionIndex(0);

      // Auto-update exam title if default
      if (!examName || examName.startsWith('AAU General Physics')) {
        setExamName(`${university.split(' ')[0]} ${subject} ${examType} Exam ${examYear}`);
      }

      setStatusMsg({
        type: 'success',
        text: `Extracted ${result.questions.length} questions! Review diagrams and LaTeX formulas below.`,
      });

      // Switch to review editor tab
      setTimeout(() => {
        setActiveTab('editor');
      }, 700);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: `Parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Load Sample AI Exam Text
  const handleLoadSampleText = () => {
    const sample = `1. A projectile is launched from ground level with an initial velocity \\( v_0 = 50\\text{ m/s} \\) at an angle of \\( \\theta = 37^\\circ \\) above the horizontal. Neglecting air resistance, what is the maximum height reached? (Take \\( g = 9.8\\text{ m/s}^2 \\))
[IMAGE: Kinematic trajectory parabola showing velocity vector at 37 degrees]
A) 32.4 m
B) 45.9 m
C) 61.2 m
D) 78.5 m
Answer: B
Explanation: The vertical component of initial velocity is \\( v_{0y} = v_0 \\sin 37^\\circ = 50(0.6) = 30\\text{ m/s} \\). The maximum height is \\( H = \\frac{v_{0y}^2}{2g} = \\frac{900}{2(9.8)} \\approx 45.92\\text{ m} \\).

2. In an electrical measurement experiment, the voltage drops across four series resistors are recorded in the data table below with a constant current \\( I = 2.0\\text{ A} \\).
| Resistor | Value (\\(\\Omega\\)) | Measured Drop (V) | Power (W) |
| :--- | :--- | :--- | :--- |
| \\(R_1\\) | 5.0 | 10.0 | 20.0 |
| \\(R_2\\) | 10.0 | 20.0 | 40.0 |
| \\(R_3\\) | 15.0 | 30.0 | 60.0 |
What is the total power dissipated by the circuit?
A) 60 W
B) 100 W
C) 120 W
D) 240 W
Answer: C
Explanation: Total power is the sum of individual powers: \\( P_{total} = 20 + 40 + 60 = 120\\text{ W} \\), or \\( P = I^2 R_{eq} = (2^2)(30) = 120\\text{ W} \\).

3. Which of the following thermodynamic state diagrams represents an ideal gas undergoing an isobaric expansion from state 1 to state 2?
A) [IMAGE_OPT_A: Horizontal line on P-V diagram with arrow pointing right] Horizontal line on P-V diagram
B) [IMAGE_OPT_B: Vertical line on P-V diagram] Vertical line on P-V diagram
C) [IMAGE_OPT_C: Hyperbolic curve on P-V diagram] Hyperbolic curve on P-V diagram
D) [IMAGE_OPT_D: Diagonal line with negative slope] Straight diagonal line with negative slope
Answer: A
Explanation: By definition, an isobaric process occurs at constant pressure (\\( \\Delta P = 0 \\)), which is represented by a horizontal line on a \\( P-V \\) diagram moving to the right as volume expands.`;

    setPastedRawText(sample);
    setDetectQuestionImages(true);
    setDetectOptionImages(true);
    setDetectTables(true);
    setStatusMsg({ type: 'success', text: 'Loaded sample exam with diagrams, tables, and choice images!' });
  };

  // Add question helper
  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q_admin_${Date.now()}_${questions.length + 1}`,
      text: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: '',
    };
    setQuestions([...questions, newQ]);
    setActiveQuestionIndex(questions.length);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveQuestionIndex(Math.max(0, idx - 1));
  };

  // Copy Master Vision Prompt
  const handleCopyVisionPrompt = async () => {
    const promptText = generateHardCopyExamVisionPrompt({
      universityOrGrade: tier === 'university' ? university : 'Secondary National Grade 12',
      subject,
      examType,
      examYear,
      includeDiagrams: detectQuestionImages,
      includeChoiceImages: detectOptionImages,
      includeTables: detectTables,
    });

    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setStatusMsg({ type: 'success', text: 'Master Vision Prompt copied to clipboard! Paste into ChatGPT-4o, Claude, or Gemini.' });
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      setStatusMsg({ type: 'error', text: 'Clipboard copy failed. Please select and copy manually.' });
    }
  };

  // Publish to Supabase
  const handlePublishToSupabase = async () => {
    if (!examName.trim()) {
      setStatusMsg({ type: 'error', text: 'Please specify an Exam Title.' });
      return;
    }

    if (questions.length === 0) {
      setStatusMsg({ type: 'error', text: 'Exam must contain at least one question.' });
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        setStatusMsg({ type: 'error', text: `Question ${i + 1} text cannot be empty.` });
        setActiveQuestionIndex(i);
        setActiveTab('editor');
        return;
      }
      for (let j = 0; j < questions[i].options.length; j++) {
        if (!questions[i].options[j]?.trim()) {
          setStatusMsg({ type: 'error', text: `Question ${i + 1} Option ${String.fromCharCode(65 + j)} cannot be empty.` });
          setActiveQuestionIndex(i);
          setActiveTab('editor');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    const examData: Exam = {
      id: `official_${tier}_${Date.now()}`,
      title: examName.trim(),
      name: examName.trim(),
      subject,
      topic: `${subject} Official Exam`,
      grade: tier === 'university' ? 'Freshman' : '12',
      tier,
      university: tier === 'university' ? university : undefined,
      department: tier === 'university' ? department : undefined,
      academicYear: tier === 'university' ? academicYear : undefined,
      semester,
      examType,
      examYear,
      timeLimit: Number(timeLimit) || 60,
      description: description.trim(),
      questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'official',
      sourceType: 'official',
      storageSource: 'supabase',
      hasImages: questions.some((q) => Boolean(q.imageUrl) || Boolean(q.optionImages?.some(Boolean))),
      hasTables: questions.some((q) => Boolean(q.tableMarkdown)),
    };

    try {
      await saveOfficialExamToSupabase(examData);
      
      // Also commit to local repository so it is ready immediately in app
      addDownloadedExamsToRepository([examData]);

      if (onExamPublished) {
        onExamPublished(examData);
      }

      setStatusMsg({
        type: 'success',
        text: `Official Exam "${examData.title}" published successfully to Supabase and added to local repository!`,
      });

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setStatusMsg({ type: 'error', text: `Failed to publish: ${msg}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[activeQuestionIndex];

  // Dynamic Diagram Detection for Active Question
  const detectedTagMatch = currentQ?.text?.match(/\[(?:IMAGE|DIAGRAM|FIGURE|IMAGE_Q(?:_\d+)?)(?::\s*([^\]]+))?\]/i);
  const detectedLabel = currentQ?.imageCaption || (detectedTagMatch ? detectedTagMatch[1]?.trim() : '');
  const hasDetectedImageTag = Boolean(detectedLabel || detectedTagMatch || currentQ?.imageUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Hidden File Input for Supabase Media Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileSelected}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      <div className="relative w-full max-w-5xl rounded-[32px] bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/70 dark:bg-[#070e1a]/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  Admin Official Exam Studio
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Supabase Cloud
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                [IMAGE: label] auto-detection, pre-upload LaTeX preview &amp; vision prompt generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Supabase Connection Pill */}
            {supabaseConfig ? (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Database className="w-3.5 h-3.5" />
                <span>Supabase Ready</span>
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Local Storage Fallback</span>
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Main Workflow Tabs: Paste, Editor, Pre-Publish Preview, Hard-Copy Prompt */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-100 dark:border-white/10 bg-white dark:bg-[#0c182b] flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-white dark:bg-[#162744] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Paste AI Text</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white dark:bg-[#162744] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span>Questions Editor ({questions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-[#162744] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pre-Publish Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prompt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'prompt'
                  ? 'bg-white dark:bg-[#162744] text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5 text-emerald-500" />
              <span>Hard-Copy AI Prompt</span>
            </button>
          </div>

          {/* Quick Publish CTA button in top bar if on Editor or Preview */}
          {(activeTab === 'editor' || activeTab === 'preview') && (
            <button
              type="button"
              onClick={handlePublishToSupabase}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Publish to Supabase</span>
            </button>
          )}
        </div>

        {/* Studio Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Status Message Notification */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{statusMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMsg(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: PASTE AI EXAM TEXT & 3 MEDIA TOGGLES */}
          {activeTab === 'paste' && (
            <div className="space-y-5">
              {/* Top 3 Media Feature Toggles */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Media &amp; Structure Detection Toggles</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLoadSampleText}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Sample Exam with Diagrams &amp; Tables</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Toggle 1: Question Images */}
                  <button
                    type="button"
                    onClick={() => setDetectQuestionImages(!detectQuestionImages)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      detectQuestionImages
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 shadow-2xs'
                        : 'bg-white dark:bg-[#0c182b] border-zinc-200 dark:border-white/10 text-zinc-500'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">1. Question Diagrams</span>
                      </div>
                      <p className="text-[11px] opacity-80">Checks for [IMAGE: label] tokens</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        detectQuestionImages
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {detectQuestionImages && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Toggle 2: Choice Images */}
                  <button
                    type="button"
                    onClick={() => setDetectOptionImages(!detectOptionImages)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      detectOptionImages
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 shadow-2xs'
                        : 'bg-white dark:bg-[#0c182b] border-zinc-200 dark:border-white/10 text-zinc-500'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">2. Choice Images (A-D)</span>
                      </div>
                      <p className="text-[11px] opacity-80">Checks choice diagrams / graphs</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        detectOptionImages
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {detectOptionImages && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Toggle 3: Tables */}
                  <button
                    type="button"
                    onClick={() => setDetectTables(!detectTables)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      detectTables
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 shadow-2xs'
                        : 'bg-white dark:bg-[#0c182b] border-zinc-200 dark:border-white/10 text-zinc-500'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <TableIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">3. Markdown Tables</span>
                      </div>
                      <p className="text-[11px] opacity-80">Renders experimental data grids</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        detectTables
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {detectTables && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Paste Raw AI-Generated Exam Text (ChatGPT, Claude, DeepSeek, Gemini)
                  </label>
                  <span className="text-zinc-400">KaTeX Math &amp; [IMAGE: label] Auto-Detection</span>
                </div>
                <textarea
                  rows={12}
                  value={pastedRawText}
                  onChange={(e) => setPastedRawText(e.target.value)}
                  placeholder={`1. Question prompt with LaTeX \\( x^2 \\)...\n[IMAGE: Figure caption or circuit diagram]\nA) Choice A\nB) Choice B\nC) Choice C\nD) Choice D\nAnswer: B\nExplanation: Step by step solution...\n\n2. Next question...`}
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setPastedRawText('')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                >
                  Clear Text
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('prompt')}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#0f1d33] text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Generate AI Prompt for Scanned Paper</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleParseRawText}
                    disabled={isParsing || !pastedRawText.trim()}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Extract &amp; Arrange Questions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUESTIONS EDITOR WITH DYNAMIC [IMAGE: label] UPLOADER */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* Classification & Metadata Card */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Official Exam Classification
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTier('university')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        tier === 'university'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                          : 'bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      University Tier
                    </button>
                    <button
                      type="button"
                      onClick={() => setTier('secondary')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                        tier === 'secondary'
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                          : 'bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      Secondary Tier
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {tier === 'university' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">University</label>
                        <select
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                        >
                          {ETHIOPIAN_UNIVERSITIES.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Subject / Course</label>
                        <select
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                        >
                          {FRESHMAN_SUBJECTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Grade Level</label>
                        <select
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                        >
                          <option value="Grade 12">Grade 12 (National Matriculation)</option>
                          <option value="Grade 11">Grade 11</option>
                          <option value="Grade 10">Grade 10</option>
                          <option value="Grade 9">Grade 9</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Secondary Subject</label>
                        <select
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                        >
                          {SECONDARY_SUBJECTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Semester &amp; Type</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value as any)}
                        className="w-full px-2 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                      >
                        <option value="Semester 1">Sem 1</option>
                        <option value="Semester 2">Sem 2</option>
                      </select>
                      <select
                        value={examType}
                        onChange={(e) => setExamType(e.target.value as any)}
                        className="w-full px-2 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                      >
                        <option value="Final">Final</option>
                        <option value="Mid">Mid</option>
                        <option value="Make-up">Make-up</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Exam Year (E.C.)</label>
                    <select
                      value={examYear}
                      onChange={(e) => setExamYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
                    >
                      {ETHIOPIAN_EXAM_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Exam Title</label>
                    <input
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="e.g. AAU General Physics (Phys 1011) Final Exam 2016"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Duration (Minutes)</label>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value, 10) || 60)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Question Navigator Bar */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Questions ({questions.length})
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Question {activeQuestionIndex + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('paste')}
                      className="px-3 py-1.5 rounded-xl bg-zinc-200/60 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Paste More</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Pre-Publish Preview</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>

                {/* Horizontal Question Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {questions.map((q, idx) => {
                    const hasDiag = !!q.imageUrl;
                    const hasChoiceImg = q.optionImages?.some(Boolean);
                    const hasTbl = !!q.tableMarkdown;

                    return (
                      <button
                        key={q.id || idx}
                        type="button"
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 ${
                          activeQuestionIndex === idx
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-[#0c182b] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                        }`}
                      >
                        <span>{idx + 1}</span>
                        {(hasDiag || hasChoiceImg) && (
                          <span className={`w-1.5 h-1.5 rounded-full ${activeQuestionIndex === idx ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                        {hasTbl && (
                          <span className={`w-1.5 h-1.5 rounded-full ${activeQuestionIndex === idx ? 'bg-amber-300' : 'bg-amber-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE QUESTION EDITOR */}
              {currentQ && (
                <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-5">
                  {/* Question Header & Delete */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>Question {activeQuestionIndex + 1} Editor</span>
                      <span className="text-zinc-400">· KaTeX LaTeX math supported: \( x^2 \) or \[ \frac{'{a}{b}'} \]</span>
                    </span>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                        className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Question</span>
                      </button>
                    )}
                  </div>

                  {/* Question Prompt */}
                  <div className="space-y-1.5">
                    <textarea
                      rows={3}
                      value={currentQ.text}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[activeQuestionIndex].text = e.target.value;
                        setQuestions(updated);
                      }}
                      placeholder="Enter question text or math formulas e.g. What is the value of \( \int_0^1 x^2 dx \)?"
                      className="w-full p-3.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {currentQ.text.includes('\\(') && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                          KaTeX Live Math Preview
                        </span>
                        <MathRenderer text={currentQ.text} />
                      </div>
                    )}
                  </div>

                  {/* DYNAMIC [IMAGE: label] DIAGRAM UPLOADER / PREVIEW */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">Question Diagram / Figure</span>
                      </div>
                      {currentQ.imageUrl && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ url: currentQ.imageUrl!, caption: currentQ.imageCaption, title: `Question ${activeQuestionIndex + 1} Diagram` })}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Preview Lightbox</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...questions];
                              updated[activeQuestionIndex].imageUrl = undefined;
                              updated[activeQuestionIndex].imageCaption = undefined;
                              setQuestions(updated);
                            }}
                            className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                          >
                            Remove Diagram
                          </button>
                        </div>
                      )}
                    </div>

                    {currentQ.imageUrl ? (
                      /* 1. Image has been uploaded */
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#070e1a] shrink-0">
                          <img
                            src={currentQ.imageUrl}
                            alt="Question Diagram"
                            className="w-44 h-32 object-contain"
                          />
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                            Figure Caption (renders below image in student tests)
                          </label>
                          <input
                            type="text"
                            value={currentQ.imageCaption || ''}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[activeQuestionIndex].imageCaption = e.target.value;
                              setQuestions(updated);
                            }}
                            placeholder="e.g. Figure 1: Circuit bridge resistor network"
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs"
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => triggerImageUpload(activeQuestionIndex)}
                              disabled={uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === undefined}
                              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === undefined ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              <span>Replace Image in Supabase</span>
                            </button>
                            <span className="text-[11px] text-zinc-400">Hosted in "exam-media" bucket</span>
                          </div>
                        </div>
                      </div>
                    ) : hasDetectedImageTag ? (
                      /* 2. Detected [IMAGE: label] tag in question */
                      <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              Detected Diagram: "{detectedLabel || `Figure ${activeQuestionIndex + 1}`}"
                            </span>
                          </div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            [IMAGE] Tag Detected
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          This question was flagged with a diagram placeholder. Click below to select the image file from your device and host it on Supabase Storage.
                        </p>
                        <button
                          type="button"
                          onClick={() => triggerImageUpload(activeQuestionIndex)}
                          disabled={uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === undefined}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer transition disabled:opacity-50"
                        >
                          {uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === undefined ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>Upload Diagram {detectedLabel ? `("${detectedLabel}")` : ''}</span>
                        </button>
                      </div>
                    ) : (
                      /* 3. No image detected: Hide bulky box, show subtle Add button */
                      <div className="flex items-center justify-between text-xs py-1">
                        <span className="text-zinc-400 text-[11px]">No diagram marker detected</span>
                        <button
                          type="button"
                          onClick={() => triggerImageUpload(activeQuestionIndex)}
                          className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Attach Diagram</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CHOICES (A, B, C, D) WITH INLINE CHOICE IMAGE UPLOADERS */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Choices (Select the Radio for Correct Answer)</span>
                      <span className="text-zinc-400">Inline diagram upload supported for each choice</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentQ.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = currentQ.correct === optIdx;
                        const choiceImg = currentQ.optionImages?.[optIdx];

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border transition space-y-2 ${
                              isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                                : 'bg-white dark:bg-[#0c182b] border-zinc-200 dark:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct_radio_${activeQuestionIndex}`}
                                checked={isCorrect}
                                onChange={() => {
                                  const updated = [...questions];
                                  updated[activeQuestionIndex].correct = optIdx;
                                  setQuestions(updated);
                                }}
                                className="w-4 h-4 text-emerald-600 cursor-pointer accent-emerald-600 shrink-0"
                              />
                              <span className="text-xs font-extrabold w-4 text-zinc-600 dark:text-zinc-400">
                                {letter}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...questions];
                                  updated[activeQuestionIndex].options[optIdx] = e.target.value;
                                  setQuestions(updated);
                                }}
                                placeholder={`Choice ${letter} text or math...`}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs font-medium"
                              />
                            </div>

                            {/* Inline Choice Image Section */}
                            {choiceImg ? (
                              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={choiceImg}
                                    alt={`Choice ${letter}`}
                                    className="w-10 h-10 object-contain rounded bg-white dark:bg-[#0c182b]"
                                  />
                                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                    Choice {letter} Diagram
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => triggerImageUpload(activeQuestionIndex, optIdx)}
                                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                  >
                                    Replace
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...questions];
                                      if (updated[activeQuestionIndex].optionImages) {
                                        updated[activeQuestionIndex].optionImages![optIdx] = null;
                                        setQuestions(updated);
                                      }
                                    }}
                                    className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              (detectOptionImages || currentQ.optionImages?.some(Boolean)) && (
                                <button
                                  type="button"
                                  onClick={() => triggerImageUpload(activeQuestionIndex, optIdx)}
                                  disabled={uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === optIdx}
                                  className="w-full py-1 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-[11px] font-semibold text-zinc-500 hover:text-emerald-600 transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  {uploadingImageTarget?.qIdx === activeQuestionIndex && uploadingImageTarget?.optIdx === optIdx ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ImageIcon className="w-3 h-3 text-emerald-500" />
                                  )}
                                  <span>Attach Choice {letter} Image</span>
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MARKDOWN TABLE (IF PRESENT OR TOGGLED) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <TableIcon className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Question Table (Markdown)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...questions];
                          if (updated[activeQuestionIndex].tableMarkdown) {
                            updated[activeQuestionIndex].tableMarkdown = undefined;
                          } else {
                            updated[activeQuestionIndex].tableMarkdown = `| Parameter | Symbol | Value |\n| :--- | :--- | :--- |\n| Resistance | \\(R_1\\) | \\(10\\,\\Omega\\) |`;
                          }
                          setQuestions(updated);
                        }}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {currentQ.tableMarkdown ? 'Remove Table' : '+ Insert Table'}
                      </button>
                    </div>

                    {currentQ.tableMarkdown && (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={currentQ.tableMarkdown}
                          onChange={(e) => {
                            const updated = [...questions];
                            updated[activeQuestionIndex].tableMarkdown = e.target.value;
                            setQuestions(updated);
                          }}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-mono"
                        />
                        <div className="p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10">
                          <span className="text-[10px] font-extrabold uppercase text-zinc-400 block mb-1">Live Table Preview</span>
                          <MarkdownTableRenderer markdown={currentQ.tableMarkdown} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* EXPLANATION */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Solution &amp; Explanation (Shown to students after exam review)
                    </label>
                    <textarea
                      rows={2}
                      value={currentQ.explanation || ''}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[activeQuestionIndex].explanation = e.target.value;
                        setQuestions(updated);
                      }}
                      placeholder="Explain how the correct answer is derived using formulas..."
                      className="w-full p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-zinc-500">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{questions.length} Questions</span> ready ·{' '}
                  <span>{questions.filter((q) => q.imageUrl).length} diagrams</span> ·{' '}
                  <span>{questions.filter((q) => q.tableMarkdown).length} tables</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="px-4 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Go to Pre-Publish Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePublishToSupabase}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Publish Official Exam to Supabase</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRE-PUBLISH PREVIEW (FULL LATEX, TABLES & MEDIA AUDIT) */}
          {activeTab === 'preview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Pre-Flight Checklist Banner */}
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                        Pre-Publish Verification &amp; LaTeX Audit
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Review rendered KaTeX formulas, tables, and hosted diagrams before saving to Supabase
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePublishToSupabase}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Confirm &amp; Publish Official Exam</span>
                  </button>
                </div>

                {/* Audit Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-zinc-900 dark:text-white">{questions.length} Questions</span>
                      <span className="text-[11px] text-zinc-400">Total item count</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-zinc-900 dark:text-white">KaTeX Engine Active</span>
                      <span className="text-[11px] text-zinc-400">Formulas rendered</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-zinc-900 dark:text-white">
                        {questions.filter((q) => q.imageUrl).length} Hosted Diagrams
                      </span>
                      <span className="text-[11px] text-zinc-400">Supabase Storage</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-zinc-900 dark:text-white">
                        {questions.filter((q) => q.tableMarkdown).length} Data Tables
                      </span>
                      <span className="text-[11px] text-zinc-400">Markdown formatted</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendered Questions List (Exactly as students will see) */}
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-5 rounded-2xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-4 shadow-2xs"
                  >
                    {/* Question Header & Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-[#070e1a] text-zinc-800 dark:text-zinc-200">
                          Question {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuestionIndex(idx);
                            setActiveTab('editor');
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Edit</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                        <MathRenderer text={q.text} />
                      </div>
                    </div>

                    {/* Question Diagram Preview if present */}
                    {q.imageUrl && (
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center space-y-2">
                        <img
                          src={q.imageUrl}
                          alt={q.imageCaption || `Question ${idx + 1} Diagram`}
                          className="max-h-48 object-contain rounded-lg cursor-zoom-in"
                          onClick={() => setLightboxImage({ url: q.imageUrl!, caption: q.imageCaption, title: `Question ${idx + 1} Diagram` })}
                        />
                        {q.imageCaption && (
                          <p className="text-[11px] text-zinc-500 font-medium italic">
                            {q.imageCaption}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Markdown Table if present */}
                    {q.tableMarkdown && (
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10">
                        <MarkdownTableRenderer markdown={q.tableMarkdown} />
                      </div>
                    )}

                    {/* Choices (A, B, C, D) with Correct Answer Marked */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = q.correct === optIdx;
                        const choiceImg = q.optionImages?.[optIdx];

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                              isCorrect
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 font-semibold shadow-2xs'
                                : 'bg-zinc-50/70 dark:bg-[#070e1a]/70 border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {letter}
                            </span>
                            <div className="flex-1 space-y-1">
                              <MathRenderer text={opt} inline />
                              {choiceImg && (
                                <img
                                  src={choiceImg}
                                  alt={`Choice ${letter}`}
                                  className="max-h-20 object-contain rounded border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c182b] p-1 mt-1"
                                />
                              )}
                            </div>
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation if present */}
                    {q.explanation && (
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/10 text-xs space-y-1">
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 block text-[10px] uppercase">
                          Solution Explanation:
                        </span>
                        <div className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          <MathRenderer text={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Navigation & Confirm Button */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Editor</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublishToSupabase}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Confirm &amp; Publish Official Exam to Supabase</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: HARD-COPY PAST EXAM AI VISION PROMPT GENERATOR */}
          {activeTab === 'prompt' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Hard-Copy Past Exam AI Vision Prompt Generator</span>
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Generates a tailored master prompt to transcribe physical paper exams or PDFs with diagrams into Sinahard
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyVisionPrompt}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy Master Prompt'}</span>
                  </button>
                </div>

                {/* 3 Step Guide */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-1">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Step 1: Copy Prompt</span>
                    <p className="text-zinc-500">Copy the prompt below and open ChatGPT-4o, Claude 3.5 Sonnet, or Gemini.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-1">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Step 2: Attach Photos</span>
                    <p className="text-zinc-500">Upload phone photos or scans of your Ethiopian past exam papers.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-1">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Step 3: Paste in Studio</span>
                    <p className="text-zinc-500">Copy the AI's output, paste it into the "Paste AI Text" tab, and click Extract!</p>
                  </div>
                </div>

                {/* Generated Prompt Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">
                      Generated Master Vision Prompt
                    </label>
                    <span className="text-zinc-400">Includes placeholder tokens for [IMAGE: ...] and tables</span>
                  </div>
                  <textarea
                    rows={12}
                    readOnly
                    value={generateHardCopyExamVisionPrompt({
                      universityOrGrade: tier === 'university' ? university : 'Secondary National Grade 12',
                      subject,
                      examType,
                      examYear,
                      includeDiagrams: detectQuestionImages,
                      includeChoiceImages: detectOptionImages,
                      includeTables: detectTables,
                    })}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Media Lightbox */}
      {lightboxImage && (
        <MediaLightboxModal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          mediaUrl={lightboxImage.url}
          caption={lightboxImage.caption}
          title={lightboxImage.title}
        />
      )}
    </div>
  );
};
