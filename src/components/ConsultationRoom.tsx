import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  FolderPlus,
  RefreshCw,
  Library,
  Flame,
  ArrowRight,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { CaseDossier } from '../types.ts';
import { soundManager } from '../utils/audio.ts';

interface ConsultationRoomProps {
  onCaseGenerated: (newCase: CaseDossier) => void;
  presetCases: CaseDossier[];
  onSelectPresetCase: (preset: CaseDossier) => void;
}

export const ConsultationRoom: React.FC<ConsultationRoomProps> = ({
  onCaseGenerated,
  presetCases,
  onSelectPresetCase,
}) => {
  const [topicInput, setTopicInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  const quickTopics = [
    { title: 'قتل بازیکن فوتبال', icon: '⚽', desc: 'جنایت مرموز در رختکن ورزشگاه قبلا از بازی فینال' },
    { title: 'مسمومیت ستاره سینما', icon: '🎬', desc: 'مرگ مشکوک بازیگر مطرح در جشنواره فیلم' },
    { title: 'اختلاس و قتل در هلدینگ نفتی', icon: '💰', desc: 'قتل مدیر مالی قبل از افشای حساب‌های مخفی' },
    { title: 'سقوط از کشتی تفریحی', icon: '🛥️', desc: 'ناپدید شدن مدیر بانک در آب‌های خلیج فارس' },
    { title: 'جنایت در آزمایشگاه ژنتیک', icon: '🧬', desc: 'مسمومیت پژوهشگر ارشد و سرقت فرمول دارویی' },
    { title: 'سرقت طلاجات و قتل گالری‌دار', icon: '💎', desc: 'قتل کلکسیونر عتیقه و ناپدید شدن الماس زرین' },
  ];

  const handleCreateCase = async (overrideTopic?: string) => {
    const selectedTopic = (overrideTopic || topicInput).trim();
    if (!selectedTopic || isGenerating) return;

    soundManager.playGavel();
    setIsGenerating(true);
    setGenerationStep(`در حال ارسال موضوع «${selectedTopic}» به هوش مصنوعی جمینای...`);

    const t1 = setTimeout(() => {
      setGenerationStep('خلق داستان جنایی، تنظیم هویت متهمان، شاکی و وکیل مدافع...');
    }, 1200);

    const t2 = setTimeout(() => {
      setGenerationStep('تدوین گزارش کالبدشکافی، شواهد آزمایشگاهی و ترفند فریبکارانه متهم...');
    }, 2800);

    try {
      const response = await fetch('/api/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicText: selectedTopic,
          customIdea: selectedTopic,
        }),
      });

      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }

      const newCaseData: any = await response.json();

      // Guard against malformed or error payloads
      if (!newCaseData || !newCaseData.title || !Array.isArray(newCaseData.characters) || newCaseData.characters.length === 0) {
        throw new Error('ساختار اطلاعات پرونده ناقص است.');
      }

      soundManager.playDramaticSting();
      onCaseGenerated(newCaseData);
    } catch (err) {
      console.error('Error generating case:', err);
      if (presetCases && presetCases.length > 0) {
        onSelectPresetCase(presetCases[0]);
      }
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#181a28] via-[#131522] to-[#0d0e17] border border-amber-900/40 p-4 sm:p-6 md:p-10 shadow-2xl relative overflow-hidden text-center space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          <span>طراحی آنی و هوشمند پرونده با جمینای</span>
        </div>

        <h1 className="text-xl sm:text-2xl md:text-4xl font-black text-amber-100 tracking-tight">
          چه پرونده‌ای می‌خواهید امروز قضاوت کنید؟
        </h1>

        <p className="text-[11px] sm:text-xs md:text-sm text-stone-400 max-w-2xl mx-auto leading-relaxed">
          فقط موضوع یا کلمه کلیدی پرونده مورد نظرتان را بنویسید (مثلاً: <strong className="text-amber-300">قتل بازیکن فوتبال</strong> یا <strong className="text-amber-300">سرقت الماس</strong>). جمینای در چند ثانیه تمام سناریو، اشخاص، متهم فریبکار و مدارک را خلق می‌کند!
        </p>

        {/* Instant Topic Input Area */}
        <div className="max-w-2xl mx-auto pt-2 sm:pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#0f1118] p-1.5 sm:p-2 rounded-2xl border-2 border-amber-600/40 shadow-xl focus-within:border-amber-500 transition-colors">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCase();
                }
              }}
              placeholder="موضوع پرونده را بنویسید (مثلاً: قتل بازیکن فوتبال...)"
              disabled={isGenerating}
              className="flex-1 bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-stone-100 placeholder-stone-500 focus:outline-none w-full"
            />

            <button
              onClick={() => handleCreateCase()}
              disabled={isGenerating || !topicInput.trim()}
              className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950/50 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-98 min-h-[44px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-stone-950" />
                  <span>در حال خلق...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950" />
                  <span>ساخت هوشمند پرونده</span>
                </>
              )}
            </button>
          </div>

          {/* Loading status bar */}
          {isGenerating && (
            <div className="p-3 sm:p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-[11px] sm:text-xs text-amber-200 flex items-center justify-center gap-2.5 sm:gap-3 animate-pulse shadow-lg">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-spin shrink-0" />
              <span className="font-semibold">{generationStep}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Topic Chips Suggestions */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
          <Flame className="w-4 h-4 text-amber-400" />
          <span>پیشنهادهای محبوب آماده برای کلیک مستقیم:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {quickTopics.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTopicInput(item.title);
                handleCreateCase(item.title);
              }}
              disabled={isGenerating}
              className="p-4 rounded-2xl bg-[#141622] hover:bg-[#1b1e2e] border border-stone-800 hover:border-amber-500/50 text-right transition-all cursor-pointer group shadow-lg flex flex-col justify-between space-y-2 active:scale-98"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/20">
                  خلق مستقیم
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preset Offline Cases */}
      <div className="pt-4 border-t border-stone-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
            <Library className="w-4 h-4 text-amber-400" />
            <span>پرونده‌های کلاسیک موجود در آرشیو:</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presetCases.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-2xl bg-[#121420] border border-stone-800/80 hover:border-amber-500/30 transition-all space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-stone-200">{preset.title}</span>
                  <span className="font-mono text-amber-400 text-[11px] px-2 py-0.5 rounded bg-stone-800">
                    {preset.caseNumber}
                  </span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                  {preset.briefing}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    soundManager.playGavel();
                    onSelectPresetCase(preset);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>ورود به این پرونده</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
