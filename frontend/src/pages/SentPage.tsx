import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SentJob } from '../types';
import { ExternalLink, RefreshCw, Mail } from 'lucide-react';

export const SentPage: React.FC = () => {
  const [jobs, setJobs] = useState<SentJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emails/jobs/sent?limit=50');
      if (res.data?.jobs) {
        setJobs(res.data.jobs);
      }
    } catch (err) {
      console.error('Failed to load sent emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">Delivered Emails</h2>

        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6">
        {loading && jobs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading delivery records...</div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Mail className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No delivered emails yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Delivered emails will appear here with preview links.
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
                  <th className="py-3 px-4">Delivered At</th>
                  <th className="py-3 px-4">Preview</th>
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
                    <td className="py-3.5 px-4 text-slate-400">
                      {job.executedAt ? new Date(job.executedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      {job.etherealPreviewUrl ? (
                        <a
                          href={job.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs font-semibold transition-colors"
                        >
                          <span>View Email</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">Preview unavailable</span>
                      )}
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
