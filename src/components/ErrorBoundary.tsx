import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { clearActiveCaseSession } from '../utils/storage.ts';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      clearActiveCaseSession();
      localStorage.removeItem('mr_judge_active_case_save');
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b10] text-[#c5c6c7] font-['Vazirmatn',sans-serif] flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#131522] border-2 border-red-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-amber-100">
                اختلال موقت در بارگذاری صحن دادگاه
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                سامانه به دلیل ناسازگاری موقت داده‌های پرونده یا تغییر در تنظیمات سکرت‌ها با وقفه مواجه شد. هیچ اطلاعاتی از دست نرفته است.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-right text-xs text-red-300 font-mono overflow-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>شروع مجدد و بازگشت به منوی اصلی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
