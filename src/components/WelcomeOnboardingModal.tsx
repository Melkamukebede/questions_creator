import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  ArrowRight,
  ChevronLeft,
  UserPlus,
  LogIn,
  X,
  Award,
  Download,
  Compass,
  Layers,
} from 'lucide-react';
import { SinahardLogo } from './SinahardLogo';
import { AppCoin } from './AppCoin';
import { useAuth } from '../context/AuthContext';

export const ONBOARDING_STORAGE_KEY = 'sinahard_onboarding_completed_v1';
export const FOLLOWUP_BANNER_DISMISSED_KEY = 'sinahard_followup_banner_dismissed_v1';

const CLASS_LEVEL_CHOICES = [
  {
    id: '12',
    title: 'Grade 12 (Matric / EUEE)',
    subtitle: 'National entrance & preparatory exams',
    badge: 'Secondary',
  },
  {
    id: '11',
    title: 'Grade 11 (Preparatory)',
    subtitle: 'Natural & Social Science core curriculum',
    badge: 'Secondary',
  },
  {
    id: '10',
    title: 'Grade 10 (Secondary)',
    subtitle: 'Core high school subject mastery',
    badge: 'Secondary',
  },
  {
    id: '9',
    title: 'Grade 9 (Secondary)',
    subtitle: 'Foundation secondary curriculum',
    badge: 'Secondary',
  },
  {
    id: 'Freshman',
    title: 'University Freshman',
    subtitle: '1st Year common courses (AAU, ASTU, Jimma, Hawassa)',
    badge: 'University',
  },
  {
    id: 'Senior University',
    title: 'Senior University (2nd–5th Yr)',
    subtitle: 'Departmental & exit exam preparation',
    badge: 'University',
  },
];

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRegistration: (preferredGrade?: string, mode?: 'signup' | 'signin') => void;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartRegistration,
}) => {
  const { user, updateStudentProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGrade, setSelectedGrade] = useState<string>(user?.grade || '12');
  const [selectedStream, setSelectedStream] = useState<string>(user?.stream || 'Natural Science');

  if (!isOpen) return null;

  const markOnboardingDone = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  };

  const applyPreferredClassLocally = async () => {
    try {
      await updateStudentProfile({
        displayName: user?.displayName || 'Guest Student',
        role: 'student',
        grade: selectedGrade,
        stream: selectedStream,
      });
    } catch {
      // ignore
    }
  };

  const handleContinueAsGuest = async () => {
    markOnboardingDone();
    await applyPreferredClassLocally();
    onClose();
  };

  const handleOpenRegister = async (mode: 'signup' | 'signin') => {
    markOnboardingDone();
    await applyPreferredClassLocally();
    onClose();
    onStartRegistration(selectedGrade, mode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-xl rounded-[28px] sm:rounded-[32px] liquid-glass border border-white/75 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 pt-5 pb-3.5 flex items-center justify-between border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
              <SinahardLogo size="sm" idSuffix="welcome-tour" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
                Welcome Tour · Step {step} of 3
              </span>
              <h2 className="text-sm sm:text-base font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
                {step === 1
                  ? 'Welcome to SinaHard Workspace'
                  : step === 2
                  ? 'Smart Class Filtering & AI Studio'
                  : 'Choose Your Class & Account Setup'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueAsGuest}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition cursor-pointer"
            title="Skip introduction"
            aria-label="Close welcome tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Strip */}
        <div className="px-5 sm:px-6 pt-3 flex items-center gap-2">
          {[1, 2, 3].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx as 1 | 2 | 3)}
              className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                step >= idx
                  ? 'bg-slate-900 dark:bg-white'
                  : 'bg-slate-200/80 dark:bg-white/10'
              }`}
              aria-label={`Go to step ${idx}`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Active Exam Mastery — Online &amp; 100% Offline</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white leading-snug">
                  Bridge the Gap from Passive Reading to Active Practice
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  SinaHard turns Ethiopian Secondary (Grades 9–12) and University (Freshman &amp; Senior) exam archives into an interactive practice studio with crisp math formulas and diagrams.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Instant Choice Feedback
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Click any option to see immediate green/red feedback and unlock step-by-step explanations.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    One-Click Offline Packs
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Save official matriculation and university exams once to practice anytime without internet.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Unified Top Navigation
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Switch between Home, Exams, Create, and Activity from the floating top bar on both PC and phone.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <GraduationCap className="w-4 h-4" />
                  <span>Personalized Class Workspace</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white leading-snug">
                  Focused Only on Your Registered Class Level
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Once you register your student profile, SinaHard automatically filters your Home, Exams Library, and Download Center so you only see exams for your class level — with zero distraction from other grades.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Class-Scoped Exam Library</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Whether you are in Grade 9–12, University Freshman, or Senior University, your repository stays tailored to your curriculum.
                  </p>
                </div>

                <div className="p-4 rounded-2xl liquid-glass-subtle space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>AI Exam &amp; LaTeX Prompt Studio</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Generate custom practice questions with properly formatted LaTeX equations, matrices, and step-by-step solutions in seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Select Your Class / Academic Level</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  We will pre-set your workspace and registration profile to match your class.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CLASS_LEVEL_CHOICES.map((item) => {
                  const isSelected = selectedGrade === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedGrade(item.id)}
                      className={`p-3 rounded-2xl text-left transition cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm font-bold'
                          : 'liquid-glass-subtle text-slate-800 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{item.title}</div>
                        <div
                          className={`text-[10px] truncate mt-0.5 ${
                            isSelected
                              ? 'text-slate-200 dark:text-zinc-600'
                              : 'text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                          isSelected
                            ? 'bg-white/20 dark:bg-zinc-900/15 text-white dark:text-zinc-900'
                            : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Stream selector for Secondary / Freshman */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                  Stream:
                </span>
                {['Natural Science', 'Social Science', 'General'].map((streamOpt) => (
                  <button
                    key={streamOpt}
                    type="button"
                    onClick={() => setSelectedStream(streamOpt)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      selectedStream === streamOpt
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'liquid-glass-subtle text-slate-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-white/10'
                    }`}
                  >
                    {streamOpt}
                  </button>
                ))}
              </div>

              {/* Registration Benefit Callout */}
              <div className="p-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AppCoin size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Register Free &amp; Claim +1 Bonus Coin
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Locks your exams to {selectedGrade === 'Freshman' || selectedGrade === 'Senior University' ? selectedGrade : `Grade ${selectedGrade}`} and syncs your scores across devices.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5 bg-white/40 dark:bg-white/[0.02]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              className="px-3.5 py-2 rounded-full liquid-glass-btn text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Skip for now
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleContinueAsGuest}
                className="px-3.5 py-2 rounded-full liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                Continue as Guest
              </button>
              <button
                type="button"
                onClick={() => handleOpenRegister('signin')}
                className="px-3.5 py-2 rounded-full liquid-glass-btn text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenRegister('signup')}
                className="px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Class Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PostPracticeFollowUpModalProps {
  isOpen: boolean;
  scorePercentage: number;
  examName: string;
  preferredGrade?: string;
  onClose: () => void;
  onRegisterNow: () => void;
  onSignIn: () => void;
}

