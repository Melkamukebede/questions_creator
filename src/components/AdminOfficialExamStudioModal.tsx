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
import { MarkdownTableRenderer } from './MarkdownTableRenderer';
import { MathRenderer } from './MathRenderer';
import { MediaLightboxModal } from './MediaLightboxModal';
import { addDownloadedExamsToRepository } from '../services/db';

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
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string; title?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle direct diagram image upload
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, questionIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImageIndex(questionIndex);
    setStatusMsg(null);

    try {
      const cleanSubject = subject.split(' ')[0] || 'stem';
      const uploadResult = await uploadExamMedia(file, `diagram_${cleanSubject}_q${questionIndex + 1}`);

      const updated = [...questions];
      updated[questionIndex] = {
        ...updated[questionIndex],
        imageUrl: uploadResult.url,
        imageCaption: updated[questionIndex].imageCaption || `Figure ${questionIndex + 1}: ${file.name.replace(/\.[^/.]+$/, '')}`,
      };
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
      setUploadingImageIndex(null);
      e.target.value = '';
    }
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

  // Insert Table Template Helper
  const handleInsertTablePreset = (qIdx: number, type: 'physics' | 'math' | 'chemistry') => {
    let presetTable = '';
    if (type === 'physics') {
      presetTable = `| Parameter | Symbol | Value | Unit |\n| :--- | :--- | :--- | :--- |\n| Mass | \\(m\\) | \\(2.5\\) | \\(\\text{kg}\\) |\n| Initial Velocity | \\(v_0\\) | \\(10\\) | \\(\\text{m/s}\\) |\n| Friction Coefficient | \\(\\mu_k\\) | \\(0.20\\) | dimensionless |`;
    } else if (type === 'math') {
      presetTable = `| Interval | \\(x < -2\\) | \\(-2 < x < 3\\) | \\(x > 3\\) |\n| :--- | :--- | :--- | :--- |\n| \\(f'(x)\\) | \\(+\\) (increasing) | \\(-\\) (decreasing) | \\(+\\) (increasing) |\n| \\(f''(x)\\) | \\(-\\) (concave down) | \\(-\\) (concave down) | \\(+\\) (concave up) |`;
    } else {
      presetTable = `| Compound | Molecular Formula | Molar Mass (\\(\\text{g/mol}\\)) |\n| :--- | :--- | :--- |\n| Glucose | \\(\\text{C}_6\\text{H}_{12}\\text{O}_6\\) | \\(180.16\\) |\n| Sulfuric Acid | \\(\\text{H}_2\\text{SO}_4\\) | \\(98.08\\) |`;
    }

    const updated = [...questions];
    updated[qIdx].tableMarkdown = presetTable;
    setQuestions(updated);
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
        return;
      }
      for (let j = 0; j < questions[i].options.length; j++) {
        if (!questions[i].options[j]?.trim()) {
          setStatusMsg({ type: 'error', text: `Question ${i + 1} Option ${String.fromCharCode(65 + j)} cannot be empty.` });
          setActiveQuestionIndex(i);
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
      hasImages: questions.some((q) => Boolean(q.imageUrl)),
      hasTables: questions.some((q) => Boolean(q.tableMarkdown)),
    };

    try {
      const result = await saveOfficialExamToSupabase(examData);
      
      // Also commit to local repository so it is ready immediately in app
      addDownloadedExamsToRepository([examData]);

      if (onExamPublished) {
        onExamPublished(examData);
      }

      setStatusMsg({
        type: 'success',
        text: `Official Exam "${examData.title}" published successfully to Supabase and added to the local repository!`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-5xl rounded-[32px] bg-white dark:bg-[#0c182b] text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/70 dark:bg-[#070e1a]/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Outfit',sans-serif] text-zinc-950 dark:text-white">
                  Admin Official Exam &amp; Media Studio
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Supabase Cloud
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Author and publish verified university &amp; secondary matriculation exams with hosted diagrams
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#0f1d33] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Studio Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Metadata Section */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-200/80 dark:border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                1. Official Exam Classification
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
                      <option value="12">Grade 12 (Matriculation)</option>
                      <option value="11">Grade 11</option>
                      <option value="10">Grade 10</option>
                      <option value="9">Grade 9</option>
                      <option value="8">Grade 8</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Subject</label>
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
                <div className="grid grid-cols-2 gap-2">
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

          {/* Question Editor Section */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  2. Questions &amp; Media ({questions.length})
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Question {activeQuestionIndex + 1}
                </span>
              </div>

              <div className="flex items-center gap-2">
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

            {/* Question Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {questions.map((q, idx) => (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0 ${
                    activeQuestionIndex === idx
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-[#0c182b] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Active Question Fields */}
            {currentQ && (
              <div className="space-y-4 pt-1">
                {/* Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>{"Question Prompt (KaTeX LaTeX supported: \\( x^2 \\) or \\[ \\frac{a}{b} \\])"}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                        className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Question</span>
                      </button>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={currentQ.text}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[activeQuestionIndex].text = e.target.value;
                      setQuestions(updated);
                    }}
                    placeholder="Enter question statement with math notation..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-medium"
                  />
                  {currentQ.text && (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200/80 dark:border-white/5 text-xs">
                      <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Live Math Preview:</span>
                      <MathRenderer content={currentQ.text} />
                    </div>
                  )}
                </div>

                {/* Direct Diagram Image Upload Area */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Question Diagram / Circuit Schematic
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => handleImageFileSelected(e, activeQuestionIndex)}
                      />
                      <button
                        type="button"
                        disabled={uploadingImageIndex === activeQuestionIndex}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer hover:bg-emerald-500/25"
                      >
                        {uploadingImageIndex === activeQuestionIndex ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading to Supabase...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Diagram Image</span>
                          </>
                        )}
                      </button>

                      {currentQ.imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...questions];
                            updated[activeQuestionIndex].imageUrl = undefined;
                            updated[activeQuestionIndex].imageCaption = undefined;
                            setQuestions(updated);
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-red-500 hover:bg-red-500/10 text-xs font-bold transition cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {currentQ.imageUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200/80 dark:border-white/5">
                      <img
                        src={currentQ.imageUrl}
                        alt={currentQ.imageCaption || 'Question Diagram'}
                        className="max-h-24 w-auto rounded-lg object-contain border border-zinc-200 dark:border-white/10"
                      />
                      <div className="flex-1 space-y-1 w-full">
                        <label className="text-[10px] font-bold text-zinc-400">Diagram Caption:</label>
                        <input
                          type="text"
                          value={currentQ.imageCaption || ''}
                          onChange={(e) => {
                            const updated = [...questions];
                            updated[activeQuestionIndex].imageCaption = e.target.value;
                            setQuestions(updated);
                          }}
                          placeholder="e.g. Figure 1.1: Circuit schematic"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxImage({ url: currentQ.imageUrl!, caption: currentQ.imageCaption, title: `Question ${activeQuestionIndex + 1} Diagram` })}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 pt-0.5"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Preview Full Screen</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                      No diagram attached. Uploading directly hosts the image in your Supabase <strong>'exam-media'</strong> bucket.
                    </p>
                  )}
                </div>

                {/* Structured Markdown Table Area */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-sky-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Markdown Data Table (Optional)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Presets:</span>
                      <button
                        type="button"
                        onClick={() => handleInsertTablePreset(activeQuestionIndex, 'physics')}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold cursor-pointer"
                      >
                        Physics
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTablePreset(activeQuestionIndex, 'math')}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold cursor-pointer"
                      >
                        Math Signs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTablePreset(activeQuestionIndex, 'chemistry')}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-[#0f1d33] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold cursor-pointer"
                      >
                        Chemistry
                      </button>
                      {currentQ.tableMarkdown && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...questions];
                            updated[activeQuestionIndex].tableMarkdown = undefined;
                            setQuestions(updated);
                          }}
                          className="px-2 py-0.5 rounded-md text-red-500 hover:bg-red-500/10 text-[10px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={currentQ.tableMarkdown || ''}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[activeQuestionIndex].tableMarkdown = e.target.value;
                      setQuestions(updated);
                    }}
                    placeholder="| Parameter | Value |\n| :--- | :--- |\n| Force (F) | 50 N |"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#070e1a] border border-zinc-200 dark:border-white/10 text-xs font-mono"
                  />

                  {currentQ.tableMarkdown && (
                    <div className="pt-1">
                      <MarkdownTableRenderer markdown={currentQ.tableMarkdown} />
                    </div>
                  )}
                </div>

                {/* 4 Choices */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Choices (Select the radio button for the correct answer)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQ.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrect = currentQ.correct === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500 text-zinc-950 dark:text-white'
                              : 'bg-white dark:bg-[#0c182b] border-zinc-200 dark:border-white/10'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct_radio_${activeQuestionIndex}`}
                            checked={isCorrect}
                            onChange={() => {
                              const updated = [...questions];
                              updated[activeQuestionIndex].correct = optIdx;
                              setQuestions(updated);
                            }}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="font-bold text-xs w-4">{letter})</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[activeQuestionIndex].options[optIdx] = e.target.value;
                              setQuestions(updated);
                            }}
                            placeholder={`Option ${letter}`}
                            className="flex-1 bg-transparent text-xs font-medium focus:outline-hidden"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Step-by-Step Derivation &amp; Solution
                  </label>
                  <textarea
                    rows={2}
                    value={currentQ.explanation || ''}
                    onChange={(e) => {
                      const updated = [...questions];
                      updated[activeQuestionIndex].explanation = e.target.value;
                      setQuestions(updated);
                    }}
                    placeholder="Explain why the answer is correct and list step-by-step calculations..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c182b] border border-zinc-200 dark:border-white/10 text-xs font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status Alert */}
          {statusMsg && (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-800 dark:text-red-200 border-red-500/30'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/10 flex items-center justify-between gap-3 bg-zinc-50/70 dark:bg-[#070e1a]/70 shrink-0">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>{questions.length} Question{questions.length === 1 ? '' : 's'} &bull; </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {questions.filter((q) => Boolean(q.imageUrl)).length} with Diagrams
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePublishToSupabase}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing to Supabase...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Publish Official Exam to Supabase</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for preview */}
      <MediaLightboxModal
        isOpen={Boolean(lightboxImage)}
        imageUrl={lightboxImage?.url || ''}
        caption={lightboxImage?.caption}
        title={lightboxImage?.title}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
};
