import { useEffect } from 'react';
import { AboutUsSkeleton } from './Skeleton';

export default function AboutUs({ data, servicesBarData, whyUsData, loading = false }) {
  useEffect(() => {
    if (!loading) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('#about .anim-fade-up, .services-bar-anim').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }
  }, [loading]);

  if (loading) {
    return (
      <section id="about" className="section-pad bg-stone-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5">
          <AboutUsSkeleton />
        </div>
      </section>
    );
  }

  // --- About Us Data ---
  const info = data || {};
  const label = info.label || 'About Us';
  const title = info.title || 'Local Experts in Siem Reap';
  const p1 = info.p1 || 'Founded by a local family passionate about hospitality, Siem Reap Angkor has been providing premium motor rentals and comfortable guesthouse accommodations for over a decade.';
  const p2 = info.p2 || 'We believe in honest service, well-maintained vehicles, and giving you the best local tips to explore the magnificent Angkor Wat temples and surrounding countryside safely and at your own pace.';
  const image1 = info.image1 || '';
  const image2 = info.image2 || '';
  const badgeText = info.badgeText || '10+ Years Experience';

  // --- Services Bar Data ---
  const servicesBar = servicesBarData && servicesBarData.length > 0 ? servicesBarData : [
    { icon: 'fa-plane-arrival', label: 'Airport Pickup', desc: 'We pick you up' },
    { icon: 'fa-shirt', label: 'Laundry Service', desc: 'Same-day service' },
    { icon: 'fa-suitcase', label: 'Luggage Storage', desc: 'Free & secure' },
    { icon: 'fa-motorcycle', label: 'Motor Rental Combo', desc: 'Bundle & save' },
  ];

  // --- Why Us Data ---
  const whyUs = whyUsData || {};
  const stats = whyUs.stats || [];
  const features = whyUs.features || [];

  return (
    <section id="about" className="section-pad bg-stone-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5">
        
        {/* Services Bar Row */}
        <div className="mb-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 services-bar-anim anim-fade-up">
            {servicesBar.map((s, i) => (
              <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow">
                <div className="amenity-icon bg-stone-50 shadow-sm mb-1 text-brand-500">
                  <i className={`fa-solid ${s.icon}`}></i>
                </div>
                <p className="text-sm font-bold text-stone-900">{s.label}</p>
                <p className="text-xs text-stone-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main About Us Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
          
          {/* Text Content & Stats */}
          <div className="anim-fade-up">
            <p className="section-label"><i className="fa-solid fa-store"></i> {label}</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-stone-900 mb-6 leading-tight">
              {title}
            </h2>
            <p className="text-stone-600 mb-4 leading-relaxed text-sm md:text-base">
              {p1}
            </p>
            {p2 && (
              <p className="text-stone-600 mb-8 leading-relaxed text-sm md:text-base">
                {p2}
              </p>
            )}

            {/* Action Button & Experience Badge */}
            <div className="flex flex-wrap items-center gap-4 pt-2 mb-10">
              <a href="#bikes" className="btn-primary text-xs tracking-wider uppercase">
                Explore Our Fleet <i className="fa-solid fa-arrow-right ml-1"></i>
              </a>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-sm text-xs font-bold text-stone-700">
                <i className="fa-solid fa-award text-amber-500 text-base"></i>
                <span>{badgeText}</span>
              </div>
            </div>

            {/* Stats Grid from Database */}
            {stats && stats.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {stats.map((s, i) => (
                  <div key={i} className="text-center p-4 bg-white border border-stone-200 rounded-xl">
                    <p className="text-2xl font-bold text-brand-500 font-display">{s.num}</p>
                    <p className="text-xs text-stone-500 font-medium mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Images Showcase */}
          <div className="anim-fade-up relative">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="space-y-4">
                {image1 ? (
                  <img
                    src={image1}
                    alt="Siem Reap Angkor Story"
                    className="rounded-3xl h-60 sm:h-80 md:h-96 object-cover w-full shadow-xl bg-stone-200 border-4 border-white transition-transform hover:scale-[1.02] duration-300"
                  />
                ) : (
                  <div className="rounded-3xl h-60 sm:h-80 md:h-96 w-full shadow-md bg-stone-100 border-4 border-white flex flex-col items-center justify-center text-stone-400 gap-3 p-4 text-center">
                    <i className="fa-solid fa-motorcycle text-5xl text-stone-300"></i>
                    <span className="text-xs font-bold text-stone-500">Siem Reap Motor</span>
                  </div>
                )}
              </div>
              <div className="space-y-4 pt-8">
                {image2 ? (
                  <img
                    src={image2}
                    alt="Motor Rental & Guesthouse Experience"
                    className="rounded-3xl h-60 sm:h-80 md:h-96 object-cover w-full shadow-xl bg-stone-200 border-4 border-white transition-transform hover:scale-[1.02] duration-300"
                  />
                ) : (
                  <div className="rounded-3xl h-60 sm:h-80 md:h-96 w-full shadow-md bg-stone-100 border-4 border-white flex flex-col items-center justify-center text-stone-400 gap-3 p-4 text-center">
                    <i className="fa-solid fa-hotel text-5xl text-stone-300"></i>
                    <span className="text-xs font-bold text-stone-500">Angkor Guesthouse</span>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Trust Badge */}
            <div className="absolute -bottom-4 -left-4 sm:bottom-4 sm:left-4 bg-stone-900/95 backdrop-blur-sm text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-stone-700/50">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/30">
                <i className="fa-solid fa-heart text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">100% Local Family Hospitality</p>
                <p className="text-[11px] text-stone-400">Trusted by thousands of temple travelers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid from Database (The 'last one') */}
        {features && features.length > 0 && (
          <div className="pt-8 border-t border-stone-200">
            <div className="text-center mb-12 anim-fade-up">
              <h3 className="font-display text-2xl font-bold text-stone-900">Why Choose Us?</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 anim-fade-up">
              {features.map((f, i) => (
                <div key={i} className="bg-white border border-stone-200 rounded-xl p-6 hover:shadow-card transition-shadow flex flex-col gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.color}`}>
                    <i className={`fa-solid ${f.icon || 'fa-check'} text-xl`}></i>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-stone-900 mb-1">{f.title}</h4>
                    <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