export const PostPracticeFollowUpModal: React.FC<PostPracticeFollowUpModalProps> = ({
  isOpen,
  scorePercentage,
  examName,
  preferredGrade,
  onClose,
  onRegisterNow,
  onSignIn,
}) => {
  if (!isOpen) return null;

  const gradeText =
    preferredGrade === 'Freshman' || preferredGrade === 'Senior University'
      ? preferredGrade
      : preferredGrade
      ? `Grade ${preferredGrade}`
      : 'your class level';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md rounded-[28px] liquid-glass border border-white/75 dark:border-white/15 p-6 shadow-2xl space-y-4 text-center relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition cursor-pointer"
          aria-label="Close reminder"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <Award className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Practice Completed · {scorePercentage}% Score
          </span>
          <h3 className="text-lg font-bold font-['Outfit',sans-serif] text-slate-950 dark:text-white">
            Save Your Progress &amp; Lock {gradeText} Exams
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            You just finished <strong className="text-slate-900 dark:text-white">{examName}</strong> in Guest Mode. Complete your free student registration to permanently save your scores, claim 1 Free Coin, and filter exams exclusively for {gradeText}.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRegisterNow();
            }}
            className="w-full py-2.5 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Complete Free Registration (+1 Coin)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="flex-1 py-2 px-3 rounded-full liquid-glass-btn text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-full text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
