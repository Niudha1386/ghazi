import React, { useState, useEffect, useRef } from 'react';
import { PRESET_CASES } from './data/presets.ts';
import { CaseDossier, EvidenceItem, InterrogationMessage, VerdictResult, IndividualCharacterVerdict, SavedCaseState } from './types.ts';
import { soundManager } from './utils/audio.ts';
import { Navbar } from './components/Navbar.tsx';
import { CaseDossierView } from './components/CaseDossierView.tsx';
import { CourtroomView } from './components/CourtroomView.tsx';
import { VerdictModal } from './components/VerdictModal.tsx';
import { ConsultationRoom } from './components/ConsultationRoom.tsx';
import { MainMenu } from './components/MainMenu.tsx';
import { SettingsModal, SettingsTab } from './components/SettingsModal.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { saveActiveCaseSession, getActiveCaseSession, clearActiveCaseSession, archiveCaseSession } from './utils/storage.ts';
import { Home, Sparkles, Settings, Volume2 } from 'lucide-react';

export default function App() {
  // App views: 'menu' (lobby) | 'consult' (dedicated standalone design room) | 'game' (active courtroom session)
  const [currentView, setCurrentView] = useState<'menu' | 'consult' | 'game'>('menu');
  const [currentTab, setCurrentTab] = useState<'dossier' | 'court' | 'verdict'>('court');

  // Consolidated Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('pwa');

  const handleOpenSettings = (tab?: SettingsTab) => {
    soundManager.playPaperRustle();
    if (tab) setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // Case loaded
  const [caseData, setCaseData] = useState<CaseDossier | null>(null);
  const [presetCases, setPresetCases] = useState<CaseDossier[]>(PRESET_CASES);

  const [activeCharacterId, setActiveCharacterId] = useState<string>('');
  const [characterStressMap, setCharacterStressMap] = useState<Record<string, number>>({});
  
  // Single Unified Group Chat stream for all courtroom dialogue Sequential Log!
  const [courtroomMessages, setCourtroomMessages] = useState<InterrogationMessage[]>([]);
  
  const [selectedEvidenceToConfront, setSelectedEvidenceToConfront] = useState<EvidenceItem | null>(null);
  const [isVerdictModalOpen, setIsVerdictModalOpen] = useState(false);
  const [lastActiveModel, setLastActiveModel] = useState<string>('gemini-3.8-flash');
  const [lastModelLatency, setLastModelLatency] = useState<number | undefined>(undefined);

  const [gavelAnimating, setGavelAnimating] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [isInterrogating, setIsInterrogating] = useState(false);

  // Heated Dispute states
  const [isDisputeActive, setIsDisputeActive] = useState(false);
  const [isDisputeLoading, setIsDisputeLoading] = useState(false);
  const [disputeTimeoutIds, setDisputeTimeoutIds] = useState<number[]>([]);

  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Unfinished Case Session Persistence State
  const [savedSession, setSavedSession] = useState<SavedCaseState | null>(null);

  // Load active saved case on mount
  useEffect(() => {
    const saved = getActiveCaseSession();
    if (saved) {
      setSavedSession(saved);
    }
  }, []);

  // Auto-save active case session progress whenever in game view
  useEffect(() => {
    if (currentView === 'game' && caseData) {
      const activeState = {
        id: caseData.id,
        caseData,
        courtroomMessages,
        activeCharacterId,
        characterStressMap,
        currentTab,
      };
      saveActiveCaseSession(activeState);
      const updated = getActiveCaseSession();
      if (updated) {
        setSavedSession(updated);
      }
    }
  }, [currentView, caseData, courtroomMessages, activeCharacterId, characterStressMap, currentTab]);

  // Resume unfinished saved case session
  const handleResumeSavedCase = () => {
    if (!savedSession || !savedSession.caseData) return;
    setCaseData(savedSession.caseData);
    setCourtroomMessages(savedSession.courtroomMessages || []);
    setActiveCharacterId(savedSession.activeCharacterId || savedSession.caseData.characters[0]?.id || '');
    setCharacterStressMap(savedSession.characterStressMap || {});
    setCurrentTab(savedSession.currentTab || 'court');
    setCurrentView('game');
    soundManager.playGavel();
  };

  // Discard / Archive unfinished saved case session
  const handleDiscardSavedCase = () => {
    if (savedSession) {
      archiveCaseSession(savedSession);
    }
    clearActiveCaseSession();
    setSavedSession(null);
    soundManager.playPaperRustle();
  };
  useEffect(() => {
    soundManager.playBgMusic();

    const triggerPlay = () => {
      setHasUserInteracted(true);
      soundManager.playBgMusic();
    };

    const events = ['click', 'pointerdown', 'mousedown', 'touchstart', 'touchend', 'keydown', 'wheel', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, triggerPlay, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, triggerPlay));
    };
  }, []);

  // Initialize presets on mount from server if available
  useEffect(() => {
    fetch('/api/preset-cases')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPresetCases(data);
        }
      })
      .catch((err) => console.log('Using local preset cases:', err));
  }, []);

  // Update initial active character when caseData changes
  useEffect(() => {
    if (caseData && caseData.characters && caseData.characters.length > 0) {
      const def = caseData.characters.find((c) => c.role === 'defendant') || caseData.characters[0];
      setActiveCharacterId(def.id);

      // Initialize stress map
      const initialMap: Record<string, number> = {};
      caseData.characters.forEach((c) => {
        initialMap[c.id] = c.suspicionLevel;
      });
      setCharacterStressMap(initialMap);
      setCourtroomMessages([]);
      setSelectedEvidenceToConfront(null);
      setIsDisputeActive(false);
      setIsDisputeLoading(false);
      disputeTimeoutIds.forEach((id) => clearTimeout(id));
      setDisputeTimeoutIds([]);
    }
  }, [caseData]);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      disputeTimeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [disputeTimeoutIds]);

  // Gavel Strike Event - Can silence heated disputes!
  const handleGavelClick = () => {
    soundManager.playGavel();
    setGavelAnimating(true);
    setTimeout(() => setGavelAnimating(false), 800);

    // If a Heated Dispute is currently active, stop it!
    if (isDisputeActive) {
      // Clear all pending dispute timeouts
      disputeTimeoutIds.forEach((id) => clearTimeout(id));
      setDisputeTimeoutIds([]);
      setIsDisputeActive(false);

      const gavelOrderMsg: InterrogationMessage = {
        id: `gavel-order-${Date.now()}`,
        sender: 'judge',
        senderName: 'ریاست محترم دادگاه (ضربه چکش)',
        text: '«سکوت! سکوت در صحن دادگاه! مرافعه خاتمه یابد و متهمین فوراً روی صندلی‌های خود مستقر شوند. در غیر این صورت به جرم اخلال در نظم دادرسی برخورد شدید قانونی خواهد شد!»',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      setCourtroomMessages((prev) => [...prev, gavelOrderMsg]);
      return;
    }

    // Standard gavel announcement if no dispute is active
    if (currentView === 'game' && currentTab === 'court' && caseData) {
      const standardMsg: InterrogationMessage = {
        id: `gavel-${Date.now()}`,
        sender: 'judge',
        senderName: 'ریاست دادگاه (ضربه چکش)',
        text: '«سکوت و نظم در دادگاه! اظهارات صریح و بدون حاشیه بیان شود!»',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      setCourtroomMessages((prev) => [...prev, standardMsg]);
    }
  };

  // Trigger a dynamic heated verbal dispute back-and-forth between suspects
  const triggerHeatedDispute = async () => {
    if (!caseData || isDisputeActive || isDisputeLoading) return;
    setIsDisputeLoading(true);
    soundManager.playDramaticSting();

    try {
      const lastMsg = courtroomMessages[courtroomMessages.length - 1]?.text || '';
      const response = await fetch('/api/generate-argument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData,
          lastExchange: lastMsg,
        }),
      });
      const data = await response.json();
      const lines = data.argument?.argument || data.argument || [];

      if (Array.isArray(lines) && lines.length > 0) {
        setIsDisputeActive(true);
        setIsDisputeLoading(false);

        // Queue lines to be posted one-by-one every 3.5 seconds for comfortable reading
        const timeouts: number[] = [];
        lines.forEach((line: any, index: number) => {
          const timeoutId = window.setTimeout(() => {
            // Only add if dispute is still active
            setIsDisputeActive((active) => {
              if (active) {
                if (index % 2 === 0) {
                  soundManager.playObjection();
                } else {
                  soundManager.playPaperRustle();
                }
                const disputeMsg: InterrogationMessage = {
                  id: `dispute-${Date.now()}-${index}`,
                  sender: 'dispute_character',
                  senderName: line.senderName,
                  text: line.text,
                  timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
                };
                setCourtroomMessages((prev) => [...prev, disputeMsg]);
              }
              return active;
            });
          }, (index + 1) * 3500);
          timeouts.push(timeoutId);
        });
        setDisputeTimeoutIds(timeouts);
      } else {
        setIsDisputeLoading(false);
      }
    } catch (err) {
      console.error(err);
      setIsDisputeLoading(false);
    }
  };

  // Select character for interrogation
  const handleSelectCharacterForCourt = (characterId: string) => {
    setActiveCharacterId(characterId);
    setCurrentTab('court');
  };

  // Present evidence from dossier into court
  const handlePresentEvidenceInCourt = (evidence: EvidenceItem) => {
    setSelectedEvidenceToConfront(evidence);
    setCurrentTab('court');
  };

  // Interrogate in general group chat with dynamic Gemini routing and fuzzy match typos
  const handleSendMessage = async (text: string, evidenceId?: string) => {
    if (isInterrogating || !caseData) return;
    setIsInterrogating(true);

    const presentedEvidence = evidenceId
      ? caseData.evidence.find((e) => e.id === evidenceId)
      : undefined;

    const judgeMsg: InterrogationMessage = {
      id: `msg-j-${Date.now()}`,
      sender: 'judge',
      senderName: 'جناب قاضی',
      text,
      evidencePresented: presentedEvidence,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    // Append judge message to unified courtroom log
    setCourtroomMessages((prev) => [...prev, judgeMsg]);

    try {
      const response = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData,
          question: text,
          evidencePresentedId: evidenceId,
          history: courtroomMessages.map((m) => ({
            sender: m.senderName,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();

      if (data._activeModel) {
        setLastActiveModel(data._activeModel);
      }
      if (data._latencyMs !== undefined) {
        setLastModelLatency(data._latencyMs);
      }

      // Find which character actually responded based on Gemini dynamic routing
      const responderId = data.addressedCharacterId || activeCharacterId || caseData.characters[0].id;
      const responderChar = caseData.characters.find((c) => c.id === responderId) || caseData.characters[0];

      // Update active focused character to the one responding
      setActiveCharacterId(responderId);

      // Check lawyer intervention
      if (data.lawyerIntervention) {
        soundManager.playObjection();
        const lawyerChar = caseData.characters.find((c) => c.role === 'defense_lawyer');
        const lawyerMsg: InterrogationMessage = {
          id: `msg-lawyer-${Date.now()}`,
          sender: 'lawyer',
          senderName: lawyerChar ? lawyerChar.name : 'وکیل مدافع',
          text: data.lawyerIntervention,
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        };
        setCourtroomMessages((prev) => [...prev, lawyerMsg]);
      }

      // If genuine formal confession detected, play dramatic chord
      if (data.isConfession) {
        soundManager.playDramaticSting();
      }

      const characterReplyMsg: InterrogationMessage = {
        id: `msg-c-${Date.now()}`,
        sender: 'character',
        senderName: responderChar.name,
        characterId: responderChar.id,
        text: data.speech || 'جناب قاضی، پاسخ دیگری برای این ادعا ندارم.',
        innerThought: data.innerThought,
        isConfession: !!data.isConfession,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };

      setCourtroomMessages((prev) => [...prev, characterReplyMsg]);

      // Smart RARE interruption mechanism: only triggers with low probability and not on every question
      const shouldTriggerInterruption = Boolean(data.interruption) && (courtroomMessages.length % 5 === 0) && (Math.random() < 0.4);

      if (shouldTriggerInterruption && data.interruption) {
        // Trigger an occasional rare dramatic sequence with comfortable pauses
        const tid1 = window.setTimeout(() => {
          soundManager.playObjection();
          const disputeMsg1: InterrogationMessage = {
            id: `dispute-auto-${Date.now()}-1`,
            sender: 'dispute_character',
            senderName: data.interruption.interrupterName,
            text: data.interruption.interrupterText,
            timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          };
          setCourtroomMessages((prev) => [...prev, disputeMsg1]);

          // After another 3.5 seconds, the original character replies back in defense
          const tid2 = window.setTimeout(() => {
            soundManager.playPaperRustle();
            const disputeMsg2: InterrogationMessage = {
              id: `dispute-auto-${Date.now()}-2`,
              sender: 'character',
              senderName: responderChar.name,
              characterId: responderChar.id,
              text: data.interruption.replyText,
              timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            };
            setCourtroomMessages((prev) => [...prev, disputeMsg2]);

            // End dispute state cleanly
            setIsDisputeActive(false);
          }, 3500);
          setDisputeTimeoutIds((prev) => [...prev, tid2]);

        }, 2800);
        setDisputeTimeoutIds((prev) => [...prev, tid1]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInterrogating(false);
    }
  };

  // Submit final verdict
  const handleSubmitVerdict = async (
    accusedId: string,
    verdictType: string,
    reasoning: string,
    penalty: string,
    chargeName?: string,
    individualDecisions?: IndividualCharacterVerdict[]
  ): Promise<VerdictResult | null> => {
    if (!caseData) return null;
    try {
      const response = await fetch('/api/judge-verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData,
          accusedId,
          verdictType,
          verdictReasoning: reasoning,
          penalty,
          chargeName,
          individualDecisions,
        }),
      });

      const result: VerdictResult = await response.json();
      // Clear active save once final verdict is issued
      clearActiveCaseSession();
      setSavedSession(null);
      return result;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Start Consultation from Main Menu (Opens ONLY the design room)
  const handleStartConsultationFromMenu = () => {
    soundManager.playPaperRustle();
    setCurrentView('consult');
  };

  // When Case is confirmed and generated, go DIRECTLY to the courtroom!
  const handleCaseCreatedAndEnterCourt = (newCase: CaseDossier & { _activeModel?: string; _latencyMs?: number }) => {
    // Validate that newCase has valid structure
    let validCase = newCase;
    if (!validCase || !validCase.title || !Array.isArray(validCase.characters) || validCase.characters.length === 0) {
      console.warn('Invalid case data detected, reverting to first available preset case');
      if (presetCases && presetCases.length > 0) {
        validCase = presetCases[0];
      } else {
        return;
      }
    }

    // Ensure all critical structures exist so React never crashes into a black screen
    const sanitizedCase: CaseDossier = {
      ...validCase,
      characters: Array.isArray(validCase.characters) ? validCase.characters : [],
      evidence: Array.isArray(validCase.evidence) ? validCase.evidence : [],
      autopsyReport: validCase.autopsyReport || {
        timeOfDeath: 'نامشخص',
        causeOfDeath: 'در دست بررسی',
        toxicology: 'منفی',
        injuries: [],
        coronerNotes: 'گزارش تکمیلی در پرونده است.',
      },
      hiddenTruth: validCase.hiddenTruth || {
        realCulpritId: validCase.characters?.[0]?.id || 'char-1',
        realCulpritName: validCase.characters?.[0]?.name || 'متهم ردیف اول',
        motive: 'انگیزه در دست بررسی',
        howCrimeHappened: 'شرح در پرونده قید شده است.',
        keyContradiction: 'تناقض در مدارک',
      },
    };

    // Archive previous save if exists
    if (savedSession) {
      archiveCaseSession(savedSession);
    }
    clearActiveCaseSession();

    setCaseData(sanitizedCase);
    if (newCase._activeModel) {
      setLastActiveModel(newCase._activeModel);
    }
    if (newCase._latencyMs !== undefined) {
      setLastModelLatency(newCase._latencyMs);
    }
    setCurrentTab('court'); // Direct entry to Courtroom as requested!
    setCurrentView('game');
    soundManager.playGavel();
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] text-[#c5c6c7] font-['Vazirmatn',sans-serif] selection:bg-amber-800/40 selection:text-amber-200">
      {/* 1. Main Menu View */}
      {currentView === 'menu' && (
        <MainMenu
          onStartConsultation={handleStartConsultationFromMenu}
          presetCases={presetCases}
          onSelectCase={handleCaseCreatedAndEnterCourt}
          isSoundOn={isSoundOn}
          setIsSoundOn={setIsSoundOn}
          onGavelStrike={handleGavelClick}
          onOpenSettings={handleOpenSettings}
          activeModel={lastActiveModel}
          savedSession={savedSession}
          onResumeSavedCase={handleResumeSavedCase}
          onDiscardSavedCase={handleDiscardSavedCase}
        />
      )}

      {/* 2. Dedicated Standalone Consultation & Design Room */}
      {currentView === 'consult' && (
        <div className="min-h-screen flex flex-col bg-[#0b0c14]">
          <header className="sticky top-0 z-40 bg-[#0f111c]/95 backdrop-blur-md border-b border-amber-900/40 px-4 py-3 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  soundManager.playPaperRustle();
                  setCurrentView('menu');
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
              >
                <Home className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>بازگشت به منوی اصلی</span>
              </button>

              <div className="h-5 w-px bg-stone-800 hidden sm:block" />

              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-amber-100">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>طراحی آنی پرونده جدید با تایپ موضوع (جمینای)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenSettings()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-semibold transition cursor-pointer"
                title="تنظیمات جامع دیوان عدالت"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>تنظیمات</span>
              </button>
            </div>
          </header>

          <main className="flex-1 pb-10">
            <ConsultationRoom
              onCaseGenerated={handleCaseCreatedAndEnterCourt}
              presetCases={presetCases}
              onSelectPresetCase={handleCaseCreatedAndEnterCourt}
            />
          </main>
        </div>
      )}

      {/* 3. In-Session Game View */}
      {currentView === 'game' && caseData && (
        <div className="flex flex-col min-h-screen">
          {/* Top Navbar */}
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            caseTitle={caseData.title}
            caseNumber={caseData.caseNumber}
            isSoundOn={isSoundOn}
            setIsSoundOn={setIsSoundOn}
            onGavelClick={handleGavelClick}
            gavelAnimating={gavelAnimating}
            onReturnToMenu={() => {
              soundManager.playPaperRustle();
              setCurrentView('menu');
            }}
            onOpenSettings={handleOpenSettings}
          />

          {/* Main Courtroom or Dossier Area */}
          <main className="flex-1 pb-12">
            {currentTab === 'court' && (
              <CourtroomView
                caseData={caseData}
                activeCharacterId={activeCharacterId}
                onSelectCharacter={(charId) => setActiveCharacterId(charId)}
                messages={courtroomMessages}
                onSendMessage={handleSendMessage}
                isLoading={isInterrogating}
                onGavelClick={handleGavelClick}
                characterStressMap={characterStressMap}
                selectedEvidenceToConfront={selectedEvidenceToConfront}
                setSelectedEvidenceToConfront={setSelectedEvidenceToConfront}
                onOpenDossier={() => setCurrentTab('dossier')}
                onOpenVerdict={() => setIsVerdictModalOpen(true)}
                isDisputeActive={isDisputeActive}
              />
            )}

            {currentTab === 'dossier' && (
              <CaseDossierView
                caseData={caseData}
                onSelectCharacterForCourt={handleSelectCharacterForCourt}
                onOpenVerdictModal={() => setIsVerdictModalOpen(true)}
                onPresentEvidenceInCourt={handlePresentEvidenceInCourt}
              />
            )}

            {currentTab === 'verdict' && (
              <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="p-8 rounded-3xl bg-[#131520] border border-amber-900/30 text-center space-y-4 shadow-2xl">
                  <h2 className="text-2xl font-bold text-amber-100">صحن انشای رأی نهایی دیوان عدالت</h2>
                  <p className="text-sm text-stone-400 max-w-xl mx-auto leading-relaxed">
                    آیا کلیه شواهد را ارزیابی و از متهمان بازجویی کرده‌اید؟ برای صدور قطعی دادنامه روی دکمه زیر کلیک نمایید.
                  </p>
                  <button
                    onClick={() => {
                      soundManager.playGavel();
                      setIsVerdictModalOpen(true);
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-700 via-amber-700 to-amber-800 hover:from-red-600 hover:to-amber-700 text-stone-100 font-extrabold text-sm md:text-base shadow-xl shadow-red-950/40 transition-all cursor-pointer"
                  >
                    باز کردن برگه انشای حکم دادگاه
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Verdict Modal */}
          <VerdictModal
            caseData={caseData}
            isOpen={isVerdictModalOpen}
            onClose={() => setIsVerdictModalOpen(false)}
            onSubmitVerdict={handleSubmitVerdict}
            onStartNewCase={() => {
              setIsVerdictModalOpen(false);
              setCurrentView('consult');
            }}
          />
        </div>
      )}

      {/* Consolidated Judicial Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        defaultTab={settingsTab}
        isSoundOn={isSoundOn}
        setIsSoundOn={setIsSoundOn}
        activeModel={lastActiveModel}
      />

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Autoplay Unlocker Prompt Banner (if browser blocked cold-load autoplay) */}
      {!hasUserInteracted && !soundManager.isBgMusicPlaying() && (
        <div
          onClick={() => {
            setHasUserInteracted(true);
            soundManager.playBgMusic();
          }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-stone-950 font-bold px-4 py-2.5 text-center text-xs sm:text-sm shadow-2xl flex items-center justify-center gap-2 cursor-pointer border-b border-amber-400 animate-bounce"
        >
          <Volume2 className="w-4 h-4 text-stone-950 animate-pulse shrink-0" />
          <span>🔊 جهت فعال‌سازی فوری صدای دادگاه و پخش موسیقی کلیک کنید (برای ورود بزنید)</span>
        </div>
      )}
    </div>
  );
}
