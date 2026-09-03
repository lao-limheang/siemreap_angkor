import { useEffect } from 'react';

export default function ServicesBar({ servicesBarData = [] }) {
  const servicesBar = servicesBarData && servicesBarData.length > 0 ? servicesBarData : [
    { icon: 'fa-plane-arrival', label: 'Airport Pickup', desc: 'We pick you up' },
    { icon: 'fa-shirt', label: 'Laundry Service', desc: 'Same-day service' },
    { icon: 'fa-suitcase', label: 'Luggage Storage', desc: 'Free & secure' },
    { icon: 'fa-motorcycle', label: 'Motor Rental Combo', desc: 'Bundle & save' },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.services-bar-anim').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section className="bg-white pt-8 pb-16 px-5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 services-bar-anim anim-fade-up">
          {servicesBar.map((s, i) => (
            <div key={i} className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow">
              <div className="amenity-icon bg-white shadow-sm mb-1 text-brand-500">
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
              <p className="text-sm font-bold text-stone-900">{s.label}</p>
              <p className="text-xs text-stone-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
