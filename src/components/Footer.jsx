import { Link } from 'react-router-dom';
import { FooterSkeleton } from './Skeleton';

export default function Footer({ businessProfile, contactInfo, loading = false }) {
  if (loading) {
    return (
      <footer className="bg-stone-900 text-stone-300">
        <div className="max-w-7xl mx-auto px-5 py-12">
          <FooterSkeleton />
        </div>
        <div className="border-t border-stone-800 py-4 px-5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
            <p>© 2026 Loading... All rights reserved.</p>
          </div>
        </div>
      </footer>
    );
  }

  const profile = businessProfile || {};
  const contact = contactInfo || {};
  const hotelName = profile.hotelName || 'Siem Reap Angkor';

  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="max-w-7xl mx-auto px-5 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              {profile.logo ? (
                <img src={profile.logo} alt="Logo" className="h-9 w-auto object-contain rounded-lg bg-white p-1" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
                  <i className="fa-solid fa-motorcycle text-white text-sm"></i>
                </div>
              )}
              <div>
                <p className="text-base font-bold text-white leading-tight">{hotelName}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-stone-400 mb-4">
              Premier motor rentals & comfortable guesthouses in Siem Reap, Cambodia.
            </p>
            <div className="flex gap-2">
              {[
                { href: contact.telegramUrl, icon: 'fa-brands fa-telegram' },
                { href: contact.whatsappUrl, icon: 'fa-brands fa-whatsapp' },
                { href: contact.facebookUrl, icon: 'fa-brands fa-facebook' },
              ].filter(s => s.href).map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noreferrer"
                  className="w-9 h-9 rounded-lg bg-stone-800 flex items-center justify-center text-stone-400 hover:bg-brand-500 hover:text-white transition-all">
                  <i className={s.icon + ' text-sm'}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/motor-rentals" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">Motor Rentals</Link>
              </li>
              <li>
                <Link to="/guesthouses" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">Guesthouses</Link>
              </li>
              <li>
                <Link to="/#services" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">Services</Link>
              </li>
              <li>
                <Link to="/#about" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/#contact" className="text-sm text-stone-400 hover:text-white hover:text-brand-400 transition-colors">Contact / Book</Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Services</h3>
            <ul className="space-y-2 text-sm text-stone-400">
              <li>Motor & Scooter Rental</li>
              <li>Guesthouse Rooms</li>
              <li>Airport Pickup</li>
              <li>Laundry Service</li>
              <li>Temple Tours</li>
              <li>Luggage Storage</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 items-start text-stone-400">
                <i className="fa-solid fa-location-dot text-brand-400 mt-0.5 shrink-0"></i>
                {contact.address || 'Siem Reap, Cambodia'}
              </li>
              {contact.telegramUrl && (
                <li>
                  <a href={contact.telegramUrl} target="_blank" rel="noreferrer" className="flex gap-2 items-center text-stone-400 hover:text-white transition-colors">
                    <i className="fa-brands fa-telegram text-sky-400 shrink-0"></i>
                    {contact.telegramHandle || 'Telegram'}
                  </a>
                </li>
              )}
              {contact.whatsappUrl && (
                <li>
                  <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className="flex gap-2 items-center text-stone-400 hover:text-white transition-colors">
                    <i className="fa-brands fa-whatsapp text-green-400 shrink-0"></i>
                    {contact.whatsappDisplay || 'WhatsApp'}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-stone-800 py-4 px-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
          <p>© 2026 {hotelName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-eye text-brand-500"></i>
              <span id="viewCountFooter">...</span> views
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
