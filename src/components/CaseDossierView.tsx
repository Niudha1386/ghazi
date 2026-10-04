import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  FlaskConical,
  Eye,
  Scale,
  ShieldCheck,
  Search,
  Sparkles,
  ChevronLeft,
  FileCheck2,
  Users
} from 'lucide-react';
import { CaseDossier, EvidenceItem, Character } from '../types.ts';
import { soundManager } from '../utils/audio.ts';
import { getDynamicCaseLabels } from '../utils/caseHeaders.ts';
import { EvidenceInspectModal } from './EvidenceInspectModal.tsx';
import { OfficialJudicialSheet } from './OfficialJudicialSheet.tsx';

interface CaseDossierViewProps {
  caseData: CaseDossier;
  onSelectCharacterForCourt: (characterId: string) => void;
  onOpenVerdictModal: () => void;
  onPresentEvidenceInCourt: (evidence: EvidenceItem) => void;
}

export const CaseDossierView: React.FC<CaseDossierViewProps> = ({
  caseData,
  onSelectCharacterForCourt,
  onOpenVerdictModal,
  onPresentEvidenceInCourt,
}) => {
  const [inspectedEvidence, setInspectedEvidence] = useState<EvidenceItem | null>(null);
  const [showIndictmentSheet, setShowIndictmentSheet] = useState(false);
  const labels = getDynamicCaseLabels(caseData);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Dossier Header Folder Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#181a24] via-[#141620] to-[#0f1017] border border-amber-900/30 p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Classification Badge */}
        <div className="mb-3 sm:mb-0 sm:absolute sm:top-4 sm:left-6 border border-red-700/50 bg-red-950/40 text-red-400 px-3 py-1 rounded-lg text-[11px] sm:text-xs md:text-sm font-bold tracking-wider uppercase sm:-rotate-2 select-none shadow inline-block">
          {labels.caseClassification}
        </div>

        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-amber-500/40 shadow-lg shadow-amber-950/60 bg-stone-900 shrink-0">
              <img
                src="/images/court_gavel_logo.jpg"
                alt="مهر رسمی پرونده"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-[1.15]"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-amber-400">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  کلاسه: {caseData.caseNumber}
                </span>
                <span className="text-stone-500">•</span>
                <span className="text-stone-300">{caseData.genre}</span>
              </div>
              <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-amber-100 tracking-tight mt-1 truncate sm:whitespace-normal">
                {caseData.title}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs md:text-sm text-stone-400 pt-1">
            <div className="flex items-center gap-1.5 text-stone-300">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500/80" />
              <span>زمان: {caseData.incidentDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500/80" />
              <span>محل: {caseData.location}</span>
            </div>
          </div>
        </div>

        {/* Action quick buttons */}
        <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-stone-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                soundManager.playPaperRustle();
                setShowIndictmentSheet(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 text-xs font-bold border border-amber-600/40 transition-colors cursor-pointer shadow min-h-[42px]"
            >
              <FileCheck2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>مشاهده کیفرخواست رسمی دادسرا</span>
            </button>
            <p className="text-xs text-stone-400 hidden lg:block">
              کلیه مدارک و گزارش‌ها را بررسی و سپس اشخاص را برای بازجویی احضار کنید.
            </p>
          </div>

          <button
            onClick={() => {
              soundManager.playGavel();
              onOpenVerdictModal();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-stone-100 text-xs md:text-sm font-bold shadow-lg shadow-red-950/40 border border-red-500/30 transition-all cursor-pointer min-h-[42px]"
          >
            <Scale className="w-4 h-4 shrink-0" />
            <span>آماده صدور حکم نهایی هستم</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns (Left: Case Incident & Autopsy, Right: Evidence) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Dossier Report & Autopsy (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Incident Report */}
          <div className="rounded-2xl bg-[#141622] border border-stone-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400 font-bold text-base border-b border-stone-800 pb-3">
              <FileText className="w-5 h-5 text-amber-400" />
              <h3>{labels.investigationTitle}</h3>
            </div>

            {/* Victim Profile */}
            <div className="p-4 rounded-xl bg-[#1a1c2b] border border-stone-800 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
                <User className="w-4 h-4 text-red-400" />
                <span>{labels.victimOrPartyLabel} {caseData.victimName}</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                {caseData.victimBackground}
              </p>
            </div>

            {/* Briefing Narrative */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-stone-400">{labels.briefingTitle}</h4>
              <p className="text-sm text-stone-300 leading-relaxed bg-[#11131c] p-4 rounded-xl border border-stone-850 whitespace-pre-line">
                {caseData.briefing}
              </p>
            </div>
          </div>

          {/* Expert & Forensics Report */}
          <div className="rounded-2xl bg-[#141622] border border-emerald-900/30 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
                <FlaskConical className="w-5 h-5 text-emerald-400" />
                <h3>{labels.expertReportTitle}</h3>
              </div>
              <span className="text-xs text-emerald-400/80 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
                {labels.expertBadge}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#191c28] border border-stone-800">
                <span className="text-stone-400 block mb-1 font-medium">{labels.timeLabel}</span>
                <span className="text-stone-200 font-semibold">{caseData.autopsyReport.timeOfDeath}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#191c28] border border-stone-800">
                <span className="text-stone-400 block mb-1 font-medium">{labels.causeOrMethodLabel}</span>
                <span className="text-red-300 font-semibold">{caseData.autopsyReport.causeOfDeath}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#191c28] border border-stone-800 space-y-1">
              <span className="text-xs text-stone-400 font-medium block">{labels.analysisLabel}</span>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {caseData.autopsyReport.toxicology}
              </p>
            </div>

            {caseData.autopsyReport.injuries && caseData.autopsyReport.injuries.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-stone-400 font-medium block">{labels.damagesOrInjuriesLabel}</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {caseData.autopsyReport.injuries.map((inj, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded-lg bg-[#11131c] border border-stone-850 text-stone-300 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span>{inj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-600/30 text-emerald-200 text-xs leading-relaxed">
              <span className="font-bold block mb-1">{labels.expertNoteLabel}</span>
              {caseData.autopsyReport.coronerNotes}
            </div>
          </div>
        </div>

        {/* Right Column: Evidence Dossier Shelf (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#141622] border border-stone-800/80 p-6 shadow-xl space-y-4 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                  <Search className="w-5 h-5 text-amber-400" />
                  <h3>{labels.evidenceSectionTitle} ({caseData.evidence.length})</h3>
                </div>
                <span className="text-xs text-stone-400">بررسی جزئیات</span>
              </div>

              <div className="space-y-3 mt-4">
                {caseData.evidence.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      soundManager.playPaperRustle();
                      setInspectedEvidence(item);
                    }}
                    className="group p-3.5 rounded-xl bg-[#191c28] hover:bg-[#202434] border border-stone-800 hover:border-amber-500/40 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-stone-200 group-hover:text-amber-300 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                        #{item.id}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 line-clamp-2 mt-1.5">
                      {item.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-xs text-amber-400/80">
                      <span className="truncate max-w-[180px] text-stone-400">کشف در: {item.foundAt}</span>
                      <span className="flex items-center gap-1 group-hover:underline">
                        <Eye className="w-3.5 h-3.5" />
                        بررسی مدرک
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl bg-[#181a26]/60 border border-stone-800 text-stone-400 text-xs">
              💡 روی هر مدرک کلیک کنید تا شناسنامه آزمایشگاه جنایی و میزان تطابق آن با ادعای متهمان را مشاهده کنید.
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Bottom Section: Persons in Court (Clean dynamic layout grid for UNRESTRICTED numbers of characters!) */}
      <div className="rounded-3xl bg-[#11131e] border border-stone-800/80 p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Users className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-extrabold text-amber-100">احضار و استنطاق اشخاص حاضر در پرونده ({caseData.characters.length} نفر)</h3>
              <p className="text-xs text-stone-400">کارآگاهان آگاهی اظهارات اولیه این اشخاص را ثبت کرده‌اند. یکی را برای بازجویی حضوری احضار کنید:</p>
            </div>
          </div>
          <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            طراحی پویا
          </span>
        </div>

        {/* Highly responsive layout grid that handles any number of character cards dynamically without breaking! */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {caseData.characters.map((char) => (
            <div
              key={char.id}
              className="group rounded-2xl bg-[#161826] border border-stone-800/80 hover:border-amber-500/40 p-5 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-xl hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <span className="text-base font-extrabold text-stone-100 block group-hover:text-amber-200 transition-colors truncate">{char.name}</span>
                    <span className="text-xs text-stone-400 font-mono">({char.age} ساله)</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-stone-750 bg-stone-800/80 text-stone-300 shrink-0">
                    {char.occupation}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-stone-300 bg-[#10121d] p-3 rounded-xl border border-stone-850">
                  <p className="truncate"><strong className="text-stone-400">{labels.relationLabel}</strong> {char.relationToVictim}</p>
                  <p className="truncate">
                    <strong className="text-stone-400">مزاج و روحیات:</strong>{' '}
                    <span className={char.temperament === 'anxious' ? 'text-red-400 font-bold animate-pulse' : char.temperament === 'calm' ? 'text-emerald-400' : 'text-stone-300'}>
                      {char.temperament === 'anxious' ? 'عصبی و تدافعی' : char.temperament === 'calm' ? 'خونسرد و آرام' : 'معمولی'}
                    </span>
                  </p>
                </div>

                <div className="text-xs text-stone-400 leading-relaxed italic line-clamp-3">
                  {char.initialStatement}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between">
                <span className="text-[11px] text-stone-400 bg-stone-900 px-2 py-1 rounded">
                  وضعیت: منتظر استنطاق
                </span>
                
                <button
                  onClick={() => {
                    soundManager.playGavel();
                    onSelectCharacterForCourt(char.id);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600/10 hover:bg-amber-600/30 text-amber-300 hover:text-amber-200 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer shadow-md"
                >
                  <span>احضار به جایگاه شهود</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectedEvidence && (
        <EvidenceInspectModal
          evidence={inspectedEvidence}
          onClose={() => setInspectedEvidence(null)}
          onPresentInCourt={onPresentEvidenceInCourt}
        />
      )}

      {/* Official Indictment Sheet Modal */}
      <OfficialJudicialSheet
        caseData={caseData}
        type="indictment"
        isOpen={showIndictmentSheet}
        onClose={() => setShowIndictmentSheet(false)}
      />
    </div>
  );
};
