import { useEffect } from 'react';

export default function WhyUs({ data, loading = false }) {
  useEffect(() => {
    if (!loading && data) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('#whyus .anim-fade-up').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }
  }, [loading, data]);

  if (loading) {
    return (
      <section id="whyus" className="section-pad" style={{ background: '#fdfaf5' }}>
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <div className="h-4 w-24 skeleton-bone rounded"></div>
              <div className="h-10 w-3/4 skeleton-bone rounded-xl"></div>
              <div className="space-y-2 pt-2">
                <div className="h-3.5 w-full skeleton-bone rounded"></div>
                <div className="h-3.5 w-5/6 skeleton-bone rounded"></div>
                <div className="h-3.5 w-4/5 skeleton-bone rounded"></div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
                    <div className="h-6 w-12 skeleton-bone rounded mx-auto"></div>
                    <div className="h-3 w-16 skeleton-bone rounded mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                  <div className="w-10 h-10 rounded-lg skeleton-bone"></div>
                  <div className="h-4 w-24 skeleton-bone rounded"></div>
                  <div className="h-3 w-full skeleton-bone rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { title, p1, p2, p3, stats, features } = data || {};
  
  // Split title if possible, or just render it
  let titleMain = title || "About Siem Reap Angkor";
  let titleHighlight = "";
  if (titleMain.includes("Siem Reap Angkor")) {
    titleMain = titleMain.replace("Siem Reap Angkor", "");
    titleHighlight = "Siem Reap Angkor";
  }

  return (
    <section id="whyus" className="section-pad" style={{ background: '#fdfaf5' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="anim-fade-up">
            <p className="section-label"><i className="fa-solid fa-star"></i> About Us</p>
            <div className="divider"></div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 mb-6">
              {titleMain} <span className="text-brand">{titleHighlight}</span>
            </h2>

            <div className="space-y-4 text-stone-600 text-sm leading-relaxed">
              {p1 && <p>{p1}</p>}
              {p2 && <p>{p2}</p>}
              {p3 && <p>{p3}</p>}
            </div>

            {stats && stats.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-8">
                {stats.map((s, i) => (
                  <div key={i} className="text-center p-4 bg-white border border-stone-200 rounded-xl">
                    <p className="text-2xl font-bold text-brand-500 font-display">{s.num}</p>
                    <p className="text-xs text-stone-500 font-medium mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Features grid */}
          {features && features.length > 0 && (
            <div className="grid grid-cols-2 gap-4 anim-fade-up">
              {features.map((f, i) => (
                <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-card transition-shadow">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${f.color} mb-3`}>
                    <i className={`fa-solid ${f.icon || 'fa-check'} text-base`}></i>
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 mb-1">{f.title}</h3>
                  <p className="text-xs text-stone-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
