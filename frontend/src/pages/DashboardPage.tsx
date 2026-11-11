import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, EmailBatch } from '../types';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { SlackBanner } from '../components/dashboard/SlackBanner';
import { Search, Plus, Users, ChevronRight } from 'lucide-react';

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
          <h2 className="text-2xl font-bold text-white tracking-tight">Campaign Operations</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time BullMQ job orchestration, distributed rate limits & Ethereal SMTP delivery
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Elasticsearch Search Bar */}
          <div className="relative w-64 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by subject, body, or email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>

          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule</span>
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
        <div className="p-5 rounded-2xl bg-[#111622] border border-brand-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-400">
              Elasticsearch Matches ({searchResults.length})
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear Search
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No matching emails found.</p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white">{item.subject || item.email?.subject}</span>
                    <span className="text-slate-400 ml-2">→ {item.recipientEmail}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Email Batches */}
      <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Recent Email Campaigns</h3>
            <p className="text-xs text-slate-400">All campaigns processed and queued via BullMQ</p>
          </div>
          <button
            onClick={() => onSelectTab('scheduled')}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <span>View All Jobs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading campaigns...</div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-300">No campaigns scheduled yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click the Compose button above to schedule your first batch with custom delay and hourly rate limits.
            </p>
            <button
              onClick={onOpenCompose}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-all"
            >
              Compose Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Scheduled At</th>
                  <th className="py-3 px-4">Pacing</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {emails.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {batch.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {batch.sender?.name} ({batch.sender?.email})
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono">
                        {batch._count?.recipients || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(batch.scheduledAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {batch.delaySeconds}s delay / max {batch.hourlyLimit}/hr
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
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
