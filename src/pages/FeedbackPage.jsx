import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FeedbackPage({ publicSettings }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [service, setService] = useState('Motor Rental');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const hotelName = publicSettings?.business_profile?.hotelName || "Motor Rental Siem Reap Angkor & Guesthouse";
  const logo = publicSettings?.business_profile?.logo || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please write a brief feedback or review before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/public-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Anonymous Guest',
          country: country.trim() || 'Guest',
          rating: Number(rating) || 5,
          text: `[${service}] ${text.trim()}`
        })
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Unable to submit feedback. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f5] flex flex-col justify-between font-sans text-stone-800">
      {/* Top Banner */}
      <div className="py-6 px-4 text-center border-b border-stone-200/80 bg-white shadow-xs">
        <div className="max-w-md mx-auto flex flex-col items-center">
          {logo ? (
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain rounded-2xl mb-2.5 shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center text-xl mb-2.5">
              <i className="fa-solid fa-hotel"></i>
            </div>
          )}
          <h1 className="font-display font-bold text-lg text-stone-900 leading-snug">{hotelName}</h1>
          <p className="text-xs text-stone-500 mt-0.5">Siem Reap, Kingdom of Cambodia</p>
        </div>
      </div>

      {/* Main Feedback Form Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white border border-stone-200/90 rounded-3xl shadow-xl w-full max-w-lg p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-sm">
                <i className="fa-solid fa-check"></i>
              </div>
              <h2 className="font-display text-2xl font-bold text-stone-900">អរគុណច្រើន! / Thank You!</h2>
              <p className="text-stone-600 text-sm leading-relaxed max-w-sm mx-auto">
                Your feedback has been received. We truly appreciate your time and hope you have an incredible journey around Angkor!
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setText('');
                    setName('');
                    setCountry('');
                    setRating(5);
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
                >
                  Submit Another Feedback
                </button>
                <Link
                  to="/"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition shadow-sm"
                >
                  Visit Website
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center pb-2 border-b border-stone-100">
                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold uppercase tracking-wider rounded-full mb-2">
                  <i className="fa-solid fa-star text-amber-500 mr-1"></i> Guest Feedback
                </span>
                <h2 className="font-display text-2xl font-bold text-stone-900">How Was Your Experience?</h2>
                <p className="text-xs text-stone-500 mt-1">
                  Please leave us a rating and comment. Your review means the world to our local family business!
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Star Rating */}
              <div className="text-center py-2 bg-stone-50 rounded-2xl border border-stone-200/60">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Select Rating
                </label>
                <div className="flex justify-center gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="text-3xl sm:text-4xl transition-transform hover:scale-115 focus:outline-none"
                    >
                      <i
                        className={`fa-solid fa-star ${
                          (hoverRating || rating) >= star ? 'text-amber-400' : 'text-stone-200'
                        }`}
                      ></i>
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold text-stone-600 mt-1">
                  {rating === 5 && "Excellent (5/5) ⭐⭐⭐⭐⭐"}
                  {rating === 4 && "Very Good (4/5) ⭐⭐⭐⭐"}
                  {rating === 3 && "Average (3/5) ⭐⭐⭐"}
                  {rating === 2 && "Needs Improvement (2/5) ⭐⭐"}
                  {rating === 1 && "Poor (1/5) ⭐"}
                </p>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Service Used
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Motor Rental', label: 'Motorcycle', icon: 'fa-motorcycle' },
                    { id: 'Guesthouse Room', label: 'Guesthouse', icon: 'fa-bed' },
                    { id: 'Both / Tour', label: 'Both / Tour', icon: 'fa-compass' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setService(item.id)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 ${
                        service === item.id
                          ? 'border-brand-500 bg-brand-50/50 text-brand-700 shadow-xs'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <i className={`fa-solid ${item.icon}`}></i>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. David / Anna"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                    Country / City (Optional)
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. France / Phnom Penh"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                  />
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Your Review / Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows="4"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Share your thoughts about the bike condition, room cleanliness, staff hospitality..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition resize-none"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Submitting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i> Submit Feedback
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="py-4 text-center text-xs text-stone-400">
        © 2026 {hotelName}. All rights reserved.
      </div>
    </div>
  );
}
