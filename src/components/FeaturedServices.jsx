import { Link } from 'react-router-dom';
import { FeaturedServicesSkeleton } from './Skeleton';

export default function FeaturedServices({ texts, onOpenQuickBook, loading = false }) {
  if (loading) {
    return (
      <section id="services" className="py-20 md:py-24 bg-stone-50 border-t border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-5">
          <FeaturedServicesSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-20 md:py-24 bg-stone-50 border-t border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-16 anim-fade-up">
          <p className="section-label justify-center">
            <i className="fa-solid fa-layer-group"></i> Our Core Services
          </p>
          <div className="divider mx-auto"></div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-stone-900">
            Everything You Need For Your Angkor Adventure
          </h2>
          <p className="text-stone-500 text-sm mt-3">
            Seamlessly combine comfortable accommodation and reliable transportation with local expert support in Siem Reap.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Motor Rentals */}
          <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between anim-fade-up group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-motorcycle"></i>
                </div>
                <span className="bg-stone-100 text-stone-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  From $12 / Day
                </span>
              </div>

              <h3 className="font-display text-2xl font-bold text-stone-900 mb-3">
                {texts?.bikes_section || 'Motorbike & Scooter Rentals'}
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-6">
                Top-condition automatic and semi-automatic motorbikes inspected daily. Explore Angkor Wat, hidden temple roads, and lush countryside with complete freedom.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Quality helmets, secure locks & phone mounts included</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Fair rental terms — no original passport hostage policy</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Complimentary temple route map & sunrise tips</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Free hotel delivery in Siem Reap town center</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/motor-rentals"
                className="btn-primary w-full sm:w-auto justify-center text-sm py-3 px-6 shadow-md shadow-brand-500/20"
              >
                <i className="fa-solid fa-motorcycle"></i>
                View Motor Fleet
              </Link>
              <a
                href="#contact"
                className="btn-outline w-full sm:w-auto justify-center text-sm py-3 px-6 text-stone-700"
              >
                Inquire Rates
              </a>
            </div>
          </div>

          {/* Card 2: Guesthouse & Rooms */}
          <div className="bg-white rounded-3xl p-8 border border-stone-200/90 shadow-card hover:shadow-xl transition-all duration-300 flex flex-col justify-between anim-fade-up group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-hotel"></i>
                </div>
                <span className="bg-stone-100 text-stone-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  From $20 / Night
                </span>
              </div>

              <h3 className="font-display text-2xl font-bold text-stone-900 mb-3">
                {texts?.guesthouses_title || 'Comfortable Guesthouses'}
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-6">
                Cozy, spotlessly clean rooms situated just minutes from Angkor Wat main gate. Perfect peaceful sanctuary for solo travellers, couples, and traveling families.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Private bathroom with hot high-pressure showers</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Silent air conditioning & ultra-fast Wi-Fi</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>1, 2, or 3 bed configurations for flexible stays</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-700 font-medium">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
                  <span>Room & Motor Rental combo packages available</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/guesthouses"
                className="btn-primary w-full sm:w-auto justify-center text-sm py-3 px-6 shadow-md shadow-brand-500/20"
              >
                <i className="fa-solid fa-bed"></i>
                View All Rooms
              </Link>
              <a
                href="#contact"
                className="btn-outline w-full sm:w-auto justify-center text-sm py-3 px-6 text-stone-700"
              >
                Book / Inquire
              </a>
            </div>
          </div>
        </div>

        {/* Quick Booking Combo Callout Banner */}
        <div className="mt-12 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-8 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 anim-fade-up shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <span className="bg-brand-500/20 text-brand-400 border border-brand-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
              Bundle & Save
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-bold">
              Looking for both a room and a motorbike?
            </h3>
            <p className="text-stone-300 text-sm max-w-xl">
              Book our popular Guesthouse + Scooter package for discount rates, free airport pickup, and having your bike ready at check-in.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <a
              href="#contact"
              className="btn-primary justify-center text-sm py-3.5 px-8"
            >
              <i className="fa-solid fa-paper-plane"></i>
              Book Combo Package
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
