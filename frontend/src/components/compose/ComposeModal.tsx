import React, { useState } from 'react';
import { X, Upload, Calendar, Clock, Gauge, AlertCircle, Check, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [detectedCount, setDetectedCount] = useState<number>(0);
  const [scheduledAt, setScheduledAt] = useState(() => {
    // Default to current time + 2 minutes
    const date = new Date(Date.now() + 2 * 60 * 1000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualChange = (val: string) => {
    setManualRecipients(val);
    updateTotalCount(val, file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const matches = text.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g) || [];
        const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
        setDetectedCount(unique.length + getManualCount(manualRecipients));
      };
      reader.readAsText(selected);
    } else {
      updateTotalCount(manualRecipients, null);
    }
  };

  const getManualCount = (val: string): number => {
    const matches = val.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g) || [];
    return new Set(matches.map((m) => m.toLowerCase())).size;
  };

  const updateTotalCount = (manualVal: string, attachedFile: File | null) => {
    let count = getManualCount(manualVal);
    if (!attachedFile) {
      setDetectedCount(count);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide email body content.');
      return;
    }
    if (detectedCount === 0 && !file) {
      setError('Please enter at least one recipient email address or upload a CSV file.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('scheduledAt', new Date(scheduledAt).toISOString());
      formData.append('delaySeconds', delaySeconds.toString());
      formData.append('hourlyLimit', hourlyLimit.toString());

      if (manualRecipients.trim()) {
        const recipientsArray = Array.from(
          new Set(
            manualRecipients
              .split(/[\n,;]+/)
              .map((r) => r.trim())
              .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
          )
        );
        formData.append('recipients', JSON.stringify(recipientsArray));
      }

      if (file) {
        formData.append('recipientsFile', file);
      }

      const res = await api.post('/emails/schedule', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111622] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div>
            <h2 className="text-lg font-bold text-white">Compose Email Campaign</h2>
            <p className="text-xs text-slate-400">Configure scheduling, delay pacing, and hourly rate limits</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Invitation to Join ReachInbox Beta"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Body (HTML or Plain Text)</label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hello {{name}},&#10;&#10;We are delighted to welcome you to our upcoming product release..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-mono text-xs leading-relaxed"
              required
            />
          </div>

          {/* Recipients Section */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Recipients (CSV Upload or Manual)</label>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Detected: {detectedCount} recipient{detectedCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            {/* Drag & drop file input */}
            <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500/60 rounded-xl p-4 text-center transition-all bg-slate-950/40">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-200">
                {file ? file.name : 'Upload CSV or TXT file of recipient emails'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Supports standard CSV with 'email' column or plain text list</p>
            </div>

            {/* Manual text area fallback */}
            <textarea
              rows={2}
              value={manualRecipients}
              onChange={(e) => handleManualChange(e.target.value)}
              placeholder="Or paste comma/newline separated emails: alex@example.com, sarah@company.org"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Schedule & Throttling Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Delay Between (sec)</span>
              </label>
              <input
                type="number"
                min="0"
                max="3600"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <span>Hourly Limit</span>
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Scheduling via BullMQ...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
