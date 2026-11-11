import React from 'react';
import { LayoutDashboard, Clock, CheckCheck, Plus, Activity, ExternalLink, Slack } from 'lucide-react';

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
    <aside className="w-64 border-r border-slate-800 bg-[#0c1017] flex flex-col justify-between p-4 shrink-0 h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        {/* Primary Action */}
        <button
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-medium shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Compose Campaign</span>
        </button>

        {/* Navigation items */}
        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-slate-800/80 text-brand-400 border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'scheduled'
                ? 'bg-slate-800/80 text-brand-400 border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Jobs</span>
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'sent'
                ? 'bg-slate-800/80 text-brand-400 border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            <span>Sent & Delivered</span>
          </button>
        </nav>

        {/* External tools & Monitoring */}
        <div className="pt-4 border-t border-slate-800/60 space-y-1">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            System Monitoring
          </p>

          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Bull-Board UI</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>
      </div>

      {/* Integration status */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Slack className="w-4 h-4 text-[#ECB22E]" />
            <span>Slack Alerts</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              slackConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-600'
            }`}
          ></span>
        </div>
        <p className="text-[11px] text-slate-400">
          {slackConnected ? 'Connected & listening for hourly quota events' : 'Connect Slack in dashboard for alerts'}
        </p>
      </div>
    </aside>
  );
};
