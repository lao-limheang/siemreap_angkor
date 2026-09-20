import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X, Quote } from 'lucide-react';
import { TestimonialsSkeleton } from './Skeleton';
import { asArray } from '../utils/dataNormalizer';
import { ReviewService } from '../services/DatabaseService';

/* ─── Gold palette ─── */
const GOLD = {
  50: '#fdfaf3',
  100: '#f9f0d8',
  200: '#f0dca6',
  300: '#e6c56e',
  400: '#d4a843',
  500: '#c49530',
  600: '#a87928',
  main: '#c49530',
  gradient: 'linear-gradient(135deg, #d4a843 0%, #c49530 40%, #a87928 100%)',
  shimmer: 'linear-gradient(135deg, #e6c56e 0%, #d4a843 30%, #c49530 60%, #a87928 100%)',
  glow: 'rgba(196,149,48,0.25)',
};

/* ─── Scrolling column with luxury cards ─── */
const TestimonialsColumn = (props) => {
  return (
    <div className={props.className} style={{ flex: 1, minWidth: 0 }}>
      <motion.ul
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 24,
          listStyle: 'none',
          margin: 0,
          padding: '0 0 24px 0',
        }}
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map((review, i) => (
                <motion.li
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  tabIndex={index === 1 ? -1 : 0}
                  whileHover={{
                    scale: 1.02,
                    y: -4,
                    transition: { type: "spring", stiffness: 400, damping: 20 }
                  }}
                  style={{
                    borderRadius: 20,
                    width: '100%',
                    cursor: 'default',
                    userSelect: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.35s ease',
                  }}
                  className="group focus:outline-none"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                    e.currentTarget.style.borderColor = 'rgba(196,149,48,0.25)';
                    e.currentTarget.style.boxShadow = '0 20px 50px -15px rgba(0,0,0,0.4), 0 0 30px rgba(196,149,48,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ padding: '28px 26px' }}>
                    {/* Quote icon */}
                    <div style={{
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <Quote size={20} style={{ color: GOLD.main, opacity: 0.5 }} />
                      {/* Star rating */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[...Array(review.rating || 5)].map((_, idx) => (
                          <i key={idx} className="fa-solid fa-star" style={{
                            fontSize: 11,
                            color: GOLD.main,
                          }}></i>
                        ))}
                      </div>
                    </div>

                    {/* Review text */}
                    <p style={{
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.75,
                      fontWeight: 400,
                      margin: '0 0 22px',
                      fontSize: 14,
                      fontStyle: 'italic',
                      letterSpacing: '0.01em',
                    }}>
                      "{review.text}"
                    </p>

                    {/* Author */}
                    <footer style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 18,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{
                        height: 40,
                        width: 40,
                        borderRadius: '50%',
                        background: GOLD.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1a1614',
                        fontSize: 15,
                        fontWeight: 700,
                        flexShrink: 0,
                        boxShadow: `0 4px 14px ${GOLD.glow}`,
                      }}>
                        {review.name ? review.name.charAt(0).toUpperCase() : <User size={16} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <cite style={{
                          fontWeight: 600,
                          fontStyle: 'normal',
                          letterSpacing: '-0.01em',
                          lineHeight: 1.3,
                          color: '#fff',
                          fontSize: 14,
                        }}>
                          {review.name}
                        </cite>
                        <span style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: 2,
                          letterSpacing: '0.02em',
                        }}>
                          {review.country}
                        </span>
                      </div>
                    </footer>
                  </div>
                </motion.li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
};

const DEFAULT_REVIEWS = [
  { name: 'Sarah Jenkins', country: 'United Kingdom', rating: 5, text: 'Rented a Honda Click for 4 days to visit Angkor Wat and Banteay Srei. The bike was in pristine condition, helmets were clean, and the family gave wonderful route recommendations.' },
  { name: 'Marc Dupont', country: 'France', rating: 5, text: 'Super friendly local hospitality! The room was spotless with cold AC, and having the scooter right downstairs made exploring Siem Reap completely effortless.' },
  { name: 'Alexandre Müller', country: 'Germany', rating: 5, text: 'Best rental experience in Southeast Asia. Transparent pricing, no passport hostage policy, and genuine kindness from the owners.' },
  { name: 'Lao Limheang', country: 'Cambodia', rating: 5, text: 'សេវាកម្មល្អខ្លាំង ម៉ូតូថ្មី ជិះស្រួល សុវត្ថិភាពខ្ពស់ បន្ទប់ស្អាត បុគ្គលិករួសរាយរាក់ទាក់!' },
  { name: 'Elena Rostova', country: 'Poland', rating: 5, text: 'Wonderful guesthouse close to everything yet quiet at night. The owners helped us organize an early morning sunrise tour to Angkor Wat.' },
  { name: 'Kenji Sato', country: 'Japan', rating: 5, text: 'Very clean motorbike and fair price. The staff explained the traffic rules and temple checkpoints clearly.' }
];

export default function Testimonials({ data, loading = false }) {
  const reviews = asArray(data);
  const displayReviews = reviews.length > 0 ? reviews : DEFAULT_REVIEWS;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  if (loading) {
    return (
      <section id="feedback" className="py-20 md:py-24" style={{ background: '#0f0d0b', color: '#fff' }}>
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16 anim-fade-up">
            <p className="section-label justify-center" style={{ color: GOLD.main }}>
              <i className="fa-solid fa-star"></i> Customer Feedback
            </p>
            <div className="divider mx-auto" style={{ background: GOLD.main }}></div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: '#fff' }}>What Our Guests Say</h2>
          </div>
          <TestimonialsSkeleton />
        </div>
      </section>
    );
  }

  // Split into 4 columns for full-width coverage
  const colCount = 4;
  const columns = Array.from({ length: colCount }, (_, i) => {
    const col = displayReviews.filter((_, idx) => idx % colCount === i);
    return col.length ? col : displayReviews;
  });

  return (
    <>
      <section
        id="feedback"
        aria-labelledby="testimonials-heading"
        style={{
          background: '#0f0d0b',
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Subtle luxury background effects */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          {/* Radial glow */}
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '70vw',
            height: '60vh',
            background: `radial-gradient(ellipse, rgba(196,149,48,0.06) 0%, transparent 70%)`,
          }} />
          {/* Subtle grain overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }} />
          {/* Side fade lines */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: 1,
            background: `linear-gradient(180deg, transparent 0%, rgba(196,149,48,0.15) 30%, rgba(196,149,48,0.15) 70%, transparent 100%)`,
          }} />
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: 1,
            background: `linear-gradient(180deg, transparent 0%, rgba(196,149,48,0.15) 30%, rgba(196,149,48,0.15) 70%, transparent 100%)`,
          }} />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              textAlign: 'center',
              padding: '5rem 1.5rem 2.5rem',
              maxWidth: 700,
              margin: '0 auto',
            }}
          >
            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 22px',
              borderRadius: 50,
              border: `1px solid rgba(196,149,48,0.25)`,
              background: 'rgba(196,149,48,0.06)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: GOLD.main,
              marginBottom: 24,
            }}>
              <i className="fa-solid fa-star" style={{ fontSize: 9 }}></i>
              Guest Reviews
            </div>

            <h2
              id="testimonials-heading"
              style={{
                fontFamily: "'Playfair Display', 'Battambang', Georgia, serif",
                fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#fff',
                margin: '0 0 18px',
                lineHeight: 1.15,
              }}
            >
              What Our Guests{' '}
              <span style={{
                background: GOLD.shimmer,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Say About Us
              </span>
            </h2>

            <p style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16,
              lineHeight: 1.7,
              maxWidth: 480,
              margin: '0 auto 32px',
              letterSpacing: '0.01em',
            }}>
              Hear from travellers who have experienced our premium motor rentals and comfortable guesthouses in Siem Reap.
            </p>

            {/* CTA */}
            <motion.button
              onClick={() => { setIsModalOpen(true); setSubmitSuccess(false); }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '14px 32px',
                background: GOLD.gradient,
                color: '#1a1614',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 8px 30px ${GOLD.glow}, 0 2px 8px rgba(0,0,0,0.3)`,
                letterSpacing: '-0.01em',
              }}
            >
              <i className="fa-solid fa-pen-to-square"></i>
              Leave a Review
            </motion.button>
          </motion.div>

          {/* Full-width scrolling columns */}
          <div
            style={{
              display: 'flex',
              gap: 20,
              padding: '1rem 24px 5rem',
              maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
              maxHeight: 580,
              overflow: 'hidden',
              position: 'relative',
            }}
            role="region"
            aria-label="Scrolling Testimonials"
          >
            <TestimonialsColumn testimonials={columns[0]} duration={9} />
            <TestimonialsColumn testimonials={columns[1]} className="hidden sm:block" duration={13} />
            <TestimonialsColumn testimonials={columns[2]} className="hidden md:block" duration={11} />
            <TestimonialsColumn testimonials={columns[3]} className="hidden lg:block" duration={8} />
          </div>
        </div>
      </section>

      {/* ───── Luxury Review Modal ───── */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
              background: 'rgba(10,8,6,0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: '100%',
                maxWidth: 480,
                background: '#1a1816',
                borderRadius: 24,
                border: '1px solid rgba(196,149,48,0.15)',
                boxShadow: `0 30px 80px -15px rgba(0,0,0,0.6), 0 0 60px rgba(196,149,48,0.06)`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Gold top accent */}
              <div style={{
                height: 3,
                background: GOLD.shimmer,
              }} />

              {/* Close */}
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s ease', zIndex: 10,
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                <X size={16} />
              </button>

              <div style={{ padding: '28px 30px 32px' }}>
                <AnimatePresence mode="wait">
                  {submitSuccess ? (
                    /* ─── Success ─── */
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      style={{ textAlign: 'center', padding: '20px 0' }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                        style={{
                          width: 68, height: 68, borderRadius: '50%',
                          background: GOLD.gradient,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 20px',
                          boxShadow: `0 10px 30px ${GOLD.glow}`,
                          color: '#1a1614', fontSize: 28, fontWeight: 700,
                        }}
                      >
                        ✓
                      </motion.div>
                      <h3 style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: 22, fontWeight: 700, color: '#fff',
                        margin: '0 0 8px',
                      }}>
                        Thank You!
                      </h3>
                      <p style={{
                        color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6,
                        maxWidth: 300, margin: '0 auto 24px',
                      }}>
                        Your review is now live. We sincerely appreciate your feedback.
                      </p>
                      <button
                        onClick={() => setIsModalOpen(false)}
                        style={{
                          padding: '12px 28px', fontSize: 14, fontWeight: 700,
                          color: '#1a1614', background: GOLD.gradient,
                          border: 'none', borderRadius: 12, cursor: 'pointer',
                          boxShadow: `0 6px 20px ${GOLD.glow}`,
                        }}
                      >
                        Done
                      </button>
                    </motion.div>
                  ) : (
                    /* ─── Form ─── */
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!formRating) {
                          alert('Please select a rating before submitting.');
                          return;
                        }
                        setIsSubmitting(true);
                        try {
                          const reviewData = { name, country, rating: formRating, text };
                          // Write to Firebase (shared cloud) first
                          await ReviewService.create({ ...reviewData, createdAt: Date.now() }).catch(() => {});
                          // Also sync to API (server-side backup)
                          const res = await fetch('/api/public-reviews', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(reviewData)
                          });
                          if (res.ok) {
                            setSubmitSuccess(true);
                            setName(''); setCountry(''); setText(''); setFormRating(0);
                          } else {
                            alert('Something went wrong, please try again.');
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Failed to submit review.');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      {/* Title */}
                      <div style={{ marginBottom: 24 }}>
                        <h3 style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: 22, fontWeight: 700, color: '#fff',
                          margin: '0 0 6px',
                        }}>
                          Write a Review
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                          Share your experience — we appreciate your honest feedback.
                        </p>
                      </div>

                      {/* Star Rating */}
                      <div style={{
                        padding: '16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.06)',
                        marginBottom: 20,
                        textAlign: 'center',
                      }}>
                        <label style={{
                          display: 'block', fontSize: 11, fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.12em',
                          color: 'rgba(255,255,255,0.35)', marginBottom: 12,
                        }}>
                          Your Rating
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          {[1, 2, 3, 4, 5].map(star => {
                            const active = star <= (hoverRating || formRating);
                            return (
                              <motion.button
                                key={star}
                                type="button"
                                onClick={() => setFormRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.85 }}
                                style={{
                                  width: 44, height: 44, borderRadius: 12,
                                  background: active ? 'rgba(196,149,48,0.12)' : 'rgba(255,255,255,0.03)',
                                  border: active ? `1.5px solid rgba(196,149,48,0.3)` : '1.5px solid transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <i className="fa-solid fa-star" style={{
                                  fontSize: 18,
                                  color: active ? GOLD.main : 'rgba(255,255,255,0.15)',
                                  transition: 'color 0.2s ease',
                                }}></i>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Name & Country */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                          <label style={modalLabelStyle}>Name</label>
                          <input
                            type="text" value={name} onChange={e => setName(e.target.value)}
                            required placeholder="John Doe" disabled={isSubmitting}
                            style={modalInputStyle}
                            onFocus={(e) => { e.target.style.borderColor = 'rgba(196,149,48,0.35)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                          />
                        </div>
                        <div>
                          <label style={modalLabelStyle}>Country</label>
                          <input
                            type="text" value={country} onChange={e => setCountry(e.target.value)}
                            required placeholder="USA" disabled={isSubmitting}
                            style={modalInputStyle}
                            onFocus={(e) => { e.target.style.borderColor = 'rgba(196,149,48,0.35)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                          />
                        </div>
                      </div>

                      {/* Review */}
                      <div style={{ marginBottom: 22 }}>
                        <label style={modalLabelStyle}>Your Review</label>
                        <textarea
                          value={text} onChange={e => setText(e.target.value)}
                          required rows="3" placeholder="Tell us about your stay or ride..."
                          disabled={isSubmitting}
                          style={{ ...modalInputStyle, resize: 'none', minHeight: 90 }}
                          onFocus={(e) => { e.target.style.borderColor = 'rgba(196,149,48,0.35)'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        />
                      </div>

                      {/* Submit */}
                      <motion.button
                        type="submit"
                        disabled={isSubmitting}
                        whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                        whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
                        style={{
                          width: '100%', padding: '14px',
                          background: isSubmitting
                            ? 'rgba(196,149,48,0.4)'
                            : GOLD.gradient,
                          color: '#1a1614', fontWeight: 700, fontSize: 14,
                          border: 'none', borderRadius: 12,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: `0 8px 25px ${GOLD.glow}`,
                          opacity: isSubmitting ? 0.7 : 1,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {isSubmitting ? (
                          <>
                            <motion.i
                              className="fa-solid fa-circle-notch"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-paper-plane"></i>
                            Submit Review
                          </>
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Modal styles ─── */
const modalLabelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 6,
};

const modalInputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  fontSize: 14,
  color: '#fff',
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
  transition: 'all 0.2s ease',
  boxSizing: 'border-box',
};
