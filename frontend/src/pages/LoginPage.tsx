import React from 'react';
import { Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm bg-[#0f1422] border border-slate-800 rounded-2xl p-8 shadow-xl text-center">
        {/* Brand header */}
        <div className="w-10 h-10 rounded-xl bg-blue-600 mx-auto flex items-center justify-center mb-4">
          <Mail className="w-5 h-5 text-white" />
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-white mb-1">
          Reach<span className="text-blue-500">Inbox</span>
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Sign in to schedule and track email campaigns with rate pacing.
        </p>

        {/* Action Button */}
        <div>
          <button
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-medium text-xs shadow-sm flex items-center justify-center gap-2.5 transition-colors active:scale-[0.99]"
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
        </div>
      </div>
    </div>
  );
};
