import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Download,
  Maximize,
  Minimize,
  Terminal,
  Cpu,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Zap,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Disc,
  RefreshCw,
  AlertCircle,
  Radio,
  Gavel,
  ShieldCheck,
  Share2,
  PlusSquare,
  Flame,
  Activity
} from 'lucide-react';
import { soundManager, BACKGROUND_TRACKS } from '../utils/audio.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { useFullscreen } from '../utils/useFullscreen.ts';
import { DiagnosticsPanel } from './DiagnosticsPanel.tsx';

export type SettingsTab = 'pwa' | 'fullscreen' | 'gemini' | 'logs' | 'audio';

interface ModelStatus {
  modelName: string;
  displayName: string;
  description: string;
  status: 'idle' | 'testing' | 'online' | 'error';
  latencyMs?: number;
  responseText?: string;
  error?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
  isSoundOn: boolean;
  setIsSoundOn: (val: boolean) => void;
  activeModel?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'pwa',
  isSoundOn,
  setIsSoundOn,
  activeModel = 'gemini-3.8-flash',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  // PWA Install state
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [pwaInstallSuccess, setPwaInstallSuccess] = useState(false);

  // Fullscreen state
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Gemini Model Tester state
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

  // Background Music Playlist State
  const [bgVolume, setBgVolume] = useState<number>(soundManager.getBgMusicVolume());
  const [trackInfo, setTrackInfo] = useState(soundManager.getCurrentTrackInfo());

