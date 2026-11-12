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
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Delivered Emails</h2>
          <p className="text-xs text-slate-400 mt-0.5">Dispatched emails with preview verification links</p>
        </div>

        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-5">
        {loading && jobs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading delivery records...</div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Mail className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No delivered emails yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Delivered emails will appear here with live preview links.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Sender</th>
                  <th className="py-3 px-3">Delivered At</th>
                  <th className="py-3 px-3">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-white">
                      {job.recipient?.recipientEmail}
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                      {job.email?.subject}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {job.email?.sender?.name} ({job.email?.sender?.email})
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {job.executedAt ? new Date(job.executedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-3">
                      {job.etherealPreviewUrl ? (
                        <a
                          href={job.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors"
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
