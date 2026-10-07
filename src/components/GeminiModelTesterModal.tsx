import React, { useState } from 'react';
import { Cpu, Activity, CheckCircle2, AlertCircle, RefreshCw, X, Zap, ShieldCheck, Play } from 'lucide-react';
import { soundManager } from '../utils/audio.ts';

interface ModelStatus {
  modelName: string;
  displayName: string;
  description: string;
  status: 'idle' | 'testing' | 'online' | 'error';
  latencyMs?: number;
  responseText?: string;
  error?: string;
}

interface GeminiModelTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastActiveModel?: string;
  lastModelLatency?: number;
}

export const GeminiModelTesterModal: React.FC<GeminiModelTesterModalProps> = ({
  isOpen,
  onClose,
  lastActiveModel,
  lastModelLatency,
}) => {
  const [models, setModels] = useState<ModelStatus[]>([
    {
      modelName: 'gemini-3.8-flash',
      displayName: 'جمینای ۳.۸ فلش (Gemini 3.8 Flash)',
      description: 'هوش اصلی پیشرفته برای بازجویی عمیق، استنتاج سناریو و تحلیل پرونده‌های پیچیده',
      status: 'idle',
    },
    {
      modelName: 'gemini-3.1-pro-preview',
      displayName: 'جمینای ۳.۱ پرو (Gemini 3.1 Pro)',
      description: 'مدل تفکر عمیق پرو (نیازمند اتصال کارت اعتباری/Billing در کنسول گوگل؛ در پلن رایگان سهمیه آن ۰ است)',
      status: 'idle',
    },
    {
      modelName: 'gemini-3.1-flash-lite',
      displayName: 'جمینای ۳.۱ لایت (Gemini 3.1 Flash-Lite)',
      description: 'نسخه فوق‌سریع با مصرف توکن بسیار کم برای جدال‌های لفظی و ارزیابی رأی',
      status: 'idle',
    },
    {
      modelName: 'gemini-flash-latest',
      displayName: 'جمینای فلش آخرین نسخه (Gemini Flash Latest)',
      description: 'لایه پشتیبان پایدار جهت جلوگیری فوری از خطای ۵۰۳ و بار ترافیکی',
      status: 'idle',
    },
  ]);

  const [testingAll, setTestingAll] = useState(false);

  if (!isOpen) return null;

  const testSingleModel = async (modelName: string) => {
    soundManager.playPaperRustle();
    setModels((prev) =>
      prev.map((m) =>
        m.modelName === modelName ? { ...m, status: 'testing', error: undefined, responseText: undefined } : m
      )
    );

    try {
      const res = await fetch('/api/ping-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      });
      const data = await res.json();

      if (data.success) {
        soundManager.playGavel();
        setModels((prev) =>
          prev.map((m) =>
            m.modelName === modelName
              ? {
                  ...m,
                  status: 'online',
                  latencyMs: data.latencyMs,
                  responseText: data.responseText,
                }
              : m
          )
        );
      } else {
        setModels((prev) =>
          prev.map((m) =>
            m.modelName === modelName
              ? {
                  ...m,
                  status: 'error',
                  latencyMs: data.latencyMs,
                  error: data.error || 'خطای اتصال به سرور گوگل',
                }
              : m
          )
        );
      }
    } catch (err: any) {
      setModels((prev) =>
        prev.map((m) =>
          m.modelName === modelName
            ? {
                ...m,
                status: 'error',
                error: err?.message || 'خطای دسترسی به اینترنت',
              }
            : m
        )
      );
    }
  };

  const testAllModels = async () => {
    setTestingAll(true);
    soundManager.playPaperRustle();
    for (const model of models) {
      await testSingleModel(model.modelName);
    }
    setTestingAll(false);
  };

  const handleClose = () => {
    soundManager.playPaperRustle();
    onClose();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0f111c] border border-amber-900/50 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-stone-200 cursor-default select-text flex flex-col max-h-[92dvh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-[#181b29] to-[#131522] border-b border-stone-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-amber-100 flex items-center gap-2">
                <span>تست اتصال و مانیتورینگ چندنسخه‌ای جمینای</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-normal">
                  سیستم ضد ۵۰۳
                </span>
              </h3>
              <p className="text-[11px] text-stone-400 truncate">
                بررسی تک‌تک نسخه‌های فعال هوش مصنوعی و وضعیت بارگذاری زنده
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors cursor-pointer shrink-0"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Active Model Banner */}
        {lastActiveModel && (
          <div className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-amber-950/40 via-[#181a26] to-[#12141f] border-b border-amber-800/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>آخرین مدل پاسخ‌دهنده در بازی:</span>
              <strong className="font-mono text-amber-100">{lastActiveModel}</strong>
            </div>
            {lastModelLatency !== undefined && (
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                {lastModelLatency}ms
              </span>
            )}
          </div>
        )}

        {/* Content Body: List of Models */}
        <div className="p-3.5 sm:p-6 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          {models.map((item) => (
            <div
              key={item.modelName}
              className="p-3.5 sm:p-4 rounded-2xl bg-[#141624] border border-stone-800/80 hover:border-amber-500/30 transition-all space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/60 pb-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-stone-100">{item.displayName}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400/70 block mt-0.5">{item.modelName}</span>
                </div>

                {/* Status Indicator & Test Button */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {item.status === 'online' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-xl shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>متصل ({item.latencyMs}ms)</span>
                    </span>
                  )}

                  {item.status === 'error' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 border border-red-800 px-2.5 py-1 rounded-xl shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>خطای پاسخ</span>
                    </span>
                  )}

                  {item.status === 'testing' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-xl animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال تست...</span>
                    </span>
                  )}

                  <button
                    onClick={() => testSingleModel(item.modelName)}
                    disabled={item.status === 'testing' || testingAll}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-750 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>تست اتصال</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-stone-400 leading-relaxed">{item.description}</p>

              {item.responseText && (
                <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-[11px] text-emerald-300 font-mono">
                  پاسخ دریافتی: "{item.responseText}"
                </div>
              )}

              {item.error && (
                <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-800/40 text-[11px] text-red-300 font-mono">
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#10121d] border-t border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            onClick={testAllModels}
            disabled={testingAll}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {testingAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال تست تمام نسخه‌ها...</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                <span>تست همزمان تمام مدل‌های جمینای</span>
              </>
            )}
          </button>

          <button
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 border border-stone-750 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center min-h-[44px]"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
