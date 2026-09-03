import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { collection, getDocs } from 'firebase/firestore';
import { dbMotos as db } from '../firebase';
import BookingModal from './BookingModal';
import { BikeCardSkeleton } from './Skeleton';

function BikeCard({ bike, index, onBook }) {
  const [currentImg, setCurrentImg] = useState(0);
  
  let images = [];
  if (bike.imageUrl) {
    try {
      images = JSON.parse(bike.imageUrl);
      if (!Array.isArray(images)) images = [bike.imageUrl];
    } catch {
      images = [bike.imageUrl];
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
    <div className="card listing-card anim-fade-up" data-delay={index * 60}>
      {/* Image Slider */}
      <div className="relative h-48 bg-gradient-to-br from-stone-100 to-warm-200 overflow-hidden group">
        {images.length > 0 ? (
          <img src={images[currentImg]} alt={bike.name} className="w-full h-full object-cover transition-all duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
            <i className="fa-solid fa-motorcycle text-5xl mb-2"></i>
            <span className="text-xs font-medium uppercase tracking-widest">No Photo</span>
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

        {bike.isOnSale === 1 && (
          <span className="absolute top-3 left-3 bg-brand-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-md">
            <i className="fa-solid fa-tag mr-1"></i>Sale
          </span>
        )}
        <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-stone-700 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">{bike.year}</span>
      </div>

      <div className="p-5">
        <h3 className="font-bold text-stone-900 text-lg mb-1 font-display">{bike.name}</h3>
        <p className="text-xs text-stone-500 mb-5 leading-relaxed line-clamp-2">{bike.description}</p>

        <div className="flex items-end gap-1.5 mb-5">
          {bike.isOnSale === 1 && bike.originalPrice && (
            <span className="text-sm text-stone-400 line-through mr-1">${bike.originalPrice}</span>
          )}
          <span className="text-2xl font-black text-brand-500">${bike.price}</span>
          <span className="text-xs text-stone-400 pb-0.5 font-medium">/day</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a href="https://t.me/Motor_Rental_Siemreap_Angkor" target="_blank" rel="noreferrer"
            className="btn-outline text-xs py-2.5 justify-center">
            <i className="fa-brands fa-telegram"></i> Telegram
          </a>
          <button onClick={() => onBook(bike)}
            className="btn-primary text-xs py-2.5 justify-center shadow-md shadow-brand-500/20">
            <i className="fa-solid fa-calendar-plus"></i> Book Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BikesFleet({ texts }) {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingBike, setBookingBike] = useState(null);

  const fetchBikes = async () => {
    try {
      const modelsSnap = await getDocs(collection(db, "models"));
      const modelsMap = {};
      modelsSnap.forEach(doc => {
        modelsMap[doc.id] = doc.data();
      });

      const motosSnap = await getDocs(collection(db, "motos"));
      const motos = [];
      motosSnap.forEach(doc => {
        const motoData = doc.data();
        const model = modelsMap[motoData.modelId];
        if (model) {
          motos.push({
            id: doc.id,
            name: `${model.brand} ${model.name}`,
            price: model.dailyPrice,
            description: `Color: ${motoData.color || 'N/A'}${motoData.plateNumber ? ` | Plate: ${motoData.plateNumber}` : ''}`,
            imageUrl: motoData.photoUrl || '',
            isOnSale: 0,
            originalPrice: null,
            year: new Date(motoData.createdAt || Date.now()).getFullYear(),
            status: motoData.status
          });
        }
      });
      setBikes(motos.filter(m => m.status === 'available'));
    } catch (err) {
      console.error("Firebase fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBikes();
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
    const socket = io(socketUrl);
    socket.on('bike_status_updated', fetchBikes);
    socket.on('bikes_updated', fetchBikes);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!loading && bikes.length > 0) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), parseInt(e.target.dataset.delay || 0));
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('#bikes .anim-fade-up').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }
  }, [bikes, loading]);

  return (
    <>
      <section id="bikes" className="section-pad bg-warm-50" style={{ background: '#fdfaf5' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4 anim-fade-up">
            <div>
              <p className="section-label"><i className="fa-solid fa-motorcycle"></i> {texts?.bikes_section || 'Motor Rentals'}</p>
              <div className="divider"></div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-stone-900">{texts?.bikes_title || 'Our Rentals'}</h2>
              <p className="text-stone-500 text-sm mt-3 max-w-md">{texts?.bikes_subtitle || 'Quality motorcycles & scooters at the best daily rates in Siem Reap, Cambodia.'}</p>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2">
              <span className="bg-white border border-stone-200 text-stone-800 text-sm font-bold py-2.5 px-5 rounded-full shadow-sm flex items-center gap-2">
                <i className="fa-solid fa-motorcycle text-brand-500"></i> All Fleet
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <BikeCardSkeleton key={i} delayClass={`skeleton-delay-${(i % 4) + 1}`} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {bikes.map((bike, index) => (
                <BikeCard key={bike.id} bike={bike} index={index} onBook={setBookingBike} />
              ))}
              {bikes.length === 0 && (
                <div className="col-span-full py-16 text-center text-stone-400">
                  <i className="fa-solid fa-motorcycle text-5xl mb-3 opacity-30 block"></i>
                  No motors listed yet.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <BookingModal
        isOpen={!!bookingBike}
        onClose={() => setBookingBike(null)}
        type="motor"
        itemName={bookingBike?.name || ''}
        pricePerDay={bookingBike?.price || 0}
      />
    </>
  );
}
