import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft, Search, ShieldCheck, Wrench, Clock, Sparkles } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { dbMotos as db } from '../firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BookingModal from '../components/BookingModal';
import { BikeCardSkeleton } from '../components/Skeleton';

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
    <div className="card listing-card anim-fade-up bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-card flex flex-col justify-between" data-delay={index * 60}>
      <div>
        {/* Image Slider */}
        <div className="relative h-52 bg-gradient-to-br from-stone-100 to-warm-200 overflow-hidden group">
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
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {bike.year}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-stone-900 text-lg font-display">{bike.name}</h3>
          </div>
          
          <p className="text-xs text-stone-500 mb-4 leading-relaxed line-clamp-2">{bike.description || 'Reliable city and touring motorcycle, fully inspected and serviced.'}</p>

          <div className="flex items-center gap-2 mb-4 text-[11px] text-stone-500">
            <span className="bg-stone-100 px-2 py-0.5 rounded-md font-medium"><i className="fa-solid fa-shield-halved text-emerald-500 mr-1"></i>Helmets Included</span>
            <span className="bg-stone-100 px-2 py-0.5 rounded-md font-medium"><i className="fa-solid fa-gas-pump text-amber-500 mr-1"></i>Full Tank Ready</span>
          </div>

          <div className="flex items-end gap-1.5 mb-5">
            {bike.isOnSale === 1 && bike.originalPrice && (
              <span className="text-sm text-stone-400 line-through mr-1">${bike.originalPrice}</span>
            )}
            <span className="text-2xl font-black text-brand-500">${bike.price}</span>
            <span className="text-xs text-stone-400 pb-0.5 font-medium">/day</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-0">
        <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4">
          <a href="https://t.me/Motor_Rental_Siemreap_Angkor" target="_blank" rel="noreferrer"
            className="btn-outline text-xs py-2.5 justify-center">
            <i className="fa-brands fa-telegram"></i> Inquire
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

export default function MotorRentalsPage({ publicSettings, loadingSettings }) {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingBike, setBookingBike] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
            description: `Color: ${motoData.color || 'Standard'}${motoData.plateNumber ? ` | Plate: ${motoData.plateNumber}` : ''}`,
            imageUrl: motoData.photoUrl || '',
            isOnSale: 0,
            originalPrice: null,
            year: new Date(motoData.createdAt || Date.now()).getFullYear(),
            status: motoData.status,
            type: model.type || 'Scooter'
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
    window.scrollTo(0, 0);
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
      }, { threshold: 0.08 });
      document.querySelectorAll('.anim-fade-up').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }
  }, [bikes, loading]);

  const filteredBikes = bikes.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="font-sans">
      <Navbar alwaysSolid={true} data={publicSettings?.business_profile} loading={loadingSettings} />

      <main className="pt-24 pb-16 bg-stone-50 min-h-screen">
        <section className="section-pad">
          <div className="max-w-7xl mx-auto px-5">
            {/* Header */}
            <div className="mb-10">
              {loadingSettings ? (
                <div className="space-y-3">
                  <div className="h-4 w-28 skeleton-bone rounded"></div>
                  <div className="h-3.5 w-32 skeleton-bone rounded"></div>
                  <div className="h-10 w-72 sm:w-96 skeleton-bone rounded-xl"></div>
                  <div className="h-4 w-full max-w-xl skeleton-bone rounded"></div>
                </div>
              ) : (
                <>
                  <Link to="/" className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-brand-500 transition-colors mb-6 group">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Home
                  </Link>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <span className="section-label inline-flex items-center gap-1.5"><i className="fa-solid fa-motorcycle"></i> Motor Rentals</span>
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-stone-900 mt-2 mb-3">
                        {publicSettings?.public_texts?.bikes_title || "Our Rental Fleet"}
                      </h1>
                      <p className="text-stone-500 max-w-2xl text-base sm:text-lg leading-relaxed">
                        {publicSettings?.public_texts?.bikes_subtitle || "High-quality motorcycles and automatic scooters at honest daily & weekly rates in Siem Reap, Cambodia. Perfect for sunrise trips to Angkor Wat and surrounding countryside."}
                      </p>
                    </div>

                    {/* Highlights pill cards */}
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                      <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-sm">
                        <ShieldCheck className="w-4 h-4 text-brand-500" />
                        <span>Free Helmets & Locks</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-sm">
                        <Wrench className="w-4 h-4 text-blue-500" />
                        <span>Serviced & Maintained</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-sm">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>24/7 Road Support</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search bike by model, brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="text-xs text-stone-500 font-medium">
                Showing <strong className="text-stone-800">{filteredBikes.length}</strong> available vehicle{filteredBikes.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Bike Fleet Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <BikeCardSkeleton key={i} delayClass={`skeleton-delay-${(i % 4) + 1}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBikes.map((bike, index) => (
                  <BikeCard key={bike.id} bike={bike} index={index} onBook={setBookingBike} />
                ))}
                {filteredBikes.length === 0 && (
                  <div className="col-span-full py-16 text-center text-stone-400 bg-white rounded-2xl border border-dashed border-stone-200">
                    <i className="fa-solid fa-motorcycle text-5xl mb-3 opacity-30 block"></i>
                    <p className="font-bold text-stone-700 mb-1">No motorbikes found matching your search.</p>
                    <p className="text-xs">Try clearing the search query or check back shortly.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer businessProfile={publicSettings?.business_profile} contactInfo={publicSettings?.contact_info} loading={loadingSettings} />

      <BookingModal
        isOpen={!!bookingBike}
        onClose={() => setBookingBike(null)}
        type="motor"
        itemName={bookingBike?.name || ''}
        pricePerDay={bookingBike?.price || 0}
      />
    </div>
  );
}
