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
    <aside className="w-56 border-r border-slate-800 bg-[#0c101b] flex flex-col justify-between p-4 shrink-0 h-[calc(100vh-4rem)]">
      <div className="space-y-4">
        {/* Primary Action Button */}
        <button
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>

        {/* Navigation items */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Campaigns</span>
          </button>

          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentTab === 'scheduled'
                ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled</span>
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentTab === 'sent'
                ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            <span>Delivered</span>
          </button>
        </nav>
      </div>

      {/* Integration indicator */}
      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Slack className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-medium">Slack Alerts</span>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            slackConnected ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
        ></span>
      </div>
    </aside>
  );
};
