import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { dbRooms as db } from './firebase';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FeaturedServices from './components/FeaturedServices';
import Location from './components/Location';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Admin from './components/Admin';
import AboutUs from './components/AboutUs';
import Testimonials from './components/Testimonials';
import GuesthousesPage from './pages/GuesthousesPage';
import MotorRentalsPage from './pages/MotorRentalsPage';
import FeedbackPage from './pages/FeedbackPage';

function LandingPage({ publicSettings, loadingSettings }) {
  useEffect(() => {
    // Scroll animation observer
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || 0);
          setTimeout(() => entry.target.classList.add('visible'), delay);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

    const timeout = setTimeout(() => {
      document.querySelectorAll('.anim-fade-up:not(.visible), .anim-scale-in:not(.visible)').forEach(el => obs.observe(el));
    }, 100);

    return () => {
      clearTimeout(timeout);
      obs.disconnect();
    };
  }, [loadingSettings]);

  useEffect(() => {
    // Firebase View Tracking
    const trackPageView = async () => {
      try {
        const hasVisited = sessionStorage.getItem('visited');
        const counterRef = doc(db, "stats", "page-views");
        const docSnap = await getDoc(counterRef);
        let currentCount = 0;
        if (!hasVisited) {
          if (docSnap.exists()) {
            await updateDoc(counterRef, { count: increment(1) });
            currentCount = docSnap.data().count + 1;
          } else {
            await setDoc(counterRef, { count: 1 });
            currentCount = 1;
          }
          sessionStorage.setItem('visited', 'true');
        } else {
          currentCount = docSnap.exists() ? docSnap.data().count : 0;
        }
        const formatted = (currentCount + 1542).toLocaleString();
        const el = document.getElementById('viewCountFooter');
        if (el) el.textContent = formatted;
      } catch (error) {
        console.error("Firebase tracking error:", error);
      }
    };
    trackPageView();
  }, []);

  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const el = document.querySelector(location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [location]);

  return (
    <div className="font-sans">
      <Navbar data={publicSettings.business_profile} loading={loadingSettings} />
      <main>
        <Hero images={publicSettings.hero_images} loading={loadingSettings} texts={publicSettings.public_texts} />
        <AboutUs 
          data={publicSettings.about_us} 
          servicesBarData={publicSettings.services_bar}
          whyUsData={publicSettings.why_us}
          loading={loadingSettings} 
        />
        <FeaturedServices texts={publicSettings.public_texts} loading={loadingSettings} />
        <Testimonials data={publicSettings.testimonials} loading={loadingSettings} />
        <Location />
        <Contact data={publicSettings.contact_info} loading={loadingSettings} />
      </main>
      <Footer businessProfile={publicSettings.business_profile} contactInfo={publicSettings.contact_info} loading={loadingSettings} />
    </div>
  );
}

function App() {
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [publicSettings, setPublicSettings] = useState({
    hero_images: [],
    about_us: { title: '', p1: '', p2: '', image1: '', image2: '' },
    why_us: { title: '', p1: '', p2: '', p3: '', stats: [], features: [] },
    services_bar: [],
    testimonials: [],
    contact_info: { address: '', telegramUrl: '', telegramHandle: '', whatsappUrl: '', whatsappDisplay: '', facebookUrl: '', mapUrl: '', mapEmbed: '', hours: '' },
    business_profile: { hotelName: 'Motor Rental Siem Reap Angkor & Guesthouse', logo: '' },
    public_texts: { hero_title: 'Welcome', hero_subtitle: 'Eye catching premium motor rentals & comfortable stays in the heart of Siem Reap.', hero_btn: 'Explore Fleet', bikes_section: 'Motor Rentals', bikes_title: 'Our Rentals', bikes_subtitle: 'Quality motorcycles & scooters at the best daily rates in Siem Reap, Cambodia.', guesthouses_title: 'Our Guesthouses', guesthouses_subtitle: 'Comfortable, clean rooms near Angkor Wat — perfect for solo travellers, couples, and families. Review our available rooms below.' }
  });

  const fetchPublicSettings = useCallback(() => {
    fetch('/api/public-settings')
      .then(res => res.json())
      .then(data => {
        const parsed = {};
        ['hero_images', 'about_us', 'why_us', 'services_bar', 'testimonials', 'contact_info', 'business_profile', 'pricing_tax', 'payment_methods', 'invoice_settings', 'public_texts'].forEach(key => {
          if (data[key]) {
            try {
              parsed[key] = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
            } catch (err) {
              console.error(`Error parsing ${key}:`, err);
            }
          }
        });
        setPublicSettings(prev => ({ ...prev, ...parsed }));
      })
      .catch(console.error)
      .finally(() => setLoadingSettings(false));
  }, []);

  useEffect(() => {
    fetchPublicSettings();
    // Vercel serves the API as short-lived functions and does not support the
    // persistent Socket.IO connection used by the local Express server.
    if (window.location.hostname !== 'localhost') return undefined;
    const socket = io('http://localhost:3000');
    socket.on('settings_updated', fetchPublicSettings);
    return () => socket.disconnect();
  }, [fetchPublicSettings]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage publicSettings={publicSettings} loadingSettings={loadingSettings} />} />
      <Route path="/guesthouses" element={<GuesthousesPage publicSettings={publicSettings} loadingSettings={loadingSettings} />} />
      <Route path="/motor-rentals" element={<MotorRentalsPage publicSettings={publicSettings} loadingSettings={loadingSettings} />} />
      <Route path="/rentals" element={<MotorRentalsPage publicSettings={publicSettings} loadingSettings={loadingSettings} />} />
      <Route path="/feedback" element={<FeedbackPage publicSettings={publicSettings} />} />
      <Route path="/review" element={<FeedbackPage publicSettings={publicSettings} />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
