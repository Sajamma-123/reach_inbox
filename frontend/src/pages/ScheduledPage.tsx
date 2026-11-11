import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ScheduledJob } from '../types';
import { Clock, RefreshCw, Calendar } from 'lucide-react';

export const ScheduledPage: React.FC = () => {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emails/jobs/scheduled?limit=50');
      if (res.data?.jobs) {
        setJobs(res.data.jobs);
      }
    } catch (err) {
      console.error('Failed to load scheduled jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Scheduled Queue</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time BullMQ delayed job heap stored in Redis. Guaranteed delivery even across server restarts.
          </p>
        </div>

        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6">
        {loading && jobs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">Checking Redis queue...</div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No pending or delayed jobs in queue</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All scheduled emails have been executed or no new campaign has been scheduled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Planned Execution</th>
                  <th className="py-3 px-4">Status & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-white">
                      {job.recipient?.recipientEmail}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {job.email?.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {job.email?.sender?.name} ({job.email?.sender?.email})
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      <span>{new Date(job.plannedExecutionTime).toLocaleTimeString()} ({new Date(job.plannedExecutionTime).toLocaleDateString()})</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`w-max px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            job.status === 'RESCHEDULED'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {job.status}
                        </span>
                        {job.failureReason && (
                          <span className="text-[10px] text-amber-400/80 italic max-w-xs truncate">
                            {job.failureReason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
