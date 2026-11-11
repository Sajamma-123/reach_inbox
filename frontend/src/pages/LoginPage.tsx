import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, Play } from 'lucide-react';

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
    <div className="min-h-screen bg-[#070a0f] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm bg-[#0f141e] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        {/* Brand header */}
        <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto flex items-center justify-center mb-5">
          <Mail className="w-6 h-6 text-white" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1.5">
          Reach<span className="text-brand-500">Inbox</span>
        </h1>
        <p className="text-xs text-slate-400 mb-8">
          Sign in to manage and schedule your email campaigns.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.99]"
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
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {demoLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-brand-400 fill-brand-400" />
            )}
            <span>{demoLoading ? 'Logging In...' : 'Quick Demo Login'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
