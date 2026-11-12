import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0c101b] px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Mail className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">
          Reach<span className="text-blue-500">Inbox</span>
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 ml-2">
          Scheduler
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User'}
                  className="w-7 h-7 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-slate-200">{user.name || user.email.split('@')[0]}</p>
                <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{user.email}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
