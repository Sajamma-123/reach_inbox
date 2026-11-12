import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, EmailBatch } from '../types';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { SlackBanner } from '../components/dashboard/SlackBanner';
import { Search, Plus, Mail, ChevronRight } from 'lucide-react';

interface DashboardPageProps {
  onOpenCompose: () => void;
  onSelectTab: (tab: 'dashboard' | 'scheduled' | 'sent') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenCompose, onSelectTab }) => {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [emails, setEmails] = useState<EmailBatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, emailsRes] = await Promise.all([
        api.get('/emails/stats'),
        api.get('/emails'),
      ]);
      if (statsRes.data?.stats) setStats(statsRes.data.stats);
      if (emailsRes.data?.data) setEmails(emailsRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data?.results || []);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const slackConnected = !!user?.slackConnection?.isActive;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Campaigns Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage scheduled and dispatched bulk email jobs</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search campaigns or recipients..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            onClick={onOpenCompose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Campaign</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <StatsOverview stats={stats} />

      {/* Slack Integration Banner */}
      <SlackBanner
        connected={slackConnected}
        channelName={user?.slackConnection?.channelName}
        onRefresh={refreshUser}
      />

      {/* Search Results Dropdown/View */}
      {searchResults !== null && (
        <div className="p-4 rounded-xl bg-[#0f1422] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300">
              Search Results ({searchResults.length})
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No matching emails found.</p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white">{item.subject || item.email?.subject}</span>
                    <span className="text-slate-400 ml-2">→ {item.recipientEmail}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Email Batches */}
      <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Recent Campaigns</h3>
          <button
            onClick={() => onSelectTab('scheduled')}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>View All Scheduled</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading campaigns...</div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-slate-300">No campaigns scheduled</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule your first email batch with delay and rate limits.
            </p>
            <button
              onClick={onOpenCompose}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Compose Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Sender</th>
                  <th className="py-3 px-3">Recipients</th>
                  <th className="py-3 px-3">Scheduled At</th>
                  <th className="py-3 px-3">Pacing</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {emails.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-white max-w-xs truncate">
                      {batch.subject}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {batch.sender?.name} ({batch.sender?.email})
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                        {batch._count?.recipients || 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(batch.scheduledAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {batch.delaySeconds}s delay · {batch.hourlyLimit}/hr
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                          batch.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : batch.status === 'SCHEDULED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {batch.status}
                      </span>
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
