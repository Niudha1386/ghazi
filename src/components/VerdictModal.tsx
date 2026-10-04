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
  FileText,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  UserX,
  HelpCircle,
  Users
} from 'lucide-react';
import { CaseDossier, Character, VerdictResult, IndividualCharacterVerdict } from '../types.ts';
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
    chargeName?: string,
    individualDecisions?: IndividualCharacterVerdict[]
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
  // State for all characters' decisions
  const [characterDecisions, setCharacterDecisions] = useState<Record<string, {
    status: 'guilty' | 'acquitted' | 'witness_cleared' | 'investigate_further';
    chargeAndPenalty: string;
  }>>({});

  // Comprehensive master verdict reasoning
  const [masterReasoning, setMasterReasoning] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [showVerdictSheet, setShowVerdictSheet] = useState(false);

  // Initialize individual decisions when caseData changes
  useEffect(() => {
    if (caseData && caseData.characters) {
      const initialMap: Record<string, {
        status: 'guilty' | 'acquitted' | 'witness_cleared' | 'investigate_further';
        chargeAndPenalty: string;
      }> = {};

      caseData.characters.forEach((char, index) => {
        if (char.role === 'defendant' && index === 0) {
          initialMap[char.id] = {
            status: 'guilty',
            chargeAndPenalty: caseData.genre.includes('سرقت')
              ? 'سرقت مقرون به آزار - ۱۰ سال حبس و رد مال'
              : caseData.genre.includes('کلاهبرداری') || caseData.genre.includes('مالی')
              ? 'کلاهبرداری و جعل - ۵ سال حبس تعزیری و رد مال'
              : 'قتل عمدی با سبق تصمیم - قصاص نفس',
          };
        } else if (char.role === 'defendant') {
          initialMap[char.id] = {
            status: 'investigate_further',
            chargeAndPenalty: 'مشارکت یا معاونت در جرم - در انتظار بررسی دادسرا',
          };
        } else if (char.role === 'plaintiff') {
          initialMap[char.id] = {
            status: 'acquitted',
            chargeAndPenalty: 'شاکی پرونده - فاقد مسئولیت کیفری و مستحق جبران خسارت',
          };
        } else {
          initialMap[char.id] = {
            status: 'witness_cleared',
            chargeAndPenalty: 'شاهد/کارشناس معتبر - تایید گزارش و مختومه شدن اتهام',
          };
        }
      });

      setCharacterDecisions(initialMap);
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

  const handleStatusChange = (charId: string, status: 'guilty' | 'acquitted' | 'witness_cleared' | 'investigate_further') => {
    soundManager.playPaperRustle();
    setCharacterDecisions((prev) => ({
      ...prev,
      [charId]: {
        status,
        chargeAndPenalty: prev[charId]?.chargeAndPenalty || (
          status === 'guilty' ? 'محکومیت به مجازات قانونی' :
          status === 'acquitted' ? 'برائت کامل از هرگونه اتهام' :
          status === 'witness_cleared' ? 'شاهد معتبر بدون بار کیفری' :
          'تکمیل تحقیقات مقدماتی'
        ),
      },
    }));
  };

  const handleChargeTextChange = (charId: string, text: string) => {
    setCharacterDecisions((prev) => ({
      ...prev,
      [charId]: {
        ...(prev[charId] || { status: 'guilty' }),
        chargeAndPenalty: text,
      },
    }));
  };

  const handleIssueVerdict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterReasoning.trim() || isSubmitting) return;

    soundManager.playGavel();
    setIsSubmitting(true);

    try {
      // Find the primary guilty defendant if any, or default to first guilty character
      const guiltyEntries = Object.entries(characterDecisions).filter(([_, dec]) => dec.status === 'guilty');
      const primaryGuiltyCharId = guiltyEntries.length > 0 ? guiltyEntries[0][0] : caseData.characters[0]?.id;
      const primaryGuiltyDec = primaryGuiltyCharId ? characterDecisions[primaryGuiltyCharId] : null;

      const individualList: IndividualCharacterVerdict[] = caseData.characters.map((char) => {
        const dec = characterDecisions[char.id] || { status: 'acquitted', chargeAndPenalty: 'بدون حکم' };
        return {
          characterId: char.id,
          characterName: char.name,
          status: dec.status,
          chargeAndPenalty: dec.chargeAndPenalty,
        };
      });

      const res = await onSubmitVerdict(
        primaryGuiltyCharId,
        guiltyEntries.length > 0 ? 'guilty' : 'acquitted',
        masterReasoning,
        primaryGuiltyDec?.chargeAndPenalty || 'مجازات بر اساس دادنامه تایپی جامع',
        guiltyEntries.length > 0 ? 'احراز مجرمیت اشخاص منتسب در دادنامه' : 'برائت عمومی',
        individualList
      );

      if (res) {
        setResult(res);
        if (res.isCorrect) {
          soundManager.playDramaticSting();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRealCase = Boolean(caseData?.realWorldInfo?.isRealCase);

  // Quick judicial reasoning chips
  const quickReasoningChips = [
    'تطبیق گزارش سم‌شناسی و کالبدشکافی با ساعت حضور متهم',
    'رد قاطع ادعای الایبی به دلیل ردیابی دکل مخابراتی و تصاویر دوربین',
    'کشف اثر انگشت و اسناد جعل‌شده در وسایل شخصی متهم',
    'احراز انگیزه مالی و بدهی‌های سنگین ثبت‌شده در پرونده',
    'برائت سایر افراد به دلیل فقدان ادله اثباتی و صداقت در شهادت',
    'رد مال مسروقه و توقیف اموال به نفع شاکیان پرونده',
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
        className="relative w-full max-w-4xl bg-[#12141e] border border-amber-900/40 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-stone-200 max-h-[94vh] flex flex-col cursor-default select-text"
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
              <h3 className="text-xs sm:text-base md:text-lg font-bold text-amber-100 truncate">انشای دادنامه و صدور رأی برای تمامی اشخاص حاضر در دادگاه</h3>
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
            /* Verdict Form: Multi-Person & Fully Typed */
            <form onSubmit={handleIssueVerdict} className="space-y-5 sm:space-y-6">
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-950/20 border border-amber-800/30 text-xs sm:text-sm text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-amber-300 font-bold mb-1">دادرسی جامع و انشای دادنامه برای تمامی اشخاص ({caseData.characters.length} نفر):</strong>
                  جناب قاضی، شما در این بخش می‌توانید درباره تک‌تک اشخاص حاضر در دادگاه تصمیم‌گیری و حکم مکتوب خود را تایپ نمایید. برای هر شخص، وضعیت کیفری را مشخص کرده، مجازات یا دستور قضایی وی را تایپ کنید و در پایان دلایل و گردش‌کار پرونده را انشا فرمایید.
                </div>
              </div>

              {/* Step 1: Multi-Person Decision Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-stone-200 flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-amber-400" />
                    <span>۱. تعیین وضعیت قضایی و حکم تایپی برای هر یک از اشخاص:</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">({caseData.characters.length} شخص احضار شده)</span>
                </div>

                <div className="space-y-3">
                  {caseData.characters.map((char) => {
                    const dec = characterDecisions[char.id] || { status: 'investigate_further', chargeAndPenalty: '' };

                    return (
                      <div
                        key={char.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
                          dec.status === 'guilty'
                            ? 'bg-red-950/20 border-red-500/50 ring-1 ring-red-500/30'
                            : dec.status === 'acquitted'
                            ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                            : dec.status === 'witness_cleared'
                            ? 'bg-blue-950/20 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-[#161826] border-stone-800'
                        }`}
                      >
                        {/* Person Identity Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-100 text-xs sm:text-sm">{char.name}</span>
                            <span className="text-[10px] text-stone-400 font-mono">({char.age} ساله)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-amber-300 border border-stone-700">
                              {char.occupation}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400">
                            سمت: <strong className="text-stone-300">{char.roleTitle}</strong>
                          </span>
                        </div>

                        {/* Status Selection Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(char.id, 'guilty')}
                            className={`py-1.5 px-2 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              dec.status === 'guilty'
                                ? 'bg-red-600 text-white border-red-400 shadow-md shadow-red-950'
                                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-red-300'
                            }`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>احراز مجرمیت</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(char.id, 'acquitted')}
                            className={`py-1.5 px-2 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              dec.status === 'acquitted'
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-emerald-300'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>حکم برائت کامل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(char.id, 'witness_cleared')}
                            className={`py-1.5 px-2 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              dec.status === 'witness_cleared'
                                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950'
                                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-blue-300'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>شاهد معتبر / تبرئه</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(char.id, 'investigate_further')}
                            className={`py-1.5 px-2 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              dec.status === 'investigate_further'
                                ? 'bg-amber-600 text-stone-950 border-amber-400 shadow-md shadow-amber-950'
                                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-amber-300'
                            }`}
                          >
                            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>تکمیل تحقیقات</span>
                          </button>
                        </div>

                        {/* Individual Typed Ruling / Order */}
                        <div className="space-y-1">
                          <label className="text-[11px] text-stone-400 block">
                            عنوان اتهام، میزان مجازات یا دستور قضایی درباره <strong className="text-stone-200">{char.name}</strong> (کاملاً تایپی):
                          </label>
                          <input
                            type="text"
                            value={dec.chargeAndPenalty}
                            onChange={(e) => handleChargeTextChange(char.id, e.target.value)}
                            placeholder={`حکم یا دستور قضایی تایپی درباره ${char.name} (مثلاً: حبس، قصاص، تبرئه کامل، رد مال، صدور قرار منع تعقیب...)`}
                            className="w-full bg-[#11131e] border border-stone-700/80 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Master Comprehensive Judicial Reasoning */}
              <div className="space-y-2.5 pt-2 border-t border-stone-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-stone-200 block">
                    ۲. متن انشای دادنامه، گردش‌کار پرونده و استدلال قضایی قاضی (کاملاً تایپی):
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">جمینای دقت استدلال شما را می‌سنجد</span>
                </div>

                <textarea
                  rows={5}
                  value={masterReasoning}
                  onChange={(e) => setMasterReasoning(e.target.value)}
                  placeholder="جناب قاضی، دلایل جامع حکم، نحوه کشف حقیقت، تناقض‌های شواهد و استنادات علمی به گزارش کالبدشکافی و مدارک پرونده را به صورت تفصیلی تایپ فرمایید..."
                  className="w-full bg-[#0f1118] border border-stone-700 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  required
                />

                {/* Quick reasoning suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-stone-500 self-center">پیشنهادات سریع استدلال:</span>
                  {quickReasoningChips.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMasterReasoning((prev) => prev ? `${prev}\n• ${chip}` : chip);
                        soundManager.playPaperRustle();
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-stone-850 hover:bg-stone-750 text-stone-300 hover:text-amber-300 border border-stone-800 transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seal & Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !masterReasoning.trim()}
                  className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-700 via-amber-700 to-amber-800 hover:from-red-600 hover:to-amber-700 text-stone-100 font-extrabold text-xs sm:text-base shadow-xl shadow-red-950/50 flex items-center justify-center gap-2.5 sm:gap-3 transition-all disabled:opacity-50 cursor-pointer active:scale-98 min-h-[46px]"
                >
                  <Gavel className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  <span>
                    {isSubmitting ? 'در حال ثبت و ارزیابی رأی جامع توسط دیوان عالی (جمینای)...' : 'ختم جلسه دادرسی و صدور قطعی دادنامه برای تمامی اشخاص'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Post-Verdict Truth & Multi-Person Score Reveal */
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

              {/* Individual Character Evaluation Breakdown */}
              {result.individualEvaluations && result.individualEvaluations.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-3">
                  <h4 className="font-bold text-amber-300 text-xs sm:text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>ارزیابی دیوان عالی از تصمیمات شما برای تک‌تک اشخاص:</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.individualEvaluations.map((evalItem, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          evalItem.isCorrectVerdict
                            ? 'bg-emerald-950/20 border-emerald-600/40 text-emerald-200'
                            : 'bg-red-950/20 border-red-600/40 text-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{evalItem.characterName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-900/80">
                            {evalItem.statusSummary}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-300 leading-relaxed font-sans">{evalItem.note}</p>
                      </div>
                    ))}
                  </div>
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
                    <span className="text-amber-400 font-bold block">تحلیل علل تصمیم دادگاه در تاریخ:</span>
                    <p className="whitespace-pre-line text-stone-300/90">{result.historicalComparison.historicalAnalysis}</p>
                  </div>
                </div>
              )}

              {/* Judicial Feedback Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#161826] border border-stone-800 space-y-2 text-xs sm:text-sm">
                <span className="font-bold text-amber-300 block">نظریه دیوان عالی کشور درباره انشای رأی:</span>
                <p className="text-stone-300 leading-relaxed font-sans">{result.feedback}</p>
              </div>

              {/* Truth Revealed Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#181a24] border border-amber-900/40 space-y-2 text-xs sm:text-sm">
                <span className="font-bold text-amber-400 block">شرح کامل حقیقت پنهان پرونده:</span>
                <p className="text-stone-200 leading-relaxed font-serif whitespace-pre-line">{result.truthRevealed}</p>
              </div>

              {/* Culprit Confession Note if any */}
              {result.culpritConfession && (
                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 space-y-1 text-xs sm:text-sm text-red-200">
                  <span className="font-bold text-red-400 block">آخرین دفاعیات و اعتراف مقصر اصلی در دادگاه:</span>
                  <p className="italic font-serif">«{result.culpritConfession}»</p>
                </div>
              )}

              {/* Epilogue */}
              <div className="p-4 rounded-2xl bg-[#131520] border border-stone-800/80 text-xs sm:text-sm text-stone-400 space-y-1">
                <span className="font-bold text-stone-300 block">سرانجام پرونده و اجرای احکام:</span>
                <p className="leading-relaxed">{result.epilogue}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playPaperRustle();
                    setShowVerdictSheet(true);
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/40"
                >
                  <Printer className="w-4 h-4" />
                  <span>مشاهده و چاپ دادنامه رسمی دیوان عالی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playGavel();
                    onStartNewCase();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-red-800 to-amber-800 hover:from-red-700 hover:to-amber-700 text-stone-100 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/40"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>انتخاب پرونده جدید جنایی</span>
                </button>
              </div>

              {/* Official Verdict Document Sheet Modal */}
              <OfficialJudicialSheet
                caseData={caseData}
                verdictResult={result}
                chargeName={result.chargeName}
                penalty={result.penaltyApplied}
                reasoning={masterReasoning}
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
