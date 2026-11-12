import React, { useState } from 'react';
import { Slack, CheckCircle, RefreshCw, Send, Settings, Check } from 'lucide-react';
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
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelInput, setChannelInput] = useState('#general');
  const [savingWebhook, setSavingWebhook] = useState(false);

  const handleConnectOAuth = async () => {
    try {
      const res = await api.get('/slack/connect');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      alert('Failed to initiate Slack connection: ' + err.message);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim().startsWith('https://hooks.slack.com/')) {
      alert('Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/');
      return;
    }
    setSavingWebhook(true);
    setTestResult(null);
    try {
      const res = await api.post('/slack/webhook', {
        webhookUrl: webhookUrl.trim(),
        channelName: channelInput.trim() || '#general',
      });
      setTestResult(res.data?.message || 'Webhook saved successfully!');
      setShowWebhookForm(false);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to save webhook');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/slack/test');
      setTestResult(res.data?.message || 'Test notification sent!');
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
      setTestResult(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[#0f1422] border border-slate-800 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
            <Slack className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Slack Notifications
              </h4>
              {connected ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <CheckCircle className="w-3 h-3" /> Active {channelName ? `(${channelName})` : ''}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Not configured</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Receives automated notifications in your Slack channel whenever hourly email limits are reached.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {connected ? (
            <>
              <button
                onClick={handleTestAlert}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-blue-400" />}
                <span>Test Alert</span>
              </button>
              <button
                onClick={() => setShowWebhookForm(!showWebhookForm)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Configure Webhook"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 text-xs transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWebhookForm(!showWebhookForm)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-blue-400" />
                <span>Configure Webhook</span>
              </button>
              <button
                onClick={handleConnectOAuth}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Slack className="w-3.5 h-3.5" />
                <span>Connect via OAuth</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {testResult && (
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center justify-between">
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {showWebhookForm && (
        <form onSubmit={handleSaveWebhook} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          <p className="text-xs font-medium text-slate-300">Enter your Slack Incoming Webhook URL:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              required
            />
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="#channel"
              className="w-28 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={savingWebhook}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {savingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Webhook</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
