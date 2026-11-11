import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, Zap, Server, Loader2, Play } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      await loginDemo();
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f141e]/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center">
        {/* Brand header */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 mx-auto flex items-center justify-center shadow-xl shadow-brand-500/20 mb-6">
          <Mail className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Reach<span className="text-brand-500">Inbox</span> Scheduler
        </h1>
        <p className="text-xs text-slate-400 mb-8 max-w-xs mx-auto">
          Production-grade Full-Stack Email Job Scheduler with BullMQ, Redis Distributed Rate Limiting & Slack Notifications
        </p>

        {/* Action Buttons */}
        <div className="space-y-3 mb-8">
          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm shadow-md flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Quick Demo Login */}
          <button
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {demoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
            ) : (
              <Play className="w-4 h-4 text-brand-400 fill-brand-400" />
            )}
            <span>{demoLoading ? 'Logging In...' : 'Quick Demo Login (One-Click)'}</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="pt-6 border-t border-slate-800 grid grid-cols-3 gap-2 text-left">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Zap className="w-4 h-4 text-amber-400 mb-1" />
            <p className="text-[11px] font-semibold text-slate-200">BullMQ Delay</p>
            <p className="text-[10px] text-slate-400">Zero cron dependency</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-brand-400 mb-1" />
            <p className="text-[11px] font-semibold text-slate-200">Redis Limiter</p>
            <p className="text-[10px] text-slate-400">Atomic Lua scripts</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Server className="w-4 h-4 text-indigo-400 mb-1" />
            <p className="text-[11px] font-semibold text-slate-200">Restart Proof</p>
            <p className="text-[10px] text-slate-400">Redis AOF persistence</p>
          </div>
        </div>
      </div>
    </div>
  );
};
