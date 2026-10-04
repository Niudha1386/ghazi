import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running as an installed standalone PWA app, hide button
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>اپلیکیشن نصب شده</span>
      </div>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="نصب بازی به صورت اپلیکیشن مستقل (PWA)"
        className="group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-stone-950 text-xs sm:text-sm font-bold shadow-md shadow-amber-950/40 hover:shadow-amber-500/30 active:scale-95 transition-all duration-200 border border-amber-400/60 cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-950 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-900"></span>
        </span>
        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-950 transition-transform group-hover:-translate-y-0.5" />
        <span className="whitespace-nowrap">نصب اپلیکیشن</span>
      </button>

      {/* Installation Guide Modal (for iOS or fallback instructions) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border border-amber-500/40 p-5 sm:p-6 shadow-2xl text-stone-100">
            {/* Close button */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 left-4 p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-stone-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-stone-100">نصب بازی «آقای قاضی»</h3>
                <p className="text-xs text-amber-400/80">نسخه اپلیکیشن بومی بدون نیاز به دانلود از استور</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3.5 text-xs sm:text-sm text-stone-300 leading-relaxed">
                <p className="text-stone-300">
                  برای نصب بازی در آیفون و آیپد (مرورگر سافاری Safari):
                </p>
                <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">۱</span>
                    <span>روی دکمه <strong>Share (اشتراک‌گذاری)</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-400" /> در پایین مرورگر سافاری ضربه بزنید.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">۲</span>
                    <span>گزینه <strong>Add to Home Screen</strong> (افزودن به صفحه اصلی) <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-400" /> را انتخاب کنید.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">۳</span>
                    <span>روی <strong>Add</strong> در گوشه بالا ضربه بزنید تا آیکون بازی به صفحه اصلی اضافه شود.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs sm:text-sm text-stone-300 leading-relaxed">
                <p>
                  این بازی به صورت <strong>Progressive Web App (PWA)</strong> طراحی شده و می‌توانید آن را بدون نیاز به دانلود فایل نصبی، مستقیماً روی گوشی یا کامپیوتر اجرا کنید:
                </p>
                <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>در اندروید (Chrome):</strong> روی منوی ۳ نقطه مرورگر ضربه بزنید و گزینه <strong>«افزودن به صفحه اصلی» (Install App / Add to Home Screen)</strong> را بزنید.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>در کامپیوتر (Chrome / Edge):</strong> روی آیکون مانیتور/نصب کوچک در نوار آدرس مرورگر کلیک کنید.</span>
                  </div>
                </div>

                {isInstallable && (
                  <button
                    onClick={async () => {
                      await install();
                      setShowGuideModal(false);
                    }}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm transition shadow-lg cursor-pointer"
                  >
                    تایید و اجرای پنجره نصب
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
