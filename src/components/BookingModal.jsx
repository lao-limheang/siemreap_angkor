import { useState, useEffect } from 'react';
import { syncBookingToOldSystem } from '../services/DatabaseService';

export default function BookingModal({ isOpen, onClose, type, itemName, pricePerDay, bedCount, bikeId }) {
  const [form, setForm] = useState({ customerName: '', phone: '', startDate: '', endDate: '', bedCount: bedCount || 1, guests: 1, specialRequests: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm(f => ({ ...f, bedCount: bedCount || 1 })); setStatus('idle'); setError(''); }
  }, [isOpen, bedCount]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalDays = form.startDate && form.endDate
    ? Math.max(1, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000)) : 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      // 1. Sync directly to chafe-2026 realtime Firestore (Old system sees it immediately!)
      await syncBookingToOldSystem({
        type: type === 'motor' ? 'motor' : 'room',
        itemName,
        bikeId,
        pricePerDay,
        totalDays,
        ...form
      }).catch(console.error);

      // 2. Submit to local server for SQLite + Telegram alert
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type === 'motor' ? 'motor' : 'room', itemName, ...form })
      });

      if (res.ok) setStatus('success');
      else { const d = await res.json(); setError(d.error || 'Failed'); setStatus('error'); }
    } catch { setError('Network error. Please try again.'); setStatus('error'); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border border-stone-200"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{type === 'motor' ? '🛵 Motor Booking' : '🏨 Room Booking'}</h2>
            <p className="text-sm text-brand-500 font-medium">{itemName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {status === 'success' ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-green-500 text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">Booking Submitted!</h3>
            <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto">We'll contact you via Telegram or WhatsApp shortly to confirm your booking.</p>
            <button onClick={onClose} className="btn-primary mx-auto">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">Full Name *</label>
                <input type="text" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="form-input" placeholder="Your full name" required />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">Phone / Telegram *</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="form-input" placeholder="+855 or @telegramUsername" required />
              </div>

              {type === 'room' && (
                <>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-stone-500 mb-2">Bed Configuration</label>
                    <div className="flex gap-2">
                      {[1,2,3].map(b => (
                        <button key={b} type="button" onClick={() => setForm({...form, bedCount: b})}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${form.bedCount === b ? 'bg-brand-500 text-white border-brand-500' : 'text-stone-600 border-stone-200 hover:border-brand-400'}`}>
                          {b} Bed{b > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1.5">Guests</label>
                    <input type="number" min="1" max="10" value={form.guests} onChange={e => setForm({...form, guests: e.target.value})} className="form-input" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">{type === 'motor' ? 'Start Date *' : 'Check-in *'}</label>
                <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="form-input" required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">{type === 'motor' ? 'End Date *' : 'Check-out *'}</label>
                <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="form-input" required min={form.startDate || new Date().toISOString().split('T')[0]} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">Special Requests</label>
                <textarea value={form.specialRequests} onChange={e => setForm({...form, specialRequests: e.target.value})} className="form-input resize-none" rows="3" placeholder="Delivery address, early check-in, etc." />
              </div>
            </div>

            {form.startDate && form.endDate && (
              <div className="bg-warm-50 border border-warm-200 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-stone-500">${pricePerDay} × {totalDays} night{totalDays > 1 ? 's' : ''}</span>
                <span className="text-lg font-bold text-brand-500">${pricePerDay * totalDays} est.</span>
              </div>
            )}

            <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {status === 'submitting' ? <><div className="animate-spin h-4 w-4 border-t-2 border-white rounded-full"></div> Submitting...</> : <><i className="fa-solid fa-calendar-check"></i> Confirm Booking</>}
            </button>
            <p className="text-center text-xs text-stone-400">We'll contact you via Telegram/WhatsApp to confirm.</p>
          </form>
        )}
      </div>
    </div>
  );
}
