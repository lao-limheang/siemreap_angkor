import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import defaultLogo from '../assets/logo.png';
import { NavbarSkeleton } from './Skeleton';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Motor Rentals', to: '/motor-rentals' },
  { label: 'Guesthouses', to: '/guesthouses' },
  { label: 'Services', to: '/#services', hash: '#services' },
  { label: 'About', to: '/#about', hash: '#about' },
  { label: 'Contact', to: '/#contact', hash: '#contact' },
];

export default function Navbar({ alwaysSolid = false, data, loading = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isSolid = alwaysSolid || scrolled;
  const navClass = isSolid ? 'navbar solid' : 'navbar transparent';
  const menuIconColor = isSolid ? 'text-stone-600' : 'text-white';

  const logoSrc = data?.logo || defaultLogo;
  const hotelName = data?.hotelName || "Siem Reap Angkor";

  const handleHashClick = (e, link) => {
    if (link.hash) {
      if (location.pathname === '/') {
        e.preventDefault();
        const el = document.querySelector(link.hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    setMenuOpen(false);
  };

  const isActive = (link) => {
    if (link.to === '/' && location.pathname === '/') return true;
    if (link.to !== '/' && location.pathname === link.to) return true;
    return false;
  };

  return (
    <nav className={navClass}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        {loading ? (
          <NavbarSkeleton />
        ) : (
          <Link to="/" className="flex items-center shrink-0">
            <img src={logoSrc} alt={hotelName} className="h-12 w-auto object-contain" />
          </Link>
        )}

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(link => {
            const active = isActive(link);
            return (
              <Link
                key={link.label}
                to={link.to}
                onClick={(e) => handleHashClick(e, link)}
                className={`relative py-1 text-sm font-medium transition-colors
                  after:content-[''] after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:bg-brand-500 after:transition-all 
                  ${active ? 'text-brand-500 after:w-full font-semibold' : 'after:w-0 hover:after:w-full'}
                  ${isSolid ? (active ? 'text-brand-600' : 'text-stone-600 hover:text-brand-500') : (active ? 'text-white font-bold' : 'text-white/90 hover:text-white')}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            to="/#contact"
            onClick={(e) => handleHashClick(e, { hash: '#contact' })}
            className="hidden md:flex btn-primary"
          >
            <i className="fa-solid fa-calendar-plus text-sm"></i>
            Book Now / Inquire
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${menuIconColor} hover:bg-white/20`}
            aria-label="Toggle menu"
          >
            <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'} text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-5 py-4 space-y-1 shadow-xl">
          {NAV_LINKS.map(link => (
            <Link
              key={link.label}
              to={link.to}
              onClick={(e) => handleHashClick(e, link)}
              className="block px-4 py-2.5 text-sm font-medium text-stone-700 hover:text-brand-500 hover:bg-warm-100 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/#contact"
            onClick={(e) => handleHashClick(e, { hash: '#contact' })}
            className="block mt-3 btn-primary justify-center text-center"
          >
            Book Now / Inquire
          </Link>
        </div>
      )}
    </nav>
  );
}
