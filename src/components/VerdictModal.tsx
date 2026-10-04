import React, { useState, useEffect } from 'react';
import {
  X,
  Gavel,
  Scale,
  Award,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  ArrowRight,
  Sparkles,
  RotateCcw,
  FileCheck2,
  Printer,
  History,
  Compass,
  Building2,
  FileText
} from 'lucide-react';
import { CaseDossier, Character, VerdictResult } from '../types.ts';
import { soundManager } from '../utils/audio.ts';
import { OfficialJudicialSheet } from './OfficialJudicialSheet.tsx';

interface VerdictModalProps {
  caseData: CaseDossier;
  isOpen: boolean;
  onClose: () => void;
  onSubmitVerdict: (
    accusedId: string,
    verdictType: string,
    reasoning: string,
    penalty: string,
    chargeName?: string
  ) => Promise<VerdictResult | null>;
  onStartNewCase: () => void;
}

export const VerdictModal: React.FC<VerdictModalProps> = ({
  caseData,
  isOpen,
  onClose,
  onSubmitVerdict,
  onStartNewCase,
}) => {
  const [selectedAccusedId, setSelectedAccusedId] = useState<string>(
    caseData.characters[0]?.id || ''
  );
  const [verdictType, setVerdictType] = useState<string>('guilty');
  const [chargeName, setChargeName] = useState<string>('');
  const [penalty, setPenalty] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [showVerdictSheet, setShowVerdictSheet] = useState(false);

  // Initialize sensible defaults when case changes or opens
  useEffect(() => {
    if (caseData) {
      if (!chargeName) {
        if (caseData.genre.includes('سرقت')) {
          setChargeName('سرقت مقرون به آزار و اخلال در امنیت اموال');
        } else if (caseData.genre.includes('کلاهبرداری') || caseData.genre.includes('اختلاس') || caseData.genre.includes('مالی')) {
          setChargeName('کلاهبرداری شبکه‌ای، جعل اسناد و تحصیل مال نامشروع');
        } else if (caseData.genre.includes('حریق') || caseData.genre.includes('آتش')) {
          setChargeName('احراق عمدی تأسیسات و تخریب اموال عمومی');
        } else {
          setChargeName('قتل عمدی با سبق تصمیم و جنایت علیه تمامیت جسمانی');
        }
      }
      if (!penalty) {
        setPenalty('حبس تعزیری درجه یک به همراه رد مال و جبران خسارات');
      }
    }
  }, [caseData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playPaperRustle();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleIssueVerdict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasoning.trim() || isSubmitting) return;

    soundManager.playGavel();
    setIsSubmitting(true);

    try {
      const res = await onSubmitVerdict(selectedAccusedId, verdictType, reasoning, penalty, chargeName);
      if (res) {
        setResult(res);
        if (res.isCorrect) {
          soundManager.playDramaticSting();
        } else {
          soundManager.playHeartbeat();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedChar = caseData.characters.find((c) => c.id === selectedAccusedId);
  const isRealCase = Boolean(caseData?.realWorldInfo?.isRealCase);

  // Quick suggestion tags for charges and penalties
  const quickChargeSuggestions = [
    'قتل عمد با سبق تصمیم',
    'مشارکت در قتل و جنایت سازمان‌یافته',
    'کلاهبرداری، تحصیل مال نامشروع و پول‌شویی',
    'سرقت کلان مقرون به آزار',
    'خیانت در امانت و جعل اسناد رسمی',
    'اخاذی، تهدید و باج‌خواهی کلان',
    'احراق عمدی و تخریب اموال با هدف کلاهبرداری بیمه',
  ];

  const quickPenaltySuggestions = [
    'قصاص نفس (اشد مجازات قانونی)',
    'حبس ابد با اعمال شاقه',
    '۲۰ سال حبس تعزیری درجه یک و رد مال',
    '۱۰ سال حبس تعزیری و محرومیت دائم از خدمات دولتی',
    '۵ سال حبس، رد مال مسروقه و جزای نقدی معادل مال',
    'تبرئه کامل، صدور قرار منع تعقیب و اعاده حیثیت',
  ];

  return (
    <div
      onClick={() => {
        soundManager.playPaperRustle();
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#12141e] border border-amber-900/40 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-stone-200 max-h-[92vh] flex flex-col cursor-default select-text"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#1c1f2e] to-[#151724] border-b border-stone-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-stone-400 block font-mono truncate">پرونده کلاسه {caseData.caseNumber}</span>
                {isRealCase && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                    پرونده واقعی تاریخ
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-base md:text-lg font-bold text-amber-100 truncate">انشای دادنامه و صدور حکم نهایی دادگاه</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-6">
          {!result ? (
            /* Verdict Form */
            <form onSubmit={handleIssueVerdict} className="space-y-4 sm:space-y-6">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-950/20 border border-amber-800/30 text-xs text-amber-200/90 leading-relaxed">
                جناب قاضی، جلسه دادرسی به پایان رسیده است. پس از استماع اظهارات طرفین و مداقه در شواهد کارشناسی، عنوان اتهام انتسابی و مجازات را تایپ نموده و دلایل حکم را انشا فرمایید تا دیوان عالی و هوش مصنوعی دقت قضاوت شما را بسنجد.
              </div>

              {/* Step 1: Select Person */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-300 block">
                  ۱. شخص مورد نظر برای صدور رأی را مشخص کنید:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {caseData.characters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccusedId(char.id);
                        soundManager.playPaperRustle();
                      }}
                      className={`p-2.5 sm:p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        selectedAccusedId === char.id
                          ? 'bg-amber-600/20 border-amber-500 ring-1 ring-amber-500/50'
                          : 'bg-[#181a26] border-stone-800 hover:bg-[#1f2233]'
                      }`}
                    >
                      <span className="text-xs font-bold text-stone-200 block truncate">{char.name}</span>
                      <span className="text-[10px] text-stone-400 block truncate">{char.occupation} ({char.age} ساله)</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Verdict Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-300 block">
                  ۲. تصمیم قضایی شما در خصوص {selectedChar?.name || 'فرد منتخب'}:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <label
                    onClick={() => setVerdictType('guilty')}
                    className={`flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all ${
                      verdictType === 'guilty'
                        ? 'bg-red-950/30 border-red-500 ring-1 ring-red-500/40 text-red-200'
                        : 'bg-[#181a26] border-stone-800 text-stone-400 hover:bg-[#1e2130]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdictType"
                      value="guilty"
                      checked={verdictType === 'guilty'}
                      onChange={() => setVerdictType('guilty')}
                      className="accent-red-500"
                    />
                    <div>
                      <span className="text-xs font-bold block text-stone-100">احراز مجرمیت و محکومیت</span>
                      <span className="text-[10px] sm:text-[11px] text-stone-400">فرد به عنوان مرتکب اصلی، شریک یا معاون در جرم شناخته شد.</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setVerdictType('acquitted')}
                    className={`flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border cursor-pointer transition-all ${
                      verdictType === 'acquitted'
                        ? 'bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40 text-emerald-200'
                        : 'bg-[#181a26] border-stone-800 text-stone-400 hover:bg-[#1e2130]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdictType"
                      value="acquitted"
                      checked={verdictType === 'acquitted'}
                      onChange={() => setVerdictType('acquitted')}
                      className="accent-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold block text-stone-100">حکم برائت کامل (بی‌گناهی)</span>
                      <span className="text-[10px] sm:text-[11px] text-stone-400">فقدان ادله اثباتی، عدم احراز سوءنیت مجرمانه یا پاپوش‌بودن اتهامات.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 3: Typed Accusation / Charge Name (Fully Typed with suggestions) */}
              {verdictType === 'guilty' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-300 block">
                      ۳. عنوان دقیق اتهام انتسابی (کاملاً تایپی توسط قاضی):
                    </label>
                    <span className="text-[10px] text-amber-400/80">جمینای صحت عنوان اتهام را می‌سنجد</span>
                  </div>
                  <input
                    type="text"
                    value={chargeName}
                    onChange={(e) => setChargeName(e.target.value)}
                    placeholder="عنوان دقیق جرم را تایپ کنید (مثلاً: کلاهبرداری شبکه‌ای، قتل عمد، جعل سند رسمی، سرقت مسلحانه، خیانت در امانت...)"
                    className="w-full bg-[#161824] border border-stone-700 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 font-sans"
                    required={verdictType === 'guilty'}
                  />
                  {/* Quick suggestions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-500 self-center">پیشنهادات سریع:</span>
                    {quickChargeSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setChargeName(sug);
                          soundManager.playPaperRustle();
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-850 hover:bg-stone-750 text-stone-400 hover:text-amber-300 border border-stone-800 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Typed Penalty / Court Decision */}
              {verdictType === 'guilty' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-300 block">
                    ۴. تعیین نوع و میزان مجازات قانونی (کاملاً تایپی و دلخواه):
                  </label>
                  <input
                    type="text"
                    value={penalty}
                    onChange={(e) => setPenalty(e.target.value)}
                    placeholder="نوع و میزان مجازات را تایپ کنید (مثلاً: ۱۵ سال حبس تعزیری و رد مال، قصاص نفس، حبس ابد، جزای نقدی...)"
                    className="w-full bg-[#161824] border border-stone-700 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 font-sans"
                    required={verdictType === 'guilty'}
                  />
                  {/* Quick penalty suggestions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-500 self-center">پیشنهادات سریع:</span>
                    {quickPenaltySuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPenalty(sug);
                          soundManager.playPaperRustle();
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-850 hover:bg-stone-750 text-stone-400 hover:text-amber-300 border border-stone-800 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Judicial Reasoning Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-300 block">
                  {verdictType === 'guilty' ? '۵' : '۳'}. انشای استدلال قضایی (مستندات و تطبیق شواهد پرونده):
                </label>
                <textarea
                  rows={4}
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="جناب قاضی، دلایل محکومیت یا برائت را تشریح کنید (مثلاً: عدم تطابق الایبی با ردیابی دکل مخابراتی، کشف اثر انگشت بر روی سند مکشوفه، شهادت شهود، رد مال و...)"
                  className="w-full bg-[#0f1118] border border-stone-700 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  required
                />
              </div>

              {/* Seal & Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !reasoning.trim()}
                  className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-700 via-amber-700 to-amber-800 hover:from-red-600 hover:to-amber-700 text-stone-100 font-extrabold text-xs sm:text-base shadow-xl shadow-red-950/50 flex items-center justify-center gap-2.5 sm:gap-3 transition-all disabled:opacity-50 cursor-pointer active:scale-98 min-h-[44px]"
                >
                  <Gavel className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  <span>
                    {isSubmitting ? 'در حال ثبت و ارزیابی رأی توسط دیوان عالی (جمینای)...' : 'ختم جلسه دادرسی و صدور قطعی دادنامه'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Post-Verdict Truth & Score Reveal */
            <div className="space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-300">
              {/* Score Header Card */}
              <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#1a1d2d] to-[#121420] border border-amber-500/30 text-center space-y-2 sm:space-y-3 shadow-xl">
                <div className="inline-flex p-2.5 sm:p-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-1">
                  {result.isCorrect ? (
                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
                  )}
                </div>

                <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-amber-100">
                  {result.isCorrect
                    ? 'عدالت محقق شد! شما حقیقت مکتوم را کشف کردید'
                    : 'فریب دفاعیات خورده شد یا عدالت قضایی مخدوش گردید'}
                </h3>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] sm:text-xs md:text-sm">
                  <span className="px-3 py-1 rounded-full bg-stone-800 border border-stone-700">
                    نمره عدالت قضایی: <strong className="text-amber-400 font-mono text-sm sm:text-base">{result.justiceRating}/۱۰۰</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-stone-800 border border-stone-700">
                    وضعیت فریب: <strong className={result.deceptionBusted ? 'text-emerald-400' : 'text-red-400'}>
                      {result.deceptionBusted ? 'توطئه و دروغ برملا شد' : 'دروغ‌ها مانع اجرای عدالت شد'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Typed Accusation & Penalty Verification Card */}
              {result.chargeName && (
                <div className="p-3 sm:p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[11px]">عنوان اتهام انتسابی شما:</span>
                    <strong className="text-amber-300 text-sm font-semibold">{result.chargeName}</strong>
                  </div>
                  {result.penaltyApplied && (
                    <div>
                      <span className="text-stone-400 block text-[11px]">مجازات تعیینی دادگاه:</span>
                      <strong className="text-stone-200 text-sm font-semibold">{result.penaltyApplied}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* REAL-WORLD HISTORICAL COMPARISON CARD (If this is a real-world case) */}
              {result.historicalComparison && (
                <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#241c14] via-[#1a1510] to-[#12100d] border-2 border-amber-500/60 shadow-2xl space-y-3.5 text-stone-200">
                  <div className="flex items-center justify-between border-b border-amber-700/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-amber-300">
                          مقایسه رأی شما با رأی واقعی دادگاه در تاریخ جهان
                        </h4>
                        <span className="text-[11px] text-amber-200/70">
                          بررسی مستند رویداد تاریخی و تطابق حکم صادره
                        </span>
                      </div>
                    </div>

                    <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs shrink-0">
                      تطابق با واقعیت: {result.historicalComparison.divergencePercentage}٪
                    </div>
                  </div>

                  {/* Summary of divergence */}
                  <div className="p-3 rounded-xl bg-black/40 border border-amber-900/40 text-xs sm:text-sm font-medium text-amber-100/90 leading-relaxed">
                    {result.historicalComparison.matchSummary}
                  </div>

                  {/* Real World Verdict vs Sentenced */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1">
                      <span className="text-stone-400 font-bold block">رأی قطعی دادگاه تاریخی در دنیای واقعی:</span>
                      <p className="text-stone-200 leading-relaxed">{result.historicalComparison.actualCourtVerdict}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1">
                      <span className="text-stone-400 font-bold block">مجازات یا پیامد واقعی در تاریخ:</span>
                      <p className="text-stone-200 leading-relaxed">{result.historicalComparison.actualSentence}</p>
                    </div>
                  </div>

                  {/* Detailed Historical Analysis */}
                  <div className="space-y-1 text-xs sm:text-sm leading-relaxed text-stone-300 border-t border-stone-800/80 pt-2.5">
                    <strong className="text-amber-400 block text-xs">تحلیل مقایسه‌ای استدلال شما با هیئت قضایی واقعی:</strong>
                    <p className="text-stone-300 whitespace-pre-line">{result.historicalComparison.historicalAnalysis}</p>
                  </div>

                  {/* Historical Epilogue */}
                  {result.historicalComparison.realWorldEpilogue && (
                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30 text-xs text-amber-200/90 leading-relaxed">
                      <strong className="text-amber-300 block mb-1">سرنوشت واقعی شخصیت‌های پرونده پس از دادگاه:</strong>
                      {result.historicalComparison.realWorldEpilogue}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Analysis */}
              <div className="p-3.5 sm:p-5 rounded-2xl bg-[#161826] border border-stone-800 space-y-1.5 sm:space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 sm:gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  تحلیل و ارزیابی دیوان عالی از استدلال و عنوان اتهام:
                </h4>
                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
                  {result.feedback}
                </p>
              </div>

              {/* Hidden Truth Unveiled */}
              <div className="p-3.5 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-700/30 space-y-1.5 sm:space-y-2">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 sm:gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  پرده‌برداری از حقیقت کامل پرونده (آنچه در خفا رخ داده بود):
                </h4>
                <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed whitespace-pre-line">
                  {result.truthRevealed}
                </p>
              </div>

              {/* Culprit final confession if available */}
              {result.culpritConfession && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-red-950/30 border border-red-600/30 text-red-200 text-xs leading-relaxed space-y-1">
                  <span className="font-bold block text-red-400">واکنش و اعتراف نهایی مقصر در صحن دادگاه:</span>
                  <p className="italic font-serif">«{result.culpritConfession}»</p>
                </div>
              )}

              {/* Epilogue */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#141622] border border-stone-800 text-xs text-stone-400 leading-relaxed">
                <strong className="text-stone-300 block mb-1">سرانجام پس از اجرای حکم:</strong>
                {result.epilogue}
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playPaperRustle();
                      setShowVerdictSheet(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer shadow min-h-[42px]"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>مشاهده و چاپ دادنامه رسمی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-semibold transition-colors cursor-pointer text-center min-h-[42px]"
                  >
                    ویرایش و انشای مجدد رأی
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playGavel();
                    onStartNewCase();
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs md:text-sm shadow-lg shadow-amber-900/40 transition-all cursor-pointer min-h-[42px]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>بررسی پرونده جنایی بعدی</span>
                </button>
              </div>

              {/* Official Verdict Document Sheet Modal */}
              <OfficialJudicialSheet
                caseData={caseData}
                type="verdict"
                verdictResult={result}
                accusedName={selectedChar?.name}
                verdictType={verdictType}
                penalty={penalty}
                reasoning={reasoning}
                isOpen={showVerdictSheet}
                onClose={() => setShowVerdictSheet(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
