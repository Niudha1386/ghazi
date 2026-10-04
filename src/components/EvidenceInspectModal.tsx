import React, { useEffect } from 'react';
import { X, Search, ShieldAlert, FileText, FlaskConical, Cpu, ArrowLeft } from 'lucide-react';
import { EvidenceItem } from '../types.ts';
import { soundManager } from '../utils/audio.ts';

interface EvidenceInspectModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
  onPresentInCourt?: (evidence: EvidenceItem) => void;
}

export const EvidenceInspectModal: React.FC<EvidenceInspectModalProps> = ({
  evidence,
  onClose,
  onPresentInCourt,
}) => {
  useEffect(() => {
    if (!evidence) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playPaperRustle();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [evidence, onClose]);

  if (!evidence) return null;

  const getTypeIcon = (type: EvidenceItem['type']) => {
    switch (type) {
      case 'forensic':
        return <FlaskConical className="w-5 h-5 text-emerald-400" />;
      case 'document':
        return <FileText className="w-5 h-5 text-amber-400" />;
      case 'digital':
        return <Cpu className="w-5 h-5 text-cyan-400" />;
      default:
        return <ShieldAlert className="w-5 h-5 text-red-400" />;
    }
  };

  const getTypeName = (type: EvidenceItem['type']) => {
    switch (type) {
      case 'forensic':
        return 'مدرک پزشکی قانونی و سم‌شناسی';
      case 'document':
        return 'سند مکتوب و کارشناسی خط';
      case 'digital':
        return 'شواهد سایبری و دیجیتال';
      default:
        return 'مدرک مادی و فیزیکی صحنه جرم';
    }
  };

  const handleClose = () => {
    soundManager.playPaperRustle();
    onClose();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#13151f] border border-amber-900/40 rounded-2xl shadow-2xl overflow-hidden text-stone-200 cursor-default select-text"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#1c1f2e] to-[#161824] border-b border-stone-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              {getTypeIcon(evidence.type)}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-medium text-amber-400/80 block truncate">{getTypeName(evidence.type)}</span>
              <h3 className="text-sm sm:text-lg font-bold text-amber-100 truncate">{evidence.title}</h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-colors cursor-pointer shrink-0"
            title="بستن (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs sm:text-sm">
          {/* Stamp & ID */}
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2.5 sm:pb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-stone-800 text-stone-300 border border-stone-700">
                کد ثبت مدرک: #{evidence.id}
              </span>
            </div>
            <div className="px-2.5 py-0.5 rounded border border-red-700/60 bg-red-950/40 text-red-400 font-bold text-[11px] uppercase tracking-wider shadow-sm">
              مدرک توقیفی دادسرا
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-semibold text-stone-400 mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              شرح دقیق شیء و موقعیت کشف:
            </h4>
            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed bg-[#181a26] p-3 sm:p-3.5 rounded-xl border border-stone-800">
              {evidence.description}
            </p>
          </div>

          {/* Found At */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div className="bg-[#181a26] p-2.5 sm:p-3 rounded-xl border border-stone-800/80">
              <span className="text-[11px] sm:text-xs text-stone-400 block mb-0.5">محل کشف در صحنه جرم:</span>
              <span className="text-xs sm:text-sm font-medium text-amber-200">{evidence.foundAt}</span>
            </div>
            <div className="bg-[#181a26] p-2.5 sm:p-3 rounded-xl border border-stone-800/80">
              <span className="text-[11px] sm:text-xs text-stone-400 block mb-0.5">نوع طبقه‌بندی:</span>
              <span className="text-xs sm:text-sm font-medium text-stone-300">{getTypeName(evidence.type)}</span>
            </div>
          </div>

          {/* Significance */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-semibold text-stone-400 mb-1">اهمیت جنایی و بار اثباتی:</h4>
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/30 text-amber-200/90 text-xs sm:text-sm leading-relaxed">
              {evidence.significance}
            </div>
          </div>

          {/* Lab Report if present */}
          {evidence.labReport && (
            <div>
              <h4 className="text-[11px] sm:text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" />
                نتیجه آزمایشگاه تشخیص هویت و بالستیک:
              </h4>
              <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm leading-relaxed font-mono">
                {evidence.labReport}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#11131c] border-t border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer border border-stone-700 text-center min-h-[42px]"
          >
            بستن پرونده مدرک
          </button>

          {onPresentInCourt && (
            <button
              onClick={() => {
                soundManager.playDramaticSting();
                onPresentInCourt(evidence);
                onClose();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-900 font-bold text-xs sm:text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer min-h-[42px]"
            >
              <span>ارائه این مدرک در صحن بازجویی</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
