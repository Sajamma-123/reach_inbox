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
      color: 'border-slate-800 text-blue-400',
    },
    {
      title: 'Scheduled',
      value: stats?.scheduledJobs ?? 0,
      icon: Clock,
      color: 'border-slate-800 text-amber-400',
    },
    {
      title: 'Delivered',
      value: stats?.completedJobs ?? 0,
      icon: CheckCircle2,
      color: 'border-slate-800 text-emerald-400',
    },
    {
      title: 'Rescheduled',
      value: (stats?.rateLimitedRecipients ?? 0) + (stats?.failedJobs ?? 0),
      icon: AlertTriangle,
      color: 'border-slate-800 text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="p-5 rounded-2xl bg-[#111622] border border-slate-800 shadow-md flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{card.value}</h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
