import React, { useState, useEffect } from 'react';
import { Terminal, Activity, Wifi, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success';
  module: string;
  message: string;
  details?: any;
}

interface ProbeReport {
  timestamp: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  customBaseUrl: string;
  dnsTest: string;
  geminiPing: string;
  errors: any[];
}

export const DiagnosticsPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [testing, setTesting] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);
  const [selectedLogDetails, setSelectedLogDetails] = useState<any | null>(null);

  // Fetch server logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Run live diagnostic probe
  const runProbe = async () => {
    setTesting(true);
    setReport(null);
    try {
      const res = await fetch('/api/diagnose-gemini', { method: 'POST' });
      const data = await res.json();
      setReport(data.report);
      // Immediately refresh logs to capture probe diagnostics
      fetchLogs();
    } catch (err) {
      console.error('Error running probe:', err);
    } finally {
      setTesting(false);
    }
  };

  // Poll logs every 2 seconds
  useEffect(() => {
    fetchLogs();
    if (!pollingActive) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [pollingActive]);

  const getLogBadgeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50';
      case 'error':
        return 'text-red-400 bg-red-950/40 border-red-800/50';
      case 'warn':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/50';
      default:
        return 'text-blue-400 bg-blue-950/40 border-blue-800/50';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Diagnostics Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#141624]/90 border border-stone-800 shadow-sm">
        <div className="space-y-1.5 text-right">
          <div className="flex items-center gap-2 md:justify-start justify-end flex-row-reverse">
            <h2 className="text-base font-black text-stone-100 font-serif">کنسول سه‌گانه دیباگ و عیب‌یابی ارتباط با جمینای</h2>
            <Terminal className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-[11px] text-stone-400">
            با استفاده از این پنل می‌توانید به طور زنده وضعیت کلید API، اتصال شبکه گوگل و ردیابی تراکنش‌های جمینای ۳.۵-۳.۸ فلش را بررسی کنید.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setPollingActive(!pollingActive)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
              pollingActive 
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400 hover:bg-emerald-950/50' 
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800'
            }`}
          >
            {pollingActive ? '● دریافت زنده لاگ‌ها فعال' : 'دریافت زنده متوقف'}
          </button>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 hover:text-white cursor-pointer hover:bg-stone-800 transition-colors"
            title="به‌روزرسانی دستی لاگ‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Live Connection Probe (System 1 & 2) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Probe Card */}
          <div className="p-5 rounded-2xl bg-[#10121e] border border-stone-800/80 space-y-5">
            <div className="flex items-center justify-between flex-row-reverse border-b border-stone-800/60 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-200">تست زنده اتصال سرور</span>
                <Wifi className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[10px] text-stone-500 font-mono">System Diagnostic Probe</span>
            </div>

            <div className="space-y-4 text-right">
              {/* API Key Status */}
              <div className="flex justify-between items-center bg-[#141624] p-3 rounded-xl border border-stone-800/40 text-xs">
                {report ? (
                  <span className={`font-mono text-[11px] font-bold ${report.apiKeyConfigured ? 'text-emerald-400' : 'text-red-400'}`}>
                    {report.apiKeyMasked}
                  </span>
                ) : (
                  <span className="text-stone-500 font-mono">نامعلوم</span>
                )}
                <span className="text-stone-400 font-medium">پیکربندی کلید API در سرور / ورکر:</span>
              </div>

              {/* API endpoint status */}
              <div className="flex justify-between items-center bg-[#141624] p-3 rounded-xl border border-stone-800/40 text-xs">
                {report ? (
                  <span className="font-mono text-[11px] font-bold text-blue-400">
                    {report.customBaseUrl}
                  </span>
                ) : (
                  <span className="text-stone-500 font-mono">نامعلوم</span>
                )}
                <span className="text-stone-400 font-medium">آدرس دامنه فراخوانی (Endpoint):</span>
              </div>

              {/* DNS Connectivity to googleapi */}
              <div className="flex justify-between items-center bg-[#141624] p-3 rounded-xl border border-stone-800/40 text-xs">
                {report ? (
                  <span className={`text-[11px] font-bold ${report.dnsTest.includes('موفق') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {report.dnsTest}
                  </span>
                ) : (
                  <span className="text-stone-500 font-mono">تست نشده</span>
                )}
                <span className="text-stone-400 font-medium">ارتباط شبکه سرور / ورکر با دامنه گوگل:</span>
              </div>

              {/* Live Gemini Ping */}
              <div className="flex justify-between items-center bg-[#141624] p-3 rounded-xl border border-stone-800/40 text-xs">
                {report ? (
                  <span className={`text-[11px] font-bold ${report.geminiPing.includes('موفق') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {report.geminiPing}
                  </span>
                ) : (
                  <span className="text-stone-500 font-mono">تست نشده</span>
                )}
                <span className="text-stone-400 font-medium">پاسخ دریافتی زنده از هسته جمینای:</span>
              </div>
            </div>

            <button
              onClick={runProbe}
              disabled={testing}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال اجرای عیب‌یابی خودکار...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>شروع فرآیند تست سه مرحله‌ای جمینای</span>
                </>
              )}
            </button>
          </div>

          {/* Diagnostic Raw Error Log Box */}
          {report && report.errors && report.errors.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#1e1215] border border-red-900/40 space-y-3">
              <div className="flex items-center gap-1.5 justify-end text-red-400">
                <span className="text-xs font-bold">خطای خام شناسایی‌شده در سرور</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-red-300 text-right leading-relaxed">
                گوگل درخواست اتصال را رد کرد. جزئیات خطای سیستمی زیر را جهت ثبت در تنظیمات بررسی کنید:
              </p>
              <div className="p-3 bg-[#120a0c] rounded-xl border border-red-950 text-left font-mono text-[10px] text-red-200 overflow-x-auto max-h-[160px] custom-scrollbar">
                <pre>{JSON.stringify(report.errors, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Gemini Models Guideline */}
          <div className="p-5 rounded-2xl bg-[#10121e] border border-stone-800/80 space-y-3 text-right text-xs">
            <div className="flex items-center gap-1.5 justify-end text-amber-400 border-b border-stone-800/40 pb-2">
              <span className="font-bold">قوانین و مدل‌های مجاز فعال</span>
              <Cpu className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              سیستم هم‌اکنون به صورت انحصاری بر روی مدل‌های نسل ۳.۵ تا ۳.۸ فلش تنظیم شده است. در صورت بروز هرگونه خطا، سیستم به ترتیب روی کاندیداهای دیگر سوییچ می‌کند:
            </p>
            <ul className="space-y-1 text-[11px] font-mono text-stone-300">
              <li>• gemini-3.5-flash</li>
              <li>• gemini-3.6-flash</li>
              <li>• gemini-3.7-flash</li>
              <li>• gemini-3.8-flash</li>
            </ul>
          </div>
        </div>

        {/* Right: Live Terminal Logs Console (System 3) */}
        <div className="lg:col-span-7 flex flex-col h-[520px] rounded-2xl bg-[#08090f] border border-stone-800/80 overflow-hidden shadow-md">
          {/* Terminal Title */}
          <div className="p-4 bg-[#10121f] border-b border-stone-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-300">پایانه نمایش زنده لاگ‌های سیستمی دادگاه</span>
              <Terminal className="w-4 h-4 text-stone-400" />
            </div>
          </div>

          {/* Logs Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 space-y-2 py-12">
                <Terminal className="w-8 h-8 text-stone-700 animate-pulse" />
                <p className="text-xs">در حال انتظار برای ثبت اولین لاگ سیستمی...</p>
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  onClick={() => setSelectedLogDetails(log.details ? log : null)}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    log.type === 'error' 
                      ? 'bg-red-950/10 border-red-950/40 hover:bg-red-950/20' 
                      : log.type === 'warn'
                      ? 'bg-amber-950/10 border-amber-950/40 hover:bg-amber-950/20'
                      : log.type === 'success'
                      ? 'bg-emerald-950/10 border-emerald-950/40 hover:bg-emerald-950/20'
                      : 'bg-stone-900/40 border-stone-800/50 hover:bg-stone-800/40'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5 flex-row-reverse">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone-400 font-bold">[{log.module}]</span>
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold ${getLogBadgeColor(log.type)}`}>
                        {log.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[9px] text-stone-500">
                      {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                    </span>
                  </div>
                  <p className="text-stone-200 leading-relaxed text-xs">{log.message}</p>
                  
                  {log.details && (
                    <span className="text-[9px] text-amber-500/80 hover:text-amber-400 underline block mt-2">
                      مشاهده جزئیات خطای فنی ➕
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Log Details Modal / Sheet */}
      {selectedLogDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0e101a] border border-stone-800 rounded-2xl p-6 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 flex-row-reverse">
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-1.5 flex-row-reverse">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>جزئیات دقیق خطای فرستاده شده از سرور</span>
              </h3>
              <button 
                onClick={() => setSelectedLogDetails(null)}
                className="text-stone-400 hover:text-white text-xs cursor-pointer"
              >
                بستن پنجره ✖
              </button>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center flex-row-reverse text-stone-300">
                <span>ماژول صادرکننده:</span>
                <span className="font-mono text-amber-400 font-bold">[{selectedLogDetails.module}]</span>
              </div>
              <div className="flex justify-between items-center flex-row-reverse text-stone-300">
                <span>پیام خطا:</span>
                <span className="text-red-400 text-left leading-relaxed">{selectedLogDetails.message}</span>
              </div>
            </div>

            <div className="p-4 bg-[#07080d] rounded-xl border border-stone-900 text-left font-mono text-[10px] text-stone-300 overflow-y-auto max-h-[300px] custom-scrollbar">
              <pre>{JSON.stringify(selectedLogDetails.details, null, 2)}</pre>
            </div>

            <button
              onClick={() => setSelectedLogDetails(null)}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-stone-300 border border-stone-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              متوجه شدم و بستن دیباگر
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
