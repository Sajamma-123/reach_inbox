import React from 'react';
import { Mail, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DashboardStats } from '../../types';

interface StatsOverviewProps {
  stats: DashboardStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Total Campaigns',
      value: stats?.totalBatches ?? 0,
      icon: Mail,
      iconColor: 'text-blue-400',
    },
    {
      title: 'Scheduled Jobs',
      value: stats?.scheduledJobs ?? 0,
      icon: Clock,
      iconColor: 'text-amber-400',
    },
    {
      title: 'Delivered',
      value: stats?.completedJobs ?? 0,
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Rate-Limited / Failed',
      value: (stats?.rateLimitedRecipients ?? 0) + (stats?.failedJobs ?? 0),
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="p-4 rounded-xl bg-[#0f1422] border border-slate-800 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1 font-mono">{card.value}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
