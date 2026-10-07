import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  BookOpen,
  FolderOpen,
  Gavel,
  ShieldAlert,
  Volume2,
  VolumeX,
  ChevronLeft,
  Search,
  Clock,
  MapPin,
  AlertTriangle,
  X,
  Play,
  Terminal,
  History,
  Compass,
  Globe,
  Loader2,
  Calendar,
  Award,
  Settings,
  Flame,
  Trash2,
} from 'lucide-react';
import { CaseDossier, SavedCaseState } from '../types.ts';
import { soundManager } from '../utils/audio.ts';
import { useFullscreen } from '../utils/useFullscreen.ts';
import { REAL_WORLD_CASES } from '../data/realCases.ts';
import { SettingsTab } from './SettingsModal.tsx';

interface MainMenuProps {
  onStartConsultation: () => void;
  presetCases: CaseDossier[];
  onSelectCase: (selectedCase: CaseDossier) => void;
  isSoundOn: boolean;
  setIsSoundOn: (val: boolean) => void;
  onGavelStrike: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  activeModel?: string;
  savedSession?: SavedCaseState | null;
  onResumeSavedCase?: () => void;
  onDiscardSavedCase?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartConsultation,
  presetCases,
  onSelectCase,
  isSoundOn,
  setIsSoundOn,
  onGavelStrike,
  onOpenSettings,
  activeModel,
  savedSession,
  onResumeSavedCase,
  onDiscardSavedCase,
}) => {
  const [showRealCasesModal, setShowRealCasesModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [customRealTopic, setCustomRealTopic] = useState('');
  const [isGeneratingRealCase, setIsGeneratingRealCase] = useState(false);
  const [realCasesList, setRealCasesList] = useState<CaseDossier[]>(REAL_WORLD_CASES);
  const [isDarkAmbienceActive, setIsDarkAmbienceActive] = useState<boolean>(soundManager.isAmbiencePlaying());
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const toggleSound = () => {
    const next = !isSoundOn;
    setIsSoundOn(next);
    soundManager.setSoundEnabled(next);
    if (next) soundManager.playGavel();
  };

  const handleFullscreenToggle = () => {
    soundManager.playPaperRustle();
    toggleFullscreen();
  };

  const handleGenerateCustomRealCase = async (overrideTopic?: string, isRandom = false) => {
    soundManager.playGavel();
    setIsGeneratingRealCase(true);
    try {
      const res = await fetch('/api/generate-real-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNameOrTopic: overrideTopic || customRealTopic || '',
          isRandom,
        }),
      });
      if (!res.ok) throw new Error('خطا در ارتباط با سرور');
      const newRealCase: CaseDossier = await res.json();
      if (!newRealCase || !newRealCase.title || !Array.isArray(newRealCase.characters) || newRealCase.characters.length === 0) {
        throw new Error('ساختار پرونده واقعی ناقص است');
      }
      setRealCasesList((prev) => [newRealCase, ...prev]);
      setShowRealCasesModal(false);
      onSelectCase(newRealCase);
    } catch (err) {
      console.error('Error generating real case:', err);
      // Fallback: select first preset real case
      onSelectCase(REAL_WORLD_CASES[0]);
      setShowRealCasesModal(false);
    } finally {
      setIsGeneratingRealCase(false);
    }
  };

  const famousSuggestions = [
    'پرونده تد باندی (Ted Bundy)',
    'پرونده زودیاک قاتل (Zodiac Killer)',
    'پرونده قتل جان‌بنت رمزی',
    'سرقت قطار بزرگ انگلستان (۱۹۶۳)',
    'پرونده کلاهبرداری برنی میداف',
    'پرونده دکتر کاظم سامی (۱۳۶۷)',
  ];

  const thematicCategories = [
    { label: '🩸 قتل‌های مرموز و معماهای تاریخ', topic: 'قتل‌های مرموز و معماگونه تاریخ جهان با مدارک آزمایشگاهی' },
    { label: '🇮🇷 پرونده‌های جنجالی دادگاه‌های ایران', topic: 'پرونده واقعی جنجالی در تاریخ دادگاه‌های کیفری ایران' },
    { label: '💰 سرقت‌های قرن و کلاهبرداری‌های میلیاردی', topic: 'بزرگ‌ترین سرقت بانک یا کلاهبرداری مالی و جعل اسناد در تاریخ' },
    { label: '💊 مسمومیت‌های مشکوک و جنایات دارویی', topic: 'پرونده مسمومیت مشکوک با مواد سمی و ترور دارویی در تاریخ' },
    { label: '🎭 جنایات هالیوود و افراد مشهور', topic: 'پرونده واقعی جنایت یا قتل در هالیوود میان افراد ثروتمند و مشهور' },
    { label: '🚪 معماهای قتل در اتاق دربسته', topic: 'معمای قتل در فضای بسته با شواهد مبهم بالستیک و پزشکی قانونی' },
  ];

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-between overflow-x-hidden bg-[#0a0b10] text-[#c5c6c7] p-2.5 sm:p-5 md:p-8 select-none">
      {/* Background Visual Texture & Light Cone */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-950/25 via-[#0b0c14] to-[#07080b] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Header Controls */}
      <header className="relative z-10 flex flex-wrap items-center justify-between max-w-6xl mx-auto w-full gap-2 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={handleFullscreenToggle}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-amber-500/60 shadow-md shadow-amber-950/50 bg-[#12141f] shrink-0 hover:scale-105 transition-transform cursor-pointer ring-2 ring-amber-500/20"
            title="نمایش تمام صفحه در گوشی و مانیتور (Fullscreen)"
          >
            <img
              src="/images/court_gavel_logo.jpg"
              alt="نشان رسمی دادگاه"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover scale-[1.15]"
            />
          </button>
          <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-stone-300 tracking-wider truncate">
            دیوان عالی امور جنایی • شعبه ویژه قضاوت
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Background Music Quick Toggle */}
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              if (soundManager.isBgMusicPlaying()) {
                soundManager.pauseBgMusic();
              } else {
                soundManager.playBgMusic();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-900/40 bg-stone-900/90 hover:bg-stone-850 text-stone-300 hover:text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow min-h-[36px]"
            title="پخش یا توقف لیست موسیقی پیش‌زمینه دارک"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">موسیقی پیش‌زمینه</span>
          </button>

          {/* Gavel Test Strike */}
          <button
            onClick={() => {
              soundManager.playGavel();
              onGavelStrike();
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-medium transition-all cursor-pointer shadow min-h-[36px]"
            title="تست ضربه چکش دادگاه"
          >
            <Gavel className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">ضربه چکش</span>
          </button>

          {/* Sound FX Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer shrink-0 min-h-[36px]"
            title={isSoundOn ? 'قطع صدا' : 'وصل صدا'}
          >
            {isSoundOn ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-500" />}
          </button>

          {/* Consolidated Settings Modal Trigger */}
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              onOpenSettings();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#1c1f30] to-[#151726] hover:from-[#24283f] hover:to-[#1a1d2f] border border-amber-900/50 hover:border-amber-500/50 text-stone-200 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-md min-h-[36px]"
            title="تنظیمات جامع دیوان عدالت (نصب PWA، تمام‌صفحه، وضعیت هوش مصنوعی جمینای، لاگ‌های سیستمی و صدا)"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>تنظیمات</span>
          </button>
        </div>
      </header>

      {/* Hero Branding Section */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center my-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Judicial Crest Emblem */}
        <div className="relative inline-block my-1 sm:my-2">
          <div className="absolute inset-0 rounded-full bg-amber-600/20 blur-2xl -z-10 scale-110 pointer-events-none" />

          <button
            onClick={handleFullscreenToggle}
            className="w-44 h-44 sm:w-60 sm:h-60 md:w-72 md:h-72 mx-auto rounded-full overflow-hidden border-4 border-amber-600/80 shadow-[0_0_50px_rgba(217,119,6,0.35)] bg-[#0d0e14] ring-4 sm:ring-8 ring-[#1c1f2e] group hover:border-amber-400 transition-all duration-300 cursor-pointer block"
            title="برای تمام‌صفحه شدن کلیک کنید"
          >
            <img
              src="/images/court_gavel_logo.jpg"
              alt="نشان رسمی دادگاه آقای قاضی"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover scale-[1.12] group-hover:scale-[1.16] transition-transform duration-700"
            />
          </button>

          <div className="absolute -bottom-2.5 sm:-bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-950 via-red-900 to-red-950 border border-red-500/70 text-red-200 text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-xl flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 animate-pulse" />
            <span>نشان رسمی دیوان قضاوت جنایی</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-amber-100 tracking-tight font-serif drop-shadow-lg">
            آقای قاضی
          </h1>
          <p className="text-xs sm:text-base md:text-lg text-amber-200/80 font-medium max-w-2xl mx-auto leading-relaxed px-2">
            شبیه‌ساز هوشمند دادرسی، بازجویی از متهمان فریبکار و حل پرونده‌های واقعی تاریخ با هوش مصنوعی
          </p>
        </div>

        {/* Saved Case Resume Banner (if an unfinished case session exists) */}
        {savedSession && savedSession.caseData && (
          <div className="max-w-2xl mx-auto p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-[#1d1a2c] to-amber-950/90 border-2 border-amber-500/80 shadow-2xl space-y-3 text-right animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black text-amber-300">📁 پرونده نیمه‌کاره شما آماده ادامه دادرسی است</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">
                ذخیره‌شده: {new Date(savedSession.savedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} - {new Date(savedSession.savedAt).toLocaleDateString('fa-IR')}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-extrabold text-stone-100 flex items-center gap-2">
                  <span>{savedSession.caseData.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-amber-400 font-mono">
                    کلاسه {savedSession.caseData.caseNumber}
                  </span>
                </h4>
                <p className="text-xs text-stone-300 flex items-center gap-3">
                  <span>💬 {savedSession.messageCount || savedSession.courtroomMessages.length} دیالوگ ثبت‌شده در دادگاه</span>
                  <span>•</span>
                  <span>👥 {savedSession.caseData.characters.length} شخص حاضر در صحن</span>
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {onResumeSavedCase && (
                  <button
                    onClick={() => {
                      soundManager.playGavel();
                      onResumeSavedCase();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950/60 flex items-center gap-2 transition cursor-pointer active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-stone-950" />
                    <span>ادامه قضاوت این پرونده</span>
                  </button>
                )}

                {onDiscardSavedCase && (
                  <button
                    onClick={() => {
                      soundManager.playPaperRustle();
                      onDiscardSavedCase();
                    }}
                    className="p-2.5 rounded-xl bg-stone-900/90 hover:bg-red-950/60 border border-stone-800 hover:border-red-800/80 text-stone-400 hover:text-red-300 text-xs transition cursor-pointer"
                    title="بایگانی و حذف این ذخیره نیمه‌کاره"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 max-w-2xl mx-auto pt-2 sm:pt-4 text-right">
          {/* Card 1: Custom Case with Gemini */}
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              onStartConsultation();
            }}
            className="group relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#191c2b] via-[#141624] to-[#10121d] border border-amber-500/40 hover:border-amber-400/80 shadow-xl hover:shadow-amber-950/40 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 hover:-translate-y-0.5 min-h-[160px]"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  خلق پرونده با سوژه دلخواه
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 group-hover:text-amber-200 transition-colors">
                طراحی پرونده با تایپ موضوع دلخواه
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400 leading-relaxed">
                هر موضوعی دوست دارید تایپ کنید (مثل: قتل بازیکن فوتبال، سرقت اشیای عتیقه، کلاهبرداری هرمی...) تا جمینای سناریو، اشخاص و شواهد را خلق کند.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-300 group-hover:text-amber-200 border-t border-amber-900/40">
              <span>تایپ موضوع و خلق آنی پرونده</span>
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Card 2: NEW REAL-WORLD FAMOUS CASES SECTION (Replaces old static archive) */}
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              setShowRealCasesModal(true);
            }}
            className="group relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#241a14] via-[#1a1410] to-[#120f0d] border-2 border-amber-600/60 hover:border-amber-400 shadow-xl hover:shadow-amber-900/50 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 hover:-translate-y-0.5 min-h-[160px]"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <History className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-red-950/70 text-red-300 border border-red-700/60">
                  پرونده‌های واقعی جهان و تاریخ
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-amber-200 group-hover:text-amber-100 transition-colors">
                حل پرونده‌های واقعی دنیای جنایت
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-300/90 leading-relaxed">
                حل پرونده‌های واقعی و مستند تاریخ (او.جی. سیمپسون، خفاش شب، مسمومیت‌های بزرگ، کوکب سیاه و...). در پایان رأی شما با <strong>رأی قطعی دادگاه واقعی در تاریخ</strong> مقایسه می‌شود!
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-300 group-hover:text-amber-200 border-t border-amber-800/50">
              <span>ورود به تالار پرونده‌های واقعی تاریخ</span>
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </div>
          </button>
        </div>

        {/* Guide Trigger */}
        <div className="pt-2 sm:pt-3">
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              setShowGuideModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-[#141620] hover:bg-[#1a1d2c] border border-stone-850 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-[11px] sm:text-xs font-medium transition-all cursor-pointer min-h-[40px]"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>راهنمای آیین دادرسی و قواعد بازی قضاوت</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-stone-500 py-3 border-t border-stone-900/60 max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-2">
        <span>سامانه هوشمند دادگاه‌های کیفری یک • کلیه شخصیت‌ها و وقایع ساختگی هستند.</span>
        <span className="font-mono text-stone-600">نسخه ۱.۰ - مجهز به مدل Gemini 3.8 Flash</span>
      </footer>

      {/* REAL-WORLD HISTORICAL CASES MODAL */}
      {showRealCasesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-[#12141e] border-2 border-amber-600/60 rounded-3xl shadow-2xl overflow-hidden text-stone-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-4 bg-gradient-to-r from-[#1c1815] to-[#141520] border-b border-amber-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-amber-100">
                    تالار پرونده‌های جنایی واقعی در تاریخ جهان
                  </h3>
                  <p className="text-xs text-amber-200/70">
                    قضاوت در پرونده‌های واقعی تاریخ • در پایان دادرسی، رأی شما با تصمیم واقعی دادگاه مقایسه می‌شود
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRealCasesModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Reassurance Banner for users who don't know the cases */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3 text-stone-200">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div className="space-y-1">
                  <strong className="text-amber-200 block text-xs sm:text-sm font-bold">
                    پرونده‌ها را نمی‌شناسید؟ اصلاً نیازی به شناخت قبلی ندارید!
                  </strong>
                  <p className="text-stone-300 leading-relaxed text-[11px] sm:text-xs">
                    در واقع ندانستن سرانجام ماجرا، هیجان‌انگیزترین بخش بازی است! شما مانند یک قاضی و کارآگاه واقعی از صفر شواهد، بازجویی‌ها و گزارش پزشکی قانونی را بررسی می‌کنید و در پایان می‌بینید قضاوت شما چقدر به حقیقت تاریخی نزدیک بوده است.
                  </p>
                </div>
              </div>

              {/* 1-Click Random Case Generator Button */}
              <button
                onClick={() => handleGenerateCustomRealCase('', true)}
                disabled={isGeneratingRealCase}
                className="w-full py-3.5 sm:py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-950/60 flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer border border-amber-300/40 group"
              >
                {isGeneratingRealCase ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-stone-950" />
                    <span>جمینای در حال انتخاب و بازسازی یک پرونده واقعی شگفت‌انگیز...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg group-hover:rotate-12 transition-transform">🎲</span>
                    <span>یک پرونده واقعی و جذاب برای من انتخاب کن (انتخاب تصادفی با هوش مصنوعی)</span>
                  </>
                )}
              </button>

              {/* Browse by Themes / Categories (No case names needed!) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-200/90 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>انتخاب بر اساس موضوع مورد علاقه شما (بدون نیاز به نام پرونده):</span>
                  </span>
                  <span className="text-[10px] text-stone-400">یک کلیک برای شروع</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {thematicCategories.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleGenerateCustomRealCase(cat.topic)}
                      disabled={isGeneratingRealCase}
                      className="p-2.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 text-right text-xs font-medium text-stone-300 hover:text-amber-200 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <span className="truncate">{cat.label}</span>
                      <ChevronLeft className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 transition-transform group-hover:-translate-x-0.5 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Box 1: Custom Real-World Case Request via Gemini */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1a1714] to-[#151722] border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                    یا نام هر پرونده خاصی که مد نظرتان است را تایپ کنید:
                  </h4>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customRealTopic}
                    onChange={(e) => setCustomRealTopic(e.target.value)}
                    placeholder="مثلاً: پرونده زودیاک قاتل، تد باندی، قتل جان‌بنت رمزی، سرقت قطار بزرگ، پرونده کاظم سامی..."
                    className="flex-1 bg-[#0e1017] border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none"
                    disabled={isGeneratingRealCase}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateCustomRealCase();
                    }}
                  />
                  <button
                    onClick={() => handleGenerateCustomRealCase()}
                    disabled={isGeneratingRealCase || !customRealTopic.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {isGeneratingRealCase ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال بازسازی...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>بازسازی پرونده</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick suggestions pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-stone-400 self-center">نمونه‌های تاریخی:</span>
                  {famousSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleGenerateCustomRealCase(item)}
                      disabled={isGeneratingRealCase}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-stone-850 hover:bg-stone-750 text-stone-300 hover:text-amber-300 border border-stone-750 transition cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Box 2: Pre-seeded Ready Famous Real-World Cases */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>پرونده‌های واقعی آماده دادرسی ({realCasesList.length} پرونده مستند):</span>
                  </h4>
                  <span className="text-[11px] text-stone-400">شامل شواهد مادی و رأی قطعی تاریخی</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {realCasesList.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#161826] to-[#12131d] border border-amber-900/40 hover:border-amber-500/60 transition-all space-y-3 shadow-lg group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {caseItem.caseNumber}
                          </span>
                          <h5 className="text-base font-bold text-stone-100 group-hover:text-amber-200 transition-colors">
                            {caseItem.title}
                          </h5>
                        </div>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-800/40 font-semibold">
                          {caseItem.genre}
                        </span>
                      </div>

                      <p className="text-xs text-stone-300 leading-relaxed bg-[#0f1118] p-3.5 rounded-xl border border-stone-850">
                        {caseItem.briefing}
                      </p>

                      {/* Real world details badge */}
                      {caseItem.realWorldInfo && (
                        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-200/90 space-y-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span><strong>مکان و تاریخ:</strong> {caseItem.realWorldInfo.historicalLocation} ({caseItem.realWorldInfo.historicalDate})</span>
                          </div>
                          <div>
                            <strong>رأی واقعی دادگاه در تاریخ:</strong> {caseItem.realWorldInfo.actualCourtVerdict}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="text-[11px] text-stone-400">
                          {caseItem.characters.length} شخص حاضر در دادگاه • {caseItem.evidence.length} مدرک آزمایشگاهی
                        </div>

                        <button
                          onClick={() => {
                            soundManager.playGavel();
                            onSelectCase(caseItem);
                            setShowRealCasesModal(false);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-stone-950" />
                          <span>گشودن پرونده واقعی و شروع دادرسی</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#12141e] border border-amber-900/50 rounded-3xl shadow-2xl overflow-hidden text-stone-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#181a28] border-b border-stone-800">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-amber-100">آیین دادرسی و دستورالعمل قضاوت</h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4 text-xs md:text-sm leading-relaxed text-stone-300">
              <div className="p-4 rounded-xl bg-[#171926] border border-stone-800 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">۱</span>
                  مرحله اول: مطالعه پرونده و گزارش کالبدشکافی
                </h4>
                <p className="text-xs text-stone-400">
                  ابتدا گزارش صحنه جرم، علت مستقیم فوت، زمان مرگ و مدارک کشف شده را در برگه پرونده به دقت مرور کنید. هر ساعت و هر نمونه آزمایشگاهی ممکن است کلید شکستن دروغ متهم باشد.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#171926] border border-stone-800 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">۲</span>
                  مرحله دوم: استنطاق زنده و کشف تناقض‌ها
                </h4>
                <p className="text-xs text-stone-400">
                  وارد صحن دادگاه شوید. اشخاص نقش‌های پنهان دارند؛ شما باید از روی صحبت‌ها، واکنش‌ها و تطبیق مدارک بفهمید چه کسی دروغ می‌گوید. مدارک را ضمیمه سوالاتتان کنید تا متهم در تنگنا قرار گیرد.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#171926] border border-stone-800 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">۳</span>
                  مرحله سوم: صدور دادنامه و مقایسه با رأی دادگاه واقعی
                </h4>
                <p className="text-xs text-stone-400">
                  عنوان دقیق اتهام انتسابی و مجازات را تایپ کنید و استدلال قضایی‌تان را بنویسید. در پرونده‌های واقعی تاریخ، حکم شما مستقیماً با رأی دادگاه واقعی در تاریخ جهان مقایسه شده و میزان انطباق آن گزارش می‌شود.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
