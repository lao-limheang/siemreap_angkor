import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X } from 'lucide-react';
import { TestimonialsSkeleton } from './Skeleton';

const TestimonialsColumn = (props) => {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent transition-colors duration-300 list-none m-0 p-0"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map((review, i) => {
                return (
                  <motion.li 
                    key={`${index}-${i}`}
                    aria-hidden={index === 1 ? "true" : "false"}
                    tabIndex={index === 1 ? -1 : 0}
                    whileHover={{ 
                      scale: 1.03,
                      y: -8,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                      transition: { type: "spring", stiffness: 400, damping: 17 }
                    }}
                    className="p-8 rounded-3xl border border-stone-200 shadow-lg shadow-black/5 max-w-xs w-full bg-white transition-all duration-300 cursor-default select-none group focus:outline-none focus:ring-2 focus:ring-brand-500/30" 
                  >
                    <blockquote className="m-0 p-0">
                      {/* Render rating */}
                      <div className="flex text-amber-400 text-[10px] mb-4">
                        {[...Array(review.rating)].map((_, idx) => <i key={idx} className="fa-solid fa-star mr-0.5"></i>)}
                      </div>
                      <p className="text-stone-600 leading-relaxed font-medium m-0 transition-colors duration-300 italic text-sm">
                        "{review.text}"
                      </p>
                      <footer className="flex items-center gap-3 mt-6">
                        <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                          <User size={20} />
                        </div>
                        <div className="flex flex-col">
                          <cite className="font-bold not-italic tracking-tight leading-5 text-stone-900 transition-colors duration-300">
                            {review.name}
                          </cite>
                          <span className="text-xs leading-5 tracking-tight text-stone-500 mt-0.5 transition-colors duration-300">
                            {review.country}
                          </span>
                        </div>
                      </footer>
                    </blockquote>
                  </motion.li>
                );
              })}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
};

export default function Testimonials({ data, loading = false }) {
  const reviews = data || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <section id="feedback" className="py-20 md:py-24 bg-stone-50 text-stone-900">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16 anim-fade-up">
            <p className="section-label justify-center text-brand-500"><i className="fa-solid fa-star"></i> Customer Feedback</p>
            <div className="divider mx-auto bg-brand-500"></div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">What Our Riders Say</h2>
          </div>
          <TestimonialsSkeleton />
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  // Split reviews into columns
  const firstColumn = reviews.slice(0, Math.ceil(reviews.length / 3));
  const secondColumn = reviews.slice(Math.ceil(reviews.length / 3), Math.ceil((reviews.length * 2) / 3));
  const thirdColumn = reviews.slice(Math.ceil((reviews.length * 2) / 3));

  const col1 = firstColumn.length ? firstColumn : reviews;
  const col2 = secondColumn.length ? secondColumn : reviews;
  const col3 = thirdColumn.length ? thirdColumn : reviews;

  return (
    <>
      <section 
        id="feedback"
        aria-labelledby="testimonials-heading"
        className="bg-stone-50 py-24 relative overflow-hidden"
      >
        <motion.div 
          initial={{ opacity: 0, y: 50, rotate: -2 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ 
            duration: 1.2, 
            ease: [0.16, 1, 0.3, 1],
            opacity: { duration: 0.8 }
          }}
          className="container px-4 z-10 mx-auto max-w-7xl"
        >
          <div className="flex flex-col items-center justify-center max-w-2xl mx-auto mb-4">
            <div className="flex justify-center mb-6">
              <div className="border border-stone-200 py-1.5 px-5 rounded-full text-xs font-bold tracking-widest uppercase text-brand-500 bg-white shadow-sm transition-colors flex items-center gap-2">
                <i className="fa-solid fa-star text-[10px]"></i> Customer Feedback
              </div>
            </div>

            <h2 id="testimonials-heading" className="text-4xl md:text-5xl font-display font-bold tracking-tight mt-2 text-center text-stone-900 transition-colors">
              What Our Riders Say
            </h2>
            <p className="text-center mt-5 text-stone-500 text-lg leading-relaxed max-w-md transition-colors">
              Discover why travellers love our premium motor rentals and comfortable guesthouses.
            </p>

            <button onClick={() => setIsModalOpen(true)} className="btn-primary mt-8 shadow-md hover:-translate-y-1 transition-transform cursor-pointer">
              <i className="fa-solid fa-pen-to-square"></i> Leave a Review
            </button>
          </div>

          <div 
            className="flex justify-center gap-6 mt-16 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[500px] overflow-hidden relative"
            role="region"
            aria-label="Scrolling Testimonials"
          >
            <TestimonialsColumn testimonials={col1} duration={8} />
            <TestimonialsColumn testimonials={col2} className="hidden md:block" duration={12} />
            <TestimonialsColumn testimonials={col3} className="hidden lg:block" duration={10} />
          </div>
        </motion.div>
      </section>

      {/* Review Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
              
              <div className="p-8 sm:p-10">
                <h3 className="text-2xl font-display font-bold text-stone-900 mb-2">Write a Review</h3>
                <p className="text-stone-500 text-sm mb-8">Share your experience with us. We appreciate your feedback!</p>
                
                <form 
                  onSubmit={async (e) => { 
                    e.preventDefault(); 
                    if (!formRating) {
                      alert('Please select a rating before submitting.');
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const res = await fetch('/api/public-reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, country, rating: formRating, text })
                      });
                      if (res.ok) {
                        setIsModalOpen(false);
                        setName('');
                        setCountry('');
                        setText('');
                        setFormRating(0);
                        setTimeout(() => alert('Thank you! Your review is now live.'), 300);
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
                  className="space-y-5"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-900 mb-2">Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-700 font-medium border border-stone-200 focus:border-brand-500 focus:bg-white outline-none transition-colors" placeholder="John Doe" disabled={isSubmitting} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-900 mb-2">Country</label>
                      <input type="text" value={country} onChange={e => setCountry(e.target.value)} required className="w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-700 font-medium border border-stone-200 focus:border-brand-500 focus:bg-white outline-none transition-colors" placeholder="USA" disabled={isSubmitting} />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-stone-900 mb-2">Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          type="button" 
                          onClick={() => setFormRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className={`text-2xl transition-colors ${star <= (hoverRating || formRating) ? 'text-amber-400' : 'text-stone-300 hover:text-amber-300'}`}
                        >
                          <i className="fa-solid fa-star"></i>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-900 mb-2">Your Review</label>
                    <textarea value={text} onChange={e => setText(e.target.value)} required rows="4" className="w-full bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-700 font-medium border border-stone-200 focus:border-brand-500 focus:bg-white outline-none transition-colors resize-none" placeholder="Tell us about your stay or ride..." disabled={isSubmitting}></textarea>
                  </div>
                  
                  <button type="submit" disabled={isSubmitting} className="w-full btn-primary justify-center mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
