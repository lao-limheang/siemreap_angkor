import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Hero({ images, loading = false, texts }) {
  const navigate = useNavigate();
  const [heroImages, setHeroImages] = useState(images && Array.isArray(images) ? images.filter(Boolean) : []);
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    if (heroImages.length > 0) setCurrentIndex(prev => (prev + 1) % heroImages.length);
  };

  const prevSlide = () => {
    if (heroImages.length > 0) setCurrentIndex(prev => (prev - 1 + heroImages.length) % heroImages.length);
  };

  useEffect(() => {
    if (images && Array.isArray(images)) {
      setHeroImages(images.filter(Boolean));
    }
  }, [images]);

  useEffect(() => {
    if (heroImages.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % heroImages.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [heroImages]);

  const [lookingFor, setLookingFor] = useState('Room & Motorbike');

  const handleSearch = () => {
    if (lookingFor === 'Motorbike Rental') {
      navigate('/motor-rentals');
    } else if (lookingFor === 'Guesthouse Room') {
      navigate('/guesthouses');
    } else {
      const el = document.getElementById('contact');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/#contact');
      }
    }
  };

  return (
    <section id="home" className="relative flex flex-col">
      {/* 100vh height to take up the entire screen */}
      <div className="relative w-full min-h-[600px] h-screen md:h-screen overflow-hidden flex items-center justify-center">
        
        {/* Background Slideshow */}
        <div className="absolute inset-0 bg-stone-900 z-0">
          {loading ? (
            <div className="w-full h-full skeleton-dark-shimmer"></div>
          ) : heroImages.length > 0 ? (
            heroImages.map((img, i) => (
              <img 
                key={i} 
                src={img} 
                alt="Siem Reap Angkor" 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === currentIndex ? 'opacity-100' : 'opacity-0'}`} 
              />
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-700 select-none pointer-events-none">
              <i className="fa-solid fa-motorcycle text-9xl opacity-20"></i>
            </div>
          )}
          {/* Overlays for readability - adjusted for a clean look */}
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 z-10"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-20 w-full max-w-5xl mx-auto px-6 text-center pt-16 pb-32 md:pb-16">
          
          <div className="hero-anim-1">
            <h1 className="text-6xl md:text-8xl lg:text-[9rem] font-bold text-white mb-4 leading-none tracking-tight">
              {texts?.hero_title || 'Welcome'}
            </h1>
          </div>

          <div className="hero-anim-2 max-w-3xl mx-auto">
            <p className="font-display text-white text-lg md:text-2xl mb-12 leading-relaxed drop-shadow-md">
              {texts?.hero_subtitle || 'Eye catching premium motor rentals & comfortable stays in the heart of Siem Reap.'}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="hero-anim-3 flex flex-wrap gap-4 justify-center">
            <Link to="/motor-rentals" className="px-8 py-3.5 text-xs sm:text-[13px] font-bold tracking-[0.15em] uppercase text-white bg-brand-500 hover:bg-brand-600 rounded-full transition-all duration-300 shadow-lg shadow-brand-500/30 flex items-center gap-2">
              <i className="fa-solid fa-motorcycle"></i>
              <span>Motor Rentals</span>
            </Link>
            <Link to="/guesthouses" className="px-8 py-3.5 text-xs sm:text-[13px] font-bold tracking-[0.15em] uppercase text-white border border-white/70 rounded-full hover:bg-white hover:text-stone-900 transition-all duration-300 flex items-center gap-2">
              <i className="fa-solid fa-bed"></i>
              <span>Guesthouses</span>
            </Link>
          </div>
        </div>

        {/* Navigation Arrows */}
        {heroImages.length > 1 && (
          <>
            <button 
              onClick={prevSlide}
              className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <i className="fa-solid fa-chevron-left text-2xl"></i>
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <i className="fa-solid fa-chevron-right text-2xl"></i>
            </button>
          </>
        )}

        {/* Scroll down indicator - optional, but let's keep it visible above the card */}
        <div className="absolute bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 z-20 hero-anim-3 animate-bounce hidden md:block">
          <a href="#about" className="text-white/60 hover:text-white transition-colors">
            <i className="fa-solid fa-chevron-down text-2xl font-light"></i>
          </a>
        </div>
      </div>

      {/* Floating Booking Bar - modified for mobile to prevent massive overlap */}
      <div className="relative md:absolute md:bottom-0 md:left-1/2 md:-translate-x-1/2 md:translate-y-1/2 z-40 w-full max-w-6xl mx-auto px-4 md:px-8 hero-anim-3 -mt-20 md:mt-0 pb-10 md:pb-0">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] relative z-50">
          <h3 className="text-xl md:text-2xl font-bold text-stone-900 mb-6 font-display">Book Your Ride & Stay</h3>
          
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            
            <div className="flex-1">
              <label className="block text-xs font-bold text-stone-900 mb-2 ml-1">Looking For</label>
              <div className="relative">
                <select 
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  className="w-full appearance-none bg-stone-100 rounded-xl px-4 py-3.5 text-sm text-stone-700 font-medium border-2 border-transparent focus:border-brand outline-none transition-colors cursor-pointer"
                >
                  <option value="Room & Motorbike">Room & Motorbike</option>
                  <option value="Guesthouse Room">Guesthouse Room</option>
                  <option value="Motorbike Rental">Motorbike Rental</option>
                </select>
                <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none"></i>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-stone-900 mb-2 ml-1">Check-in</label>
              <input type="date" className="w-full bg-stone-100 rounded-xl px-4 py-3.5 text-sm text-stone-700 font-medium border-2 border-transparent focus:border-brand outline-none transition-colors" />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-stone-900 mb-2 ml-1">Check-out</label>
              <input type="date" className="w-full bg-stone-100 rounded-xl px-4 py-3.5 text-sm text-stone-700 font-medium border-2 border-transparent focus:border-brand outline-none transition-colors" />
            </div>

            {lookingFor !== 'Motorbike Rental' && (
              <div className="flex-1">
                <label className="block text-xs font-bold text-stone-900 mb-2 ml-1">Guests</label>
                <div className="relative">
                  <select className="w-full appearance-none bg-stone-100 rounded-xl px-4 py-3.5 text-sm text-stone-700 font-medium border-2 border-transparent focus:border-brand outline-none transition-colors cursor-pointer">
                    <option>2 Adults, 1 Room</option>
                    <option>1 Adult, 1 Room</option>
                    <option>4 Adults, 2 Rooms</option>
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none"></i>
                </div>
              </div>
            )}

            <div className="w-full md:w-auto mt-2 md:mt-0">
              <button onClick={handleSearch} className="w-full md:w-auto bg-[#8cc63f] hover:bg-[#7ab133] text-white font-bold rounded-xl px-10 py-3.5 transition-colors shadow-lg shadow-[#8cc63f]/30 whitespace-nowrap cursor-pointer">
                Search
              </button>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
