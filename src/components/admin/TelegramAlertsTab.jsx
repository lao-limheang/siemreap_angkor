import { useState } from 'react';

export default function TelegramAlertsTab({
  auth,
  cardCls,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const sendAlert = async (type, customSubject = '', customMessage = '') => {
    setSending(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/telegram/send-alert', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          type,
          subject: customSubject,
          message: customMessage
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Telegram alert sent successfully!' });
        if (type === 'custom') {
          setSubject('');
          setMessage('');
        }
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to send alert: ' + (data.error || 'Check bot settings') });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Network error: ' + e.message });
    } finally {
      setSending(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendAlert('custom', subject.trim() || 'Custom Announcement', message.trim());
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className={`${cardCls} p-5 sm:p-6`}>
        <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-5">
          <div>
            <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2">
              <i className="fa-brands fa-telegram text-sky-500"></i>
              Telegram Alert Center (មជ្ឈមណ្ឌល Alert Telegram)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Send instant operational updates, reminders, and custom messages directly to your staff Telegram channel.
            </p>
          </div>
          <button
            onClick={() => sendAlert('test')}
            disabled={sending}
            className={`${btnSecondary} text-xs flex items-center gap-1.5`}
          >
            <i className="fa-solid fa-satellite-dish text-sky-500"></i> Test Bot Connection
          </button>
        </div>

        {statusMessage && (
          <div className={`p-4 mb-5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <i className={`fa-solid ${statusMessage.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Quick Send Preset Buttons */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-3">
            Quick One-Click Alerts (ផ្ញើ Alert ភ្លាមៗ)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => sendAlert('dashboard')}
              disabled={sending}
              className="p-4 bg-stone-50 hover:bg-stone-100/80 border border-stone-200/80 rounded-2xl flex flex-col items-center justify-center gap-2 transition group text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-gauge"></i>
              </div>
              <span className="text-xs font-bold text-stone-700">Dashboard Summary</span>
            </button>

            <button
              onClick={() => sendAlert('motos')}
              disabled={sending}
              className="p-4 bg-stone-50 hover:bg-stone-100/80 border border-stone-200/80 rounded-2xl flex flex-col items-center justify-center gap-2 transition group text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-motorcycle"></i>
              </div>
              <span className="text-xs font-bold text-stone-700">ស្ថានភាពម៉ូតូ (Fleet)</span>
            </button>

            <button
              onClick={() => sendAlert('overdue')}
              disabled={sending}
              className="p-4 bg-rose-50/60 hover:bg-rose-50 border border-rose-200/80 rounded-2xl flex flex-col items-center justify-center gap-2 transition group text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <span className="text-xs font-bold text-rose-700">Overdue Warning</span>
            </button>

            <button
              onClick={() => sendAlert('income')}
              disabled={sending}
              className="p-4 bg-stone-50 hover:bg-stone-100/80 border border-stone-200/80 rounded-2xl flex flex-col items-center justify-center gap-2 transition group text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-hand-holding-dollar"></i>
              </div>
              <span className="text-xs font-bold text-stone-700">ចំណូល (Income Alert)</span>
            </button>
          </div>
        </div>

        {/* Custom Message Sender */}
        <div className="border-t border-stone-100 pt-5">
          <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-3">
            Custom Message to Staff Group (ផ្ញើសារបន្ទាន់)
          </h4>
          <form onSubmit={handleCustomSubmit} className="space-y-4 text-xs">
            <div>
              <label className={labelCls}>Subject / Topic</label>
              <input
                type="text"
                placeholder="e.g. Morning Briefing / Important Reminder"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Message Text <span className="text-red-500">*</span></label>
              <textarea
                rows="4"
                required
                placeholder="Type your message here to dispatch immediately to Telegram..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className={inputCls}
              ></textarea>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}
              >
                <i className="fa-solid fa-paper-plane"></i>
                {sending ? 'Sending...' : 'Send to Telegram'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
