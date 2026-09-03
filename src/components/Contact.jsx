import { useState, useEffect } from 'react';
import { ContactSkeleton } from './Skeleton';

export default function Contact({ data, loading = false }) {
  const info = data || {};
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
      
      const elements = document.querySelectorAll('#contact .anim-fade-up, #contact .anim-scale-in');
      elements.forEach(el => obs.observe(el));

      // Fallback: make sure visible if already in viewport
      setTimeout(() => {
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('visible');
          }
        });
      }, 200);

      return () => obs.disconnect();
    }
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'Failed to send message. Please try again.');
      }
      setSent(true);
      setForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      console.error('Contact submission error:', err);
      setError(err.message || 'Unable to connect to server. Please try reaching us directly via Telegram or WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-5">
        <div className="text-center mb-12 anim-fade-up">
          <p className="section-label justify-center"><i className="fa-solid fa-envelope"></i> Contact</p>
          <div className="divider mx-auto"></div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-stone-900">Get In Touch</h2>
          <p className="text-stone-500 text-sm mt-2 max-w-sm mx-auto">Ready to book? Send us a message and we'll confirm within minutes.</p>
        </div>

        {loading ? (
          <ContactSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 anim-fade-up shadow-card">
              <form onSubmit={handleSubmit} className="space-y-4">
                {sent && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3 anim-fade-up">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>
                    <div>
                      <p className="font-bold">Message sent successfully!</p>
                      <p className="text-xs text-emerald-600">We will get back to you as soon as possible.</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 anim-fade-up">
                    <i className="fa-solid fa-circle-exclamation text-rose-500 text-lg mt-0.5"></i>
                    <div>
                      <p className="font-bold">Failed to send message</p>
                      <p className="text-xs text-rose-600 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1.5">Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="form-input" placeholder="Your name" required disabled={submitting} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1.5">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="form-input" placeholder="you@email.com" disabled={submitting} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5">Phone / Telegram / WhatsApp</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="form-input" placeholder="+855 ... or @username" disabled={submitting} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5">Message <span className="text-red-500">*</span></label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="form-input resize-none" rows="4" placeholder="Tell us your dates, number of guests, or any questions..." required disabled={submitting}></textarea>
                </div>

                <button type="submit" className="btn-primary w-full justify-center text-sm py-3" disabled={submitting || sent}>
                  {submitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Sending Message...</span>
                    </>
                  ) : sent ? (
                    <>
                      <i className="fa-solid fa-circle-check"></i>
                      <span>Message Sent!</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Map & Info */}
            <div className="space-y-5 anim-fade-up">
              {/* Contact info */}
              <div className="bg-stone-900 rounded-2xl p-6 text-white">
                <h3 className="font-display font-bold text-lg mb-4">Siem Reap Angkor</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3 items-start">
                    <i className="fa-solid fa-location-dot text-brand-400 mt-0.5 w-4"></i>
                    <span className="text-stone-300">{info.address || 'Near Angkor Wat Main Gate, Siem Reap, Cambodia'}</span>
                  </div>
                  {info.telegramUrl && (
                    <div className="flex gap-3 items-center">
                      <i className="fa-brands fa-telegram text-sky-400 w-4"></i>
                      <a href={info.telegramUrl} target="_blank" rel="noreferrer" className="text-stone-300 hover:text-white transition-colors">{info.telegramHandle || '@Motor_Rental_Siemreap_Angkor'}</a>
                    </div>
                  )}
                  {info.whatsappUrl && (
                    <div className="flex gap-3 items-center">
                      <i className="fa-brands fa-whatsapp text-green-400 w-4"></i>
                      <a href={info.whatsappUrl} target="_blank" rel="noreferrer" className="text-stone-300 hover:text-white transition-colors">{info.whatsappDisplay || '+855 016 308 199'}</a>
                    </div>
                  )}
                  <div className="flex gap-3 items-center">
                    <i className="fa-regular fa-clock text-amber-400 w-4"></i>
                    <span className="text-stone-300">{info.hours || 'Open Daily 6:00 AM – 10:00 PM'}</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-5 pt-5 border-t border-stone-700">
                  {info.telegramUrl && <a href={info.telegramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 bg-stone-800 hover:bg-sky-500/20 hover:text-sky-400 transition-all"><i className="fa-brands fa-telegram"></i></a>}
                  {info.whatsappUrl && <a href={info.whatsappUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 bg-stone-800 hover:bg-green-500/20 hover:text-green-400 transition-all"><i className="fa-brands fa-whatsapp"></i></a>}
                  {info.facebookUrl && <a href={info.facebookUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 bg-stone-800 hover:bg-blue-500/20 hover:text-blue-400 transition-all"><i className="fa-brands fa-facebook"></i></a>}
                  {info.mapUrl && <a href={info.mapUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-400 bg-stone-800 hover:bg-red-500/20 hover:text-red-400 transition-all"><i className="fa-solid fa-map-location-dot"></i></a>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Width Map */}
      <div className="w-full h-[400px] sm:h-[500px] mt-20 map-container overflow-hidden rounded-none shadow-none border-x-0 border-b-0 border-t border-stone-200">
        {loading ? (
          <div className="w-full h-full skeleton-shimmer"></div>
        ) : (
          <iframe
            src={info.mapEmbed || "https://maps.google.com/maps?q=13.3522648,103.8531593&hl=en&z=17&t=k&output=embed"}
            width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"
            title="Location Map">
          </iframe>
        )}
      </div>
    </section>
  );
}
