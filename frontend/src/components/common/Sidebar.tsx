import React from 'react';
import { LayoutDashboard, Clock, CheckCheck, Plus, Slack } from 'lucide-react';

interface SidebarProps {
  currentTab: 'dashboard' | 'scheduled' | 'sent';
  onSelectTab: (tab: 'dashboard' | 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  slackConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCompose,
  slackConnected = false,
}) => {
  return (
    <aside className="w-60 border-r border-slate-800 bg-[#0c1017] flex flex-col justify-between p-4 shrink-0 h-[calc(100vh-4rem)]">
      <div className="space-y-5">
        {/* Primary Action */}
        <button
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Compose</span>
        </button>

        {/* Navigation items */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-slate-800 text-brand-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              currentTab === 'scheduled'
                ? 'bg-slate-800 text-brand-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled</span>
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              currentTab === 'sent'
                ? 'bg-slate-800 text-brand-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            <span>Delivered</span>
          </button>
        </nav>
      </div>

      {/* Integration pill */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Slack className="w-4 h-4 text-[#ECB22E]" />
          <span className="font-medium text-[11px]">Slack Alerts</span>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            slackConnected ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        ></span>
      </div>
    </aside>
  );
};
