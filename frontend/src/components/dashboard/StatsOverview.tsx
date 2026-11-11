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
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    },
    {
      title: 'Scheduled in Queue',
      value: stats?.scheduledJobs ?? 0,
      icon: Clock,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    },
    {
      title: 'Delivered (Ethereal)',
      value: stats?.completedJobs ?? 0,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-brand-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      title: 'Rate-Limited / Rescheduled',
      value: (stats?.rateLimitedRecipients ?? 0) + (stats?.failedJobs ?? 0),
      icon: AlertTriangle,
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border bg-[#111622] backdrop-blur-sm shadow-xl flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-medium text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{card.value}</h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
