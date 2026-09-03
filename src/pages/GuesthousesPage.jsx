import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { dbRooms } from '../firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BookingModal from '../components/BookingModal';
import { RoomCardSkeleton } from '../components/Skeleton';

const AMENITY_ICONS = {
  'Air Conditioning': 'fa-snowflake', 'Free Wi-Fi': 'fa-wifi',
  'Private Bathroom': 'fa-shower', 'Hot Shower': 'fa-temperature-high',
  'Flat-screen TV': 'fa-tv', 'Mini Fridge': 'fa-kitchen-set',
  'Daily Housekeeping': 'fa-broom',
};

function RoomCard({ room, index }) {
  const [selectedBeds, setSelectedBeds] = useState(1);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);

  const prices = { 1: room.beds1Price, 2: room.beds2Price, 3: room.beds3Price };

  let images = [];
  if (room.imageUrl) {
    try {
      images = JSON.parse(room.imageUrl);
      if (!Array.isArray(images)) images = [room.imageUrl];
    } catch {
      images = [room.imageUrl];
    }
  }

  const nextImg = (e) => {
    e.stopPropagation();
    setCurrentImg(prev => (prev + 1) % images.length);
  };

  const prevImg = (e) => {
    e.stopPropagation();
    setCurrentImg(prev => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div className="card listing-card anim-fade-up" data-delay={index * 80}>
        {/* Image Slider */}
        <div className="relative h-56 bg-gradient-to-br from-warm-200 to-stone-200 overflow-hidden group">
          {images.length > 0 ? (
            <img src={images[currentImg]} alt={room.name} className="w-full h-full object-cover transition-all duration-300" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
              <i className="fa-solid fa-bed text-5xl"></i>
              <span className="text-sm font-medium">Room Photo</span>
            </div>
          )}

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-700 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-brand-500">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-700 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-brand-500">
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImg ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                ))}
              </div>
            </>
          )}

          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-brand-500 shadow-sm">
            From ${room.beds1Price}/night
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-bold text-stone-900 text-lg mb-1 font-display">{room.name}</h3>
          <p className="text-xs text-stone-500 mb-4 leading-relaxed line-clamp-2">{room.description}</p>

          {/* Bed selector */}
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">Select Beds</p>
            <div className="flex gap-2">
              {[1, 2, 3].map(b => (
                <button key={b} onClick={() => setSelectedBeds(b)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedBeds === b ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-stone-600 border-stone-200 hover:border-brand-400 hover:bg-brand-50'}`}>
                  {b} Bed{b > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-end gap-1.5 mb-4">
            <span className="text-3xl font-black text-brand-500">${prices[selectedBeds]}</span>
            <span className="text-xs text-stone-400 pb-0.5 font-medium">/night</span>
          </div>

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mb-5">
              {room.amenities.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                  <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-brand-400 text-[10px] w-3 shrink-0`}></i>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setBookingOpen(true)} className="btn-primary w-full justify-center shadow-md shadow-brand-500/20 py-2.5">
            <i className="fa-solid fa-calendar-plus"></i> Book Room
          </button>
        </div>
      </div>

      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        type="room"
        itemName={`${room.name} (${selectedBeds} Bed${selectedBeds > 1 ? 's' : ''})`}
        pricePerDay={prices[selectedBeds]}
        bedCount={selectedBeds}
      />
    </>
  );
}

export default function GuesthousesPage({ publicSettings, loadingSettings }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    const fetchRooms = async () => {
      try {
        const snap = await getDocs(collection(dbRooms, 'rooms'));
        const fetchedRooms = [];
        snap.forEach(doc => {
          fetchedRooms.push({ id: doc.id, ...doc.data() });
        });
        setRooms(fetchedRooms);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
    const socket = io(socketUrl);
    socket.on('room_status_updated', fetchRooms);
    socket.on('rooms_updated', fetchRooms);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!loading && rooms.length > 0) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.08 });
      document.querySelectorAll('.anim-fade-up').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }
  }, [rooms, loading]);

  return (
    <div className="font-sans">
      <Navbar alwaysSolid={true} data={publicSettings?.business_profile} loading={loadingSettings} />
      
      <main className="pt-24 pb-16 bg-stone-50 min-h-screen">
        <section className="section-pad">
          <div className="max-w-7xl mx-auto px-5">
            {loadingSettings ? (
              <div className="mb-12 space-y-3">
                <div className="h-4 w-28 skeleton-bone rounded"></div>
                <div className="h-10 w-72 sm:w-96 skeleton-bone rounded-xl"></div>
                <div className="h-4 w-full max-w-xl skeleton-bone rounded"></div>
              </div>
            ) : (
              <div className="mb-12">
                <Link to="/" className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-brand-500 transition-colors mb-6 group">
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Home
                </Link>
                <h1 className="font-display text-4xl sm:text-5xl font-bold text-stone-900 mt-4 mb-4">{publicSettings?.public_texts?.guesthouses_title || "Our Guesthouses"}</h1>
                <p className="text-stone-500 max-w-2xl text-lg leading-relaxed">{publicSettings?.public_texts?.guesthouses_subtitle || "Comfortable, clean rooms near Angkor Wat — perfect for solo travellers, couples, and families. Review our available rooms below."}</p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <RoomCardSkeleton key={i} delayClass={`skeleton-delay-${(i % 3) + 1}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {rooms.map((room, i) => <RoomCard key={room.id} room={room} index={i} />)}
                {rooms.length === 0 && (
                  <div className="col-span-full py-16 text-center text-stone-400">
                    <i className="fa-solid fa-hotel text-5xl mb-3 opacity-30 block"></i>
                    No rooms listed yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer businessProfile={publicSettings?.business_profile} contactInfo={publicSettings?.contact_info} loading={loadingSettings} />
    </div>
  );
}
