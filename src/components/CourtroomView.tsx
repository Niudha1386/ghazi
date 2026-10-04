import React, { useState, useRef, useEffect } from 'react';
import {
  Gavel,
  Send,
  AlertOctagon,
  ShieldAlert,
  Flame,
  UserCheck,
  FileSearch,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Volume2,
  FolderOpen,
  Scale,
  Mic,
  Activity,
  FileSignature,
  Heart,
  Skull
} from 'lucide-react';
import { CaseDossier, Character, EvidenceItem, InterrogationMessage } from '../types.ts';
import { soundManager } from '../utils/audio.ts';

interface CourtroomViewProps {
  caseData: CaseDossier;
  activeCharacterId: string;
  onSelectCharacter: (charId: string) => void;
  messages: InterrogationMessage[];
  onSendMessage: (text: string, evidenceId?: string) => Promise<void>;
  isLoading: boolean;
  onGavelClick: () => void;
  characterStressMap: Record<string, number>;
  selectedEvidenceToConfront: EvidenceItem | null;
  setSelectedEvidenceToConfront: (item: EvidenceItem | null) => void;
  onOpenDossier?: () => void;
  onOpenVerdict?: () => void;
  isDisputeActive: boolean;
}

export const CourtroomView: React.FC<CourtroomViewProps> = ({
  caseData,
  activeCharacterId,
  onSelectCharacter,
  messages,
  onSendMessage,
  isLoading,
  onGavelClick,
  characterStressMap,
  selectedEvidenceToConfront,
  setSelectedEvidenceToConfront,
  onOpenDossier,
  onOpenVerdict,
  isDisputeActive,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEvidenceSelector, setShowEvidenceSelector] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeChar = caseData.characters.find((c) => c.id === activeCharacterId) || caseData.characters[0];
  const currentStress = characterStressMap[activeChar.id] ?? activeChar.suspicionLevel;

  // Auto-scroll chat to bottom strictly within the container, leaving the main window scroll untouched
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading, isDisputeActive]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedEvidenceToConfront) || isLoading || isDisputeActive) return;

    const query = inputText.trim() || `در خصوص مدرک «${selectedEvidenceToConfront?.title}» چه توضیحی در محضر دادگاه دارید؟`;
    const evId = selectedEvidenceToConfront ? selectedEvidenceToConfront.id : undefined;

    setInputText('');
    setSelectedEvidenceToConfront(null);
    setShowEvidenceSelector(false);

    soundManager.playPaperRustle();
    await onSendMessage(query, evId);
  };

  // Quick tactical questions for judge
  const quickQuestions = [
    'در ساعت وقوع قتل دقیقاً کجا بودید و چه شاهدی دارید؟',
    'چطور کشف این مدرک در صحنه جرم را انکار می‌کنید؟',
    'انگیزه مالی یا اختلافات قبلی شما با مقتول برای دادگاه محرز است!',
    'به شرافت خود سوگند یاد کنید و حقیقت را بدون فریبکاری بگویید!',
  ];

  return (
    <div className="relative min-h-[calc(100vh-80px)] py-4 px-2 sm:px-4 md:px-6 animate-in fade-in duration-300">
      {/* Real Courtroom Background with Moody Dark Vignette */}
      <div
        className="fixed inset-0 bg-cover bg-center pointer-events-none -z-20 opacity-35 filter brightness-50 contrast-125"
        style={{ backgroundImage: `url('/images/courtroom_hall_bg.jpg')` }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-[#08090e] via-[#0b0d14]/90 to-[#08090e]/95 pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-4">
        {/* Judicial Bench Header Bar */}
        <div className="bg-[#12141f]/90 backdrop-blur-md border border-amber-900/40 rounded-2xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-500/50 shadow-md shrink-0 bg-stone-900">
              <img
                src="/images/court_gavel_logo.jpg"
                alt="لوگو دادگاه"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-[1.15]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-amber-400 font-bold">کلاسه: {caseData.caseNumber}</span>
                <span className="text-stone-500">•</span>
                <span className="text-xs text-stone-300">{caseData.genre}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-amber-100 truncate max-w-sm sm:max-w-xl">
                {caseData.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenDossier && (
              <button
                onClick={() => {
                  soundManager.playPaperRustle();
                  onOpenDossier();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>اوراق پرونده و کالبدشکافی</span>
              </button>
            )}

            {onOpenVerdict && (
              <button
                onClick={() => {
                  soundManager.playDramaticSting();
                  onOpenVerdict();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 text-red-100 text-xs font-bold border border-red-500/40 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
              >
                <FileSignature className="w-3.5 h-3.5 text-red-300" />
                <span>انشای حکم و صدور رأی</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Gavel Control Warning Banner (Heated dispute Active) */}
        {isDisputeActive && (
          <div className="bg-gradient-to-r from-red-950 via-[#220c11] to-red-950 border-2 border-red-500 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-pulse shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-red-600/10 rounded-full blur-2xl" />
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-red-500 animate-bounce shrink-0" />
              <div>
                <strong className="block text-sm sm:text-base text-red-200">🚨 تنش بالا و درگیری لفظی متهمان در صحن دادگاه!</strong>
                <span className="text-xs text-stone-300">متهمین خشمگین در حال قطع کردن حرف هم و اتهام‌زنی پیاپی هستند. چکش قاضی را بکوبید تا به آنها فرمان سکوت دهید!</span>
              </div>
            </div>
            <button
              onClick={onGavelClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs md:text-sm font-extrabold transition-all cursor-pointer shadow-lg shadow-red-950/40 border border-red-400"
            >
              <Gavel className="w-4 h-4 text-white" />
              <span>کوبیدن چکش و اعلام سکوت</span>
            </button>
          </div>
        )}

        {/* Character Summon Dock (Judicial Bench View) - Dynamic character list with no spoilers */}
        <div className="bg-[#12141f]/90 backdrop-blur-md border border-stone-800/90 rounded-2xl p-3 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2.5 text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" />
              👥 سالن عمومی دادگاه (برای مخاطب قرار دادن سریع، روی نام شخص کلیک کنید):
            </span>
            <span className="text-stone-400 text-[11px]">
              تمرکز فعلی روی: <strong className="text-amber-200">{activeChar.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {caseData.characters.map((char) => {
              const isSelected = char.id === activeChar.id;

              return (
                <button
                  key={char.id}
                  disabled={isDisputeActive}
                  onClick={() => {
                    soundManager.playGavel();
                    onSelectCharacter(char.id);
                    // Pre-fill the input box with their name to easily address them!
                    setInputText(`${char.name}، `);
                  }}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden ${
                    isDisputeActive ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#24293e] to-[#1a1e2f] border-amber-500 shadow-lg shadow-amber-950/40 ring-2 ring-amber-500/40'
                      : 'bg-[#151724]/90 border-stone-800/80 hover:bg-[#1b1e2e] hover:border-stone-700'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                  )}

                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-stone-100 truncate block">{char.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono shrink-0">({char.age} ساله)</span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded text-[9px] border border-stone-700/80 bg-stone-800/60 text-stone-300 truncate max-w-[110px]" title={char.occupation}>
                      {char.occupation}
                    </span>
                    <span className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>حاضر در دادگاه</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Trial Hall & Interrogation Dock */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Interrogation Stand & Dialogue Stream (8 cols) */}
          <div className="lg:col-span-8 flex flex-col h-[500px] sm:h-[580px] md:h-[640px] bg-[#11131c]/95 backdrop-blur-md border border-stone-800/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            {/* Accused Stand Header */}
            <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-gradient-to-r from-[#1c1f2e] via-[#161826] to-[#121420] border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 relative shadow-inner shrink-0">
                  <Mic className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="font-bold text-stone-100 text-xs sm:text-base truncate">{activeChar.name}</h3>
                    <span className="text-[10px] text-stone-400 font-mono">({activeChar.age} ساله)</span>
                    <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border border-stone-750 bg-stone-800/80 text-stone-300 font-medium shrink-0">
                      {activeChar.occupation}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-stone-400 truncate">ارتباط در ماجرا: {activeChar.relationToVictim}</p>
                </div>
              </div>

              {/* Stress & Nervous Tremor Meter for current testifying person */}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-[#181a28] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border border-stone-800 shadow-sm shrink-0">
                <Activity className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${currentStress > 70 ? 'text-red-500 animate-bounce' : 'text-amber-400'}`} />
                <div className="text-right">
                  <span className="text-[9px] sm:text-[10px] text-stone-400 block font-medium">نبض و اضطراب بیان:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-14 sm:w-20 h-1.5 sm:h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          currentStress > 75 ? 'bg-red-500' : currentStress > 45 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, currentStress))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trial Speech Scroll Area */}
            <div ref={chatContainerRef} className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto space-y-3 sm:space-y-4 custom-scrollbar bg-[#0d0e16]/85">
              {/* Initial Statement Record */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#161826]/80 border border-stone-800/80 text-xs text-stone-300 space-y-1 shadow-sm">
                <span className="text-amber-400 font-bold block text-[11px] sm:text-xs">متن اظهارات اولیه ثبت‌شده در دادگاه:</span>
                <p className="italic text-stone-300/90 leading-relaxed font-serif text-[11px] sm:text-xs">
                  «{activeChar.initialStatement}»
                </p>
              </div>

              {messages.length === 0 && (
                <div className="text-center py-10 sm:py-14 text-stone-500 text-xs md:text-sm space-y-2">
                  <Mic className="w-7 h-7 sm:w-8 sm:h-8 mx-auto text-stone-600 animate-pulse" />
                  <p>شخص در تایید اظهارات سوگند یاد کرده است. سوال خود را مطرح کنید یا مدرکی جهت مواجهه ارائه دهید.</p>
                </div>
              )}

              {/* Live Dialogue Exchange - Unified Group Chat Stream! */}
              {messages.map((msg) => {
                const isJudge = msg.sender === 'judge';
                const isLawyer = msg.sender === 'lawyer';
                const isDispute = msg.sender === 'dispute_character';

                if (isLawyer) {
                  return (
                    <div key={msg.id} className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-blue-950/20 border border-blue-600/40 text-xs text-blue-200 space-y-1 my-2 shadow-md animate-in slide-in-from-left duration-200">
                      <span className="font-bold flex items-center gap-1.5 text-blue-400 text-[11px] sm:text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        اعتراض رسمی در صحن دادگاه ({msg.senderName}):
                      </span>
                      <p className="leading-relaxed font-serif text-[11px] sm:text-xs">{msg.text}</p>
                    </div>
                  );
                }

                if (isDispute) {
                  return (
                    <div key={msg.id} className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-red-950/20 border border-red-500/40 text-xs text-red-200 space-y-1 my-2 shadow-md animate-in slide-in-from-left duration-200">
                      <span className="font-bold flex items-center gap-1.5 text-red-400 text-[11px] sm:text-xs">
                        <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 animate-pulse shrink-0" />
                        مداخله تند در جلسه ({msg.senderName}):
                      </span>
                      <p className="leading-relaxed font-serif text-[11px] sm:text-xs">{msg.text}</p>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isJudge ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <span className="text-[10px] sm:text-[11px] text-stone-400 font-medium px-1">
                      {msg.senderName}
                    </span>

                    <div
                      className={`max-w-[92%] sm:max-w-[85%] md:max-w-[78%] p-3 sm:p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-lg ${
                        isJudge
                          ? 'bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 text-amber-50 rounded-br-none border border-amber-600/40'
                          : 'bg-[#1b1e2c] text-stone-200 rounded-bl-none border border-stone-700/80 font-serif'
                      }`}
                    >
                      {/* Evidence Tag if presented */}
                      {msg.evidencePresented && (
                        <div className="mb-2 p-1.5 sm:p-2 rounded-lg bg-black/40 border border-amber-500/40 text-amber-200 text-[11px] sm:text-xs flex items-center gap-1.5 shadow-sm">
                          <FileSearch className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>ارائه مدرک جرم: <strong>{msg.evidencePresented.title}</strong></span>
                        </div>
                      )}

                      <p className="whitespace-pre-line text-[11px] sm:text-xs md:text-sm">{msg.text}</p>

                      {/* Confession & Breakdown Banner */}
                      {msg.isConfession && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-red-950 via-[#310c14] to-red-950 border-2 border-red-500 text-red-200 text-[11px] sm:text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                          <Flame className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
                          <span>🚨 فروپاشی روانی و اعتراف صریح در برابر شواهد قاطع دادگاه!</span>
                        </div>
                      )}

                      {/* Slip-up reveal */}
                      {msg.slipUp && !msg.isConfession && (
                        <div className="mt-2 p-2 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 shadow-inner">
                          <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>تناقض و لغزش کلامی: {msg.slipUp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-[#1c1f2e] border border-stone-800 text-[11px] sm:text-xs text-stone-300 w-fit animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>شخص در حال پاسخگویی به هیئت دادگاه است...</span>
                </div>
              )}
            </div>

            {/* Trial Action Board & Input Form */}
            <div className="p-3 sm:p-4 bg-[#141624] border-t border-stone-800 space-y-2.5 shrink-0">
              {/* Quick Questions (horizontal scroll) */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    disabled={isLoading || isDisputeActive}
                    onClick={() => {
                      setInputText(q);
                      soundManager.playPaperRustle();
                    }}
                    className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-lg bg-stone-900/90 hover:bg-stone-850 text-stone-300 hover:text-amber-300 border border-stone-800 transition-colors cursor-pointer text-right whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Chat Form */}
              <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setShowEvidenceSelector(!showEvidenceSelector)}
                    disabled={isDisputeActive}
                    className={`px-3 py-2 sm:py-2.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[40px] ${
                      selectedEvidenceToConfront
                        ? 'bg-amber-600 border-amber-500 text-stone-950 shadow shadow-amber-500/20'
                        : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-850'
                    } ${isDisputeActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <FileSearch className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {selectedEvidenceToConfront ? `مدرک #${selectedEvidenceToConfront.id}` : 'پیوست مدرک'}
                    </span>
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading || isDisputeActive}
                    placeholder={
                      isDisputeActive
                        ? '⚠️ درگیری فعال است! چکش را بکوبید.'
                        : 'متن سوال را بنویسید یا شخص را صدا بزنید...'
                    }
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-stone-950 text-stone-200 text-xs sm:text-sm border border-stone-800/80 focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-60 min-h-[40px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isDisputeActive || (!inputText.trim() && !selectedEvidenceToConfront)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 min-h-[40px]"
                >
                  <span>استنطاق</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar: Evidence Selector Drawer & Suspect Profile Detail (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Show Evidence Selector Overlay in place if active */}
            {showEvidenceSelector && (
              <div className="bg-[#121420] border border-amber-900/40 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col justify-between animate-in slide-in-from-right duration-250">
                <div>
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <FileSearch className="w-4 h-4" />
                      انتخاب مدرک جرم جهت مواجهه:
                    </span>
                    <button
                      onClick={() => setShowEvidenceSelector(false)}
                      className="text-stone-400 hover:text-stone-200 text-xs"
                    >
                      بستن کشو
                    </button>
                  </div>

                  <div className="space-y-2 mt-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    {caseData.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          soundManager.playPaperRustle();
                          setSelectedEvidenceToConfront(ev);
                          setShowEvidenceSelector(false);
                        }}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          selectedEvidenceToConfront?.id === ev.id
                            ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                            : 'bg-[#171926] border-stone-850 hover:bg-[#1f2233] text-stone-300'
                        }`}
                      >
                        <h4 className="text-xs font-bold">{ev.title}</h4>
                        <p className="text-[10px] text-stone-400 truncate mt-1">کشف در: {ev.foundAt}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-800 mt-4 text-[11px] text-stone-400">
                  پس از انتخاب مدرک، سوال خود را ارسال کنید تا شخص درباره نحوه ارتباط خود با مدرک توضیح دهد.
                </div>
              </div>
            )}

            {!showEvidenceSelector && (
              <>
                {/* Active summoned person background sheet */}
                <div className="bg-[#12141f]/95 border border-stone-800/90 rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-stone-800 pb-3 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="font-bold text-amber-100 text-xs">پرونده شخص حاضر در تریبون:</h3>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-300 leading-relaxed bg-[#171925] p-4 rounded-2xl border border-stone-850 shadow-inner">
                    <p><strong className="text-amber-400">نام متهم/شاهد:</strong> {activeChar.name}</p>
                    <p><strong className="text-amber-400">شغل رسمی:</strong> {activeChar.occupation}</p>
                    <p><strong className="text-amber-400">سن:</strong> {activeChar.age} سال</p>
                    <p><strong className="text-amber-400">رابطه با قربانی:</strong> {activeChar.relationToVictim}</p>
                    <p>
                      <strong className="text-amber-400">تیپ مزاجی و روحی:</strong>{' '}
                      <span className={activeChar.temperament === 'anxious' ? 'text-red-400 font-extrabold animate-pulse' : activeChar.temperament === 'calm' ? 'text-emerald-400 font-bold' : 'text-stone-300'}>
                        {activeChar.temperament === 'anxious' ? 'عصبی و زودرنج (ریسک بالای درگیری)' : activeChar.temperament === 'calm' ? 'خونسرد و صبور' : 'معمولی'}
                      </span>
                    </p>
                    <p className="pt-2 border-t border-stone-800"><strong className="text-amber-400">روانشناسی کاراکتر:</strong> {activeChar.personality}</p>
                  </div>

                  <div className="bg-amber-950/20 border border-amber-600/30 p-3.5 rounded-2xl text-[11px] leading-relaxed text-amber-200">
                    <strong className="block mb-1">💡 راهنمای قاضی:</strong>
                    شاهدان و وکلای مدافع معمولاً راستگو هستند، اما در صورت اثبات تناقض با مدارک علمی پزشکی قانونی، متهمین مجبور به اعتراف یا خطای کلامی خواهند شد.
                  </div>
                </div>

                {/* Autopsy quick panel reference */}
                <div className="bg-[#12141f]/95 border border-stone-800/90 rounded-3xl p-5 shadow-xl space-y-2.5">
                  <div className="border-b border-stone-800 pb-2.5 flex items-center gap-2">
                    <Skull className="w-4 h-4 text-red-400 shrink-0" />
                    <h3 className="font-bold text-red-200 text-xs">گزارش پزشکی قانونی (مرجع علمی):</h3>
                  </div>
                  <div className="text-xs text-stone-400 space-y-1 bg-[#171925] p-3 rounded-xl border border-stone-850">
                    <p><strong className="text-stone-300">علت فوت:</strong> {caseData.autopsyReport.causeOfDeath}</p>
                    <p><strong className="text-stone-300">زمان مرگ:</strong> {caseData.autopsyReport.timeOfDeath}</p>
                  </div>
                  <p className="text-[10px] text-stone-400 italic">
                    {caseData.autopsyReport.coronerNotes}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
