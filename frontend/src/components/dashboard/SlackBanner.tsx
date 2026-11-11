import React, { useState } from 'react';
import { Slack, CheckCircle, RefreshCw, Send } from 'lucide-react';
import { api } from '../../services/api';

interface SlackBannerProps {
  connected: boolean;
  channelName?: string | null;
  onRefresh: () => void;
}

export const SlackBanner: React.FC<SlackBannerProps> = ({
  connected,
  channelName,
  onRefresh,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      const res = await api.get('/slack/connect');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      alert('Failed to initiate Slack connection: ' + err.message);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/slack/test');
      setTestResult(res.data?.message || 'Notification sent.');
    } catch (err: any) {
      setTestResult(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Slack notifications?')) return;
    try {
      await api.post('/slack/disconnect');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/60 text-[#ECB22E]">
          <Slack className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Slack Notifications</span>
            {connected ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> Connected {channelName ? `(#${channelName})` : ''}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Not connected</span>
            )}
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Receive automated notifications in your Slack channel whenever hourly sending quotas are reached.
          </p>
          {testResult && (
            <p className="text-xs text-emerald-400 mt-1 font-medium">{testResult}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
        {connected ? (
          <>
            <button
              onClick={handleTestAlert}
              disabled={testing}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-brand-400" />}
              <span>Test Alert</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="px-4 py-2 rounded-xl bg-[#4A154B] hover:bg-[#5b195c] text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all"
          >
            <Slack className="w-4 h-4 text-[#ECB22E]" />
            <span>Connect Slack</span>
          </button>
        )}
      </div>
    </div>
  );
};
