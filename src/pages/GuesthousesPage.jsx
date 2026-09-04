import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { dbRooms, dbMotos } from '../firebase';
import { RoomService, BedCategoryService } from '../services/DatabaseService';
import { normalizeRoom, normalizeBedCategory } from '../utils/dataNormalizer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BookingModal from '../components/BookingModal';
import { RoomCardSkeleton } from '../components/Skeleton';

const AMENITY_ICONS = {
  'Air Conditioning': 'fa-snowflake',
  'Free Wi-Fi': 'fa-wifi',
  'Private Bathroom': 'fa-shower',
  'Hot Shower': 'fa-temperature-high',
  'Flat-screen TV': 'fa-tv',
  'Mini Fridge': 'fa-kitchen-set',
  'Daily Housekeeping': 'fa-broom',
  'Balcony / Terrace': 'fa-mountain-sun',
  'Safety Deposit Box': 'fa-vault',
  'Desk / Work Area': 'fa-laptop',
  'Tea / Coffee Maker': 'fa-mug-hot',
  'Pool View': 'fa-water-ladder'
};

function GuestRoomDetailModal({ room, isOpen, onClose, onBook }) {
  const [currentImg, setCurrentImg] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentImg(0);
  }, [isOpen]);

  if (!isOpen || !room) return null;

  const images = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (room.imageUrl ? [room.imageUrl] : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80']);

  const amenities = Array.isArray(room.amenities) ? room.amenities : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-stone-200" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors shadow-md"
        >
          <i className="fa-solid fa-times"></i>
        </button>

        {/* Image Slider */}
        <div className="relative h-64 sm:h-72 bg-stone-900 shrink-0 group">
          <img src={images[currentImg]} alt={room.name} className="w-full h-full object-cover transition-all duration-300" />
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImg((currentImg - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-800 flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImg((currentImg + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-800 flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImg(i)}
                    className={`h-2 rounded-full transition-all ${i === currentImg ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
          <div className="absolute bottom-3 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold">
            Floor {room.floor || '1'}
          </div>
          <div className="absolute top-4 left-4 bg-brand-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
            ${room.price || room.rate || 25} / night
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                <i className="fa-solid fa-bed mr-1 text-[11px]"></i>
                {room.categoryName || `${room.bedCount || 1} Bed Room`}
              </span>
              <span className="text-stone-400 text-xs">•</span>
              <span className="text-xs text-stone-500 font-medium">Max {room.capacity || (room.bedCount * 2) || 2} Guests</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900 font-display">Room {room.name}</h2>
            <p className="text-xs font-bold text-stone-600 mt-0.5">{room.bedType || `${room.bedCount || 1} Bed`}</p>
          </div>

          <p className="text-sm text-stone-600 leading-relaxed">
            {room.description || 'Enjoy a clean, comfortable, and air-conditioned room near Angkor Wat with private hot shower and free high-speed Wi-Fi.'}
          </p>

          {/* Amenities Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Room Amenities</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {amenities.map(a => (
                <div key={a} className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 border border-stone-100 text-xs text-stone-700">
                  <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-brand-500 text-sm shrink-0`}></i>
                  <span className="truncate font-medium">{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Policies */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/70 text-xs text-amber-900 space-y-1.5">
            <h4 className="font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info text-amber-600"></i> Guest Policies
            </h4>
            <p className="text-stone-600"><strong>Check-in:</strong> From 2:00 PM | <strong>Check-out:</strong> Until 12:00 PM</p>
            <p className="text-stone-600"><strong>Cancellation:</strong> Free cancellation up to 24 hours prior to arrival date.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-stone-50 border-t border-stone-100 flex items-center justify-between shrink-0">
          <div>
            <div className="text-2xl font-black text-brand-500">${room.price || room.rate || 25}</div>
            <p className="text-[11px] text-stone-400 font-medium">per night • taxes included</p>
          </div>
          <button
            onClick={() => {
              onClose();
              onBook(room);
            }}
            className="btn-primary px-6 py-2.5 shadow-md shadow-brand-500/20 font-bold text-sm"
          >
            <i className="fa-solid fa-calendar-plus mr-1.5"></i> Book Room Now
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, index, onBook }) {
  const [selectedBeds, setSelectedBeds] = useState(room.bedCount || 1);
  const [currentImg, setCurrentImg] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const prices = {
    1: room.beds1Price || room.price || 25,
    2: room.beds2Price || (Number(room.price || 25) + 10),
    3: room.beds3Price || (Number(room.price || 25) + 20)
  };

  const images = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (room.imageUrl ? [room.imageUrl] : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80']);

  const amenities = Array.isArray(room.amenities) ? room.amenities : [];

  const nextImg = (e) => {
    e.stopPropagation();
    setCurrentImg(prev => (prev + 1) % images.length);
  };

  const prevImg = (e) => {
    e.stopPropagation();
    setCurrentImg(prev => (prev - 1 + images.length) % images.length);
  };

  const currentPrice = room.price ? room.price : (prices[selectedBeds] || 25);

  return (
    <>
      <div className="card listing-card bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-card flex flex-col justify-between hover:shadow-lg transition-all duration-300">
        <div>
          {/* Image Slider */}
          <div className="relative h-56 bg-gradient-to-br from-warm-200 to-stone-200 overflow-hidden group">
            <img src={images[currentImg]} alt={room.name} className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105" />

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImg}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-700 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-brand-500"
                >
                  <i className="fa-solid fa-chevron-left text-xs"></i>
                </button>
                <button
                  onClick={nextImg}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-700 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-brand-500"
                >
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {images.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImg ? 'bg-white scale-125' : 'bg-white/50'}`}></div>
                  ))}
                </div>
              </>
            )}

            {/* Category tag */}
            <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1.5">
              <i className="fa-solid fa-bed text-indigo-400 text-[10px]"></i>
              <span>{room.categoryName || `${room.bedCount || 1} Bed`}</span>
            </div>

            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-brand-500 shadow-sm">
              ${currentPrice}/night
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="font-bold text-stone-900 text-lg font-display">Room {room.name}</h3>
                <p className="text-xs text-indigo-600 font-bold">{room.bedType || `${room.bedCount || 1} Bed`}</p>
              </div>
              <span className="text-[11px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded-md">
                Floor {room.floor || '1'}
              </span>
            </div>

            <p className="text-xs text-stone-500 mb-4 leading-relaxed line-clamp-2">{room.description}</p>

            {/* Bed selector (if room has multi-bed pricing without fixed category) */}
            {!room.categoryId && (
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-2">Select Beds</p>
                <div className="flex gap-2">
                  {[1, 2, 3].map(b => (
                    <button
                      key={b}
                      onClick={() => setSelectedBeds(b)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        selectedBeds === b ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-stone-600 border-stone-200 hover:border-brand-400 hover:bg-brand-50'
                      }`}
                    >
                      {b} Bed{b > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-end gap-1.5 mb-4">
              <span className="text-3xl font-black text-brand-500">${currentPrice}</span>
              <span className="text-xs text-stone-400 pb-0.5 font-medium">/night</span>
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 mb-5">
                {amenities.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-brand-400 text-[10px] w-3 shrink-0`}></i>
                    <span className="truncate">{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 pb-5 pt-0 space-y-2">
          <button
            onClick={() => onBook(room, selectedBeds, currentPrice)}
            className="btn-primary w-full justify-center shadow-md shadow-brand-500/20 py-2.5"
          >
            <i className="fa-solid fa-calendar-plus"></i> Book Room
          </button>
          <button
            onClick={() => setDetailOpen(true)}
            className="w-full py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-circle-info text-stone-400"></i> View Room Details
          </button>
        </div>
      </div>

      <GuestRoomDetailModal
        room={{ ...room, price: currentPrice }}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBook={() => onBook(room, selectedBeds, currentPrice)}
      />
    </>
  );
}

export default function GuesthousesPage({ publicSettings, loadingSettings }) {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('all');
  const [bookingModalState, setBookingModalState] = useState({
    isOpen: false,
    room: null,
    bedCount: 1,
    price: 25
  });

  const fetchRoomsAndCategories = async () => {
    try {
      // 1. Fetch categories
      let fetchedCats = [];
      try {
        fetchedCats = await BedCategoryService.getAll();
        if (!fetchedCats || fetchedCats.length === 0) {
          const catRes = await fetch('/api/bed-categories');
          if (catRes.ok) fetchedCats = await catRes.json();
        }
      } catch {
        fetchedCats = [];
      }
      const safeCats = (fetchedCats || []).map(normalizeBedCategory);
      setCategories(safeCats);

      // 2. Fetch rooms
      let fetchedRooms = [];
      try {
        fetchedRooms = await RoomService.getAll();
      } catch {
        fetchedRooms = [];
      }

      if (!fetchedRooms || fetchedRooms.length === 0) {
        try {
          const snap = await getDocs(collection(dbRooms, 'rooms'));
          snap.forEach(doc => fetchedRooms.push({ id: doc.id, ...doc.data() }));
        } catch {
          const res = await fetch('/api/rooms');
          if (res.ok) fetchedRooms = await res.json();
        }
      }

      const normalized = (fetchedRooms || []).map(r => normalizeRoom(r, safeCats));
      setRooms(normalized);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchRoomsAndCategories();

    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
    const socket = io(socketUrl);
    socket.on('room_status_updated', fetchRoomsAndCategories);
    socket.on('rooms_updated', fetchRoomsAndCategories);
    socket.on('bed_categories_updated', fetchRoomsAndCategories);
    return () => socket.disconnect();
  }, []);

  const filteredRooms = useMemo(() => {
    if (catFilter === 'all') return rooms;
    return rooms.filter(r => {
      if (String(r.categoryId) === String(catFilter)) return true;
      if (catFilter === '1bed' && (r.bedCount === 1 || r.beds === 1)) return true;
      if (catFilter === '2beds' && (r.bedCount === 2 || r.beds === 2)) return true;
      if (catFilter === '3beds' && (r.bedCount === 3 || r.beds === 3)) return true;
      return false;
    });
  }, [rooms, catFilter]);

  const navigate = useNavigate();

  const handleOpenBooking = (room, bedCount, price) => {
    navigate(`/book-room?roomId=${room.id}${bedCount ? `&beds=${bedCount}` : ''}`);
  };

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
              <div className="mb-10">
                <Link to="/" className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-brand-500 transition-colors mb-6 group">
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Home
                </Link>
                <h1 className="font-display text-4xl sm:text-5xl font-bold text-stone-900 mt-4 mb-4">
                  {publicSettings?.public_texts?.guesthouses_title || "Our Guesthouses"}
                </h1>
                <p className="text-stone-500 max-w-2xl text-lg leading-relaxed">
                  {publicSettings?.public_texts?.guesthouses_subtitle || "Comfortable, clean rooms near Angkor Wat — perfect for solo travellers, couples, and families. Review our available rooms below."}
                </p>

                {/* Direct Booking Page Highlight Banner */}
                <div className="mt-6 p-4 bg-gradient-to-r from-brand-50 via-warm-50 to-emerald-50 rounded-2xl border border-brand-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center text-lg shadow-sm shrink-0">
                      <i className="fa-solid fa-calendar-check"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Full Room Booking Page Available</h4>
                      <p className="text-xs text-stone-500">View all amenities, live night calculation, transparent rates in USD & KHR, and instant confirmation.</p>
                    </div>
                  </div>
                  <Link
                    to="/book-room"
                    className="btn-primary px-5 py-2.5 text-xs font-bold shrink-0 shadow-sm"
                  >
                    Open Booking Page <i className="fa-solid fa-arrow-right ml-1"></i>
                  </Link>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 mt-8">
                  <button
                    onClick={() => setCatFilter('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      catFilter === 'all' ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    All Rooms ({rooms.length})
                  </button>
                  {categories.map(cat => {
                    const count = rooms.filter(r => String(r.categoryId) === String(cat.id)).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCatFilter(cat.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          String(catFilter) === String(cat.id) ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                  {categories.length === 0 && (
                    <>
                      <button
                        onClick={() => setCatFilter('1bed')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          catFilter === '1bed' ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        1 Bed
                      </button>
                      <button
                        onClick={() => setCatFilter('2beds')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          catFilter === '2beds' ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        2 Beds
                      </button>
                      <button
                        onClick={() => setCatFilter('3beds')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          catFilter === '3beds' ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        3 Beds
                      </button>
                    </>
                  )}
                </div>
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
                {filteredRooms.map((room, i) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    index={i}
                    onBook={handleOpenBooking}
                  />
                ))}
                {filteredRooms.length === 0 && (
                  <div className="col-span-full py-16 text-center text-stone-400">
                    <i className="fa-solid fa-hotel text-5xl mb-3 opacity-30 block"></i>
                    No rooms available in this category.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {bookingModalState.isOpen && bookingModalState.room && (
        <BookingModal
          isOpen={bookingModalState.isOpen}
          onClose={() => setBookingModalState(prev => ({ ...prev, isOpen: false }))}
          type="room"
          itemName={`${bookingModalState.room.name} (${bookingModalState.room.categoryName || `${bookingModalState.bedCount} Bed`})`}
          pricePerDay={bookingModalState.price}
          bedCount={bookingModalState.bedCount}
        />
      )}

      <Footer businessProfile={publicSettings?.business_profile} contactInfo={publicSettings?.contact_info} loading={loadingSettings} />
    </div>
  );
}