  // Periodically sync playlist state when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTrackInfo(soundManager.getCurrentTrackInfo());
      setBgVolume(soundManager.getBgMusicVolume());
    }, 800);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBgVolumeChange = (volPercent: number) => {
    setBgVolume(volPercent);
    soundManager.setBgMusicVolume(volPercent);
    setTrackInfo(soundManager.getCurrentTrackInfo());
  };

  const handleToggleBgMusic = () => {
    soundManager.playPaperRustle();
    const isPlaying = soundManager.isBgMusicPlaying();
    if (isPlaying) {
      soundManager.pauseBgMusic();
    } else {
      soundManager.playBgMusic();
    }
    setTrackInfo(soundManager.getCurrentTrackInfo());
  };

  const handleNextTrack = () => {
    soundManager.playPaperRustle();
    soundManager.nextBgTrack();
    setTrackInfo(soundManager.getCurrentTrackInfo());
  };

  const handlePrevTrack = () => {
    soundManager.playPaperRustle();
    soundManager.prevBgTrack();
    setTrackInfo(soundManager.getCurrentTrackInfo());
  };

  const handlePWAInstall = async () => {
    soundManager.playPaperRustle();
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setPwaInstallSuccess(true);
      }
    }
  };

  const handleFullscreenToggle = () => {
    soundManager.playPaperRustle();
    toggleFullscreen();
  };

  const handleSoundToggle = () => {
    const nextVal = !isSoundOn;
    setIsSoundOn(nextVal);
    soundManager.setSoundEnabled(nextVal);
    if (nextVal) {
      soundManager.playGavel();
    }
  };

  const testSingleModel = async (modelName: string) => {
    soundManager.playPaperRustle();
    setModels((prev) =>
      prev.map((m) =>
        m.modelName === modelName ? { ...m, status: 'testing', error: undefined, responseText: undefined } : m
      )
    );

    const startTime = Date.now();
    try {
      const res = await fetch('/api/test-gemini-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName, prompt: 'تست اتصال دیوان عدالت جنایی. در یک کلمه پاسخ بده: آماده' }),
      });

      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok || !data.success) {
        setModels((prev) =>
          prev.map((m) =>
            m.modelName === modelName
              ? { ...m, status: 'error', latencyMs: latency, error: data.error || 'خطای سرور ۵۰۳ یا عدم پاسخ' }
              : m
          )
        );
      } else {
        setModels((prev) =>
          prev.map((m) =>
            m.modelName === modelName
              ? {
                  ...m,
                  status: 'online',
                  latencyMs: data.latencyMs || latency,
                  responseText: data.response || 'پاسخ دریافت شد',
                }
              : m
          )
        );
      }
    } catch (err: unknown) {
      const latency = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'خطای برقراری ارتباط شبکه';
      setModels((prev) =>
        prev.map((m) =>
          m.modelName === modelName ? { ...m, status: 'error', latencyMs: latency, error: errorMsg } : m
        )
      );
    }
  };

  const testAllModels = async () => {
    soundManager.playGavel();
    setTestingAll(true);
    for (const m of models) {
      await testSingleModel(m.modelName);
    }
    setTestingAll(false);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pwa', label: 'نصب نرم‌افزار (PWA)', icon: <Download className="w-4 h-4" /> },
    { id: 'fullscreen', label: 'نمایش و تمام‌صفحه', icon: <Maximize className="w-4 h-4" /> },
    { id: 'gemini', label: 'هوش مصنوعی جمینای', icon: <Cpu className="w-4 h-4" /> },
    { id: 'logs', label: 'لاگ‌ها و عیب‌یابی فنی', icon: <Terminal className="w-4 h-4" /> },
    { id: 'audio', label: 'صدا و موسیقی دارک', icon: <Volume2 className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0f111c] border border-amber-900/40 shadow-2xl text-stone-100 overflow-hidden">
        {/* Modal Top Header */}
        <header className="px-5 py-4 bg-gradient-to-r from-[#171a29] via-[#121422] to-[#0f111c] border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-amber-100">تنظیمات و کنترل‌های دیوان عدالت</h2>
              <p className="text-[11px] text-stone-400">مدیریت نصب، ابعاد نمایش، وضعیت هوش مصنوعی و صدای پیش‌زمینه دارک</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playPaperRustle();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition cursor-pointer"
            title="بستن پنجره تنظیمات"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="px-4 pt-3 pb-2 bg-[#0c0d16] border-b border-stone-800/80 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundManager.playPaperRustle();
                setActiveTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-950/40'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
          {/* TAB 1: PWA INSTALL */}
          {activeTab === 'pwa' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#151828] to-[#10121f] border border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-100 text-sm sm:text-base">نصب نسخه مستقل اپلیکیشن (PWA)</h3>
                    <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                      بازی را بدون نوار مزاحم مرورگر، با سرعت بالا و دسترسی به تمام پرونده‌های راکد و واقعی نصب کنید.
                    </p>
                  </div>
                </div>

                {isInstalled || pwaInstallSuccess ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>اپلیکیشن نصب شده است</span>
                  </div>
                ) : (
                  <button
                    onClick={handlePWAInstall}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-950/50 transition cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4 text-stone-950" />
                    <span>نصب فوری روی دستگاه</span>
                  </button>
                )}
              </div>

              {/* Instructions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Android / Chrome guide */}
                <div className="p-4 rounded-2xl bg-[#121422] border border-stone-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-300 text-xs sm:text-sm font-bold">
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span>راهنمای اندروید، ویندوز و کروم:</span>
                  </div>
                  <ul className="text-xs text-stone-300 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۱</span>
                      <span>روی دکمه «نصب فوری روی دستگاه» در بالا کلیک کنید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۲</span>
                      <span>در پنجره پاپ‌آپ باز شده مرورگر، گزینه «Install» یا «نصب» را تأیید نمایید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۳</span>
                      <span>آیکون «آقای قاضی» به لیست برنامه‌ها و صفحه اصلی گوشی شما افزوده می‌شود.</span>
                    </li>
                  </ul>
                </div>

                {/* iOS Safari guide */}
                <div className="p-4 rounded-2xl bg-[#121422] border border-stone-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-300 text-xs sm:text-sm font-bold">
                    <Share2 className="w-4 h-4 text-amber-400" />
                    <span>راهنمای آیفون و آیپد (سافاری iOS):</span>
                  </div>
                  <ul className="text-xs text-stone-300 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۱</span>
                      <span>در پایین مرورگر سافاری روی آیکون اشتراک‌گذاری (<Share2 className="w-3.5 h-3.5 inline text-amber-400" /> Share) بزنید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۲</span>
                      <span>گزینه «Add to Home Screen» (<PlusSquare className="w-3.5 h-3.5 inline text-amber-400" /> افزودن به صفحه اصلی) را انتخاب کنید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-mono">۳</span>
                      <span>در گوشه بالا دکمه «Add» را لمس کنید تا بازی به صفحه گوشی شما بیاید.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>نسخه PWA پرونده‌های راکد و شواهد آزمایشگاهی را در حافظه کش آفلاین دستگاه نگهداری می‌کند.</span>
              </div>
            </div>
          )}

          {/* TAB 2: FULLSCREEN */}
          {activeTab === 'fullscreen' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#151828] to-[#10121f] border border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-100 text-sm sm:text-base">حالت تمام‌صفحه و سینمایی (Fullscreen)</h3>
                    <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                      وضعیت فعلی: <strong className={isFullscreen ? 'text-emerald-400' : 'text-amber-400'}>{isFullscreen ? 'فعال (تمام‌صفحه)' : 'غیرفعال (حالت پنجره)'}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleFullscreenToggle}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg transition cursor-pointer shrink-0 ${
                    isFullscreen
                      ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600'
                      : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950'
                  }`}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'ورود به حالت تمام‌صفحه'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#121422] border border-stone-800 space-y-2 text-xs text-stone-300 leading-relaxed">
                <h4 className="font-bold text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  مزیت اجرای تمام‌صفحه در صحن دادگاه:
                </h4>
                <p>
                  در طول بازجویی و تقابل با متهمین، حالت تمام‌صفحه فضای دید بهتری برای پرونده، کالبدشکافی و گفتگوی گروهی متهمان در اختیار شما قرار داده و از اسکرول ناخواسته نوار آدرس مرورگر جلوگیری می‌کند.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: GEMINI AI */}
          {activeTab === 'gemini' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#141726] border border-amber-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Cpu className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-100 text-sm">موتور هوش مصنوعی دیوان عدالت</h3>
                    <p className="text-xs text-stone-400">مدل فعال پیش‌فرض: <span className="text-amber-300 font-mono font-bold">{activeModel}</span></p>
                  </div>
                </div>

                <button
                  onClick={testAllModels}
                  disabled={testingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingAll ? 'animate-spin' : ''}`} />
                  <span>تست سرعت و اتصال همگانی</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {models.map((m) => (
                  <div
                    key={m.modelName}
                    className="p-4 rounded-2xl bg-[#121422] border border-stone-800 hover:border-stone-750 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-100 text-sm">{m.displayName}</span>
                        {m.modelName === activeModel && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                            مدل فعال دادگاه
                          </span>
                        )}
                        {m.status === 'online' && (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {m.latencyMs}ms
                          </span>
                        )}
                        {m.status === 'error' && (
                          <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            خطا در پاسخ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400">{m.description}</p>
                    </div>

                    <button
                      onClick={() => testSingleModel(m.modelName)}
                      disabled={m.status === 'testing' || testingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      <span>{m.status === 'testing' ? 'در حال تست...' : 'تست پینگ و اتصال'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & SYSTEM LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-[#141624] border border-stone-800 flex items-center justify-between text-xs text-stone-300">
                <span className="font-bold text-amber-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  کنسول ثبت وقایع و لاگ‌های زنده سرور (محرمانه دادگاه)
                </span>
                <span className="text-[11px] text-stone-500">پایش مداوم درخواست‌ها، خطایابی ۵۰۳ و مکالمات</span>
              </div>
              <div className="rounded-2xl border border-stone-800/80 overflow-hidden bg-black/40 p-2 sm:p-3">
                <DiagnosticsPanel />
              </div>
            </div>
          )}

          {/* TAB 5: AUDIO & BACKGROUND MUSIC PLAYLIST */}
          {activeTab === 'audio' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Background Music Playlist Section */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1a1215] via-[#151320] to-[#0f111c] border border-amber-900/50 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Music className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-stone-100 text-sm sm:text-base">موسیقی پیش‌زمینه دارک (پخش در سراسر محیط بازی)</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/40">
                          لیست پخش ۳ قطعه‌ای • چرخش بی‌نهایت
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        این قطعات به صورت متوالی و پشت‌سرهم در تمامی صفحات بازی (منوی اصلی، اتاق مشاوره، صحن دادگاه و...) پخش شده و پس از اتمام لیست، مجدداً از ابتدا آغاز می‌شوند.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleToggleBgMusic}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer shadow-lg ${
                        trackInfo.isPlaying
                          ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-750 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {trackInfo.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                      <span>{trackInfo.isPlaying ? 'توقف پخش' : 'پخش موسیقی'}</span>
                    </button>
                  </div>
                </div>

                {/* Track Player Controls */}
                <div className="p-3.5 rounded-2xl bg-[#10121d] border border-stone-800/90 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Disc className={`w-5 h-5 ${trackInfo.isPlaying ? 'animate-[spin_4s_linear_infinite] text-amber-300' : 'text-stone-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-amber-400 font-mono font-bold block">
                        در حال پخش (قطعه {trackInfo.index + 1} از {trackInfo.total}):
                      </span>
                      <p className="text-xs font-bold text-stone-100 truncate">{trackInfo.track.title}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handlePrevTrack}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-amber-300 transition cursor-pointer"
                      title="قطعه قبلی"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleToggleBgMusic}
                      className="p-2.5 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 transition cursor-pointer"
                      title={trackInfo.isPlaying ? 'توقف' : 'پخش'}
                    >
                      {trackInfo.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      onClick={handleNextTrack}
                      className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-300 hover:text-amber-300 transition cursor-pointer"
                      title="قطعه بعدی"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Volume Slider for Background Music (0 to 100%) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5 font-bold text-amber-200">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      تنظیم بلندی صدای موسیقی پیش‌زمینه (۰ تا ۱۰۰٪):
                    </span>
                    <span className="font-mono text-amber-300 font-extrabold text-sm">{bgVolume}٪</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={bgVolume}
                    onChange={(e) => handleBgVolumeChange(Number(e.target.value))}
                    className="w-full accent-amber-500 h-2.5 bg-stone-950 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Track List Selector */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-stone-400 block">لیست قطعات موسیقی پیش‌زمینه:</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {BACKGROUND_TRACKS.map((t, idx) => {
                      const isCurrent = idx === trackInfo.index;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            soundManager.playPaperRustle();
                            if (idx !== trackInfo.index) {
                              soundManager.nextBgTrack(); // or trigger specific track selection
                              setTrackInfo(soundManager.getCurrentTrackInfo());
                            } else {
                              handleToggleBgMusic();
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between gap-2 text-xs cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold'
                              : 'bg-[#121422] border-stone-800 text-stone-400 hover:bg-[#181a2e] hover:text-stone-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-lg bg-stone-800 flex items-center justify-center text-[10px] font-mono shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate">{t.title}</span>
                          </div>
                          {isCurrent && trackInfo.isPlaying && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              در حال پخش
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* General Sound FX */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121422] border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-100 text-sm">افکت‌های صوتی تعاملی (چکش، تپش قلب، اوراق)</h3>
                    <p className="text-xs text-stone-400 mt-0.5">افکت ضربه چکش دادگاه، تنش کلامی متهم و ورق زدن پرونده‌ها</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => soundManager.playGavel()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-300 text-xs font-semibold transition cursor-pointer"
                    title="تست ضربه چکش"
                  >
                    <Gavel className="w-3.5 h-3.5 text-amber-400" />
                    <span>تست چکش</span>
                  </button>

                  <button
                    onClick={handleSoundToggle}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSoundOn
                        ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {isSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{isSoundOn ? 'صدا وصل' : 'صدا قطع'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-5 py-3.5 bg-[#0e101a] border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span>دیوان عالی امور جنایی • نسخه پایدار PWA</span>
          <button
            onClick={() => {
              soundManager.playPaperRustle();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-200 text-xs font-bold transition cursor-pointer"
          >
            تأیید و بستن
          </button>
        </footer>
      </div>
    </div>
  );
};
