import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { createSocket } from '../services/socket';
import { ArrowLeft, Search, LayoutGrid, List, SlidersHorizontal, Sparkles, CheckCircle2, X } from 'lucide-react';
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
  const isAvailable = !room.status || room.status === 'vacant' || room.status === 'available';

  return (
    <>
      <div className="card listing-card bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-card flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
        <div>
          {/* Image Slider */}
          <div className="relative h-56 bg-gradient-to-br from-warm-200 to-stone-200 overflow-hidden">
            <img src={images[currentImg]} alt={room.name} className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105" />

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
            <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1.5">
              <i className="fa-solid fa-bed text-indigo-400 text-[10px]"></i>
              <span>{room.categoryName || `${room.bedCount || 1} Bed`}</span>
            </div>

            {/* Price Tag */}
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-brand-500 shadow-sm">
              ${currentPrice}/night
            </div>

            {/* Status Indicator */}
            <div className="absolute bottom-3 left-3">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm flex items-center gap-1.5 shadow-sm ${
                isAvailable
                  ? 'bg-emerald-600/90 text-white'
                  : (room.status === 'cleaning' ? 'bg-amber-500/90 text-white' : 'bg-rose-600/90 text-white')
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span>{isAvailable ? 'Available Now' : (room.status === 'cleaning' ? 'Cleaning' : 'Occupied')}</span>
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="font-bold text-stone-900 text-lg font-display">Room {room.name}</h3>
                <p className="text-xs text-indigo-600 font-bold">{room.bedType || `${room.bedCount || 1} Bed`}</p>
              </div>
              <span className="text-[11px] text-stone-500 font-bold bg-stone-100 px-2.5 py-0.5 rounded-md border border-stone-200/60">
                Floor {room.floor || '1'}
              </span>
            </div>

            <p className="text-xs text-stone-500 mb-4 leading-relaxed line-clamp-2">
              {room.description || 'Comfortable air-conditioned room with private hot shower, cable TV, and free Wi-Fi near Angkor Wat.'}
            </p>

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

            {/* Price & Currency Display */}
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-brand-500">${currentPrice}</span>
                <span className="text-xs text-stone-400 font-medium">/night</span>
              </div>
              <span className="text-[11px] text-stone-500 font-semibold bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/70">
                ~{(currentPrice * 4100).toLocaleString()} ៛ KHR
              </span>
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

function RoomListRow({ room, onBook }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const images = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (room.imageUrl ? [room.imageUrl] : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80']);
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const currentPrice = Number(room.price || room.rate || 25);
  const isAvailable = !room.status || room.status === 'vacant' || room.status === 'available';

  return (
    <>
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 group">
        {/* Photo Thumbnail with badges */}
        <div className="relative w-full md:w-64 h-48 md:h-36 rounded-xl overflow-hidden shrink-0 bg-stone-100">
          <img
            src={images[0]}
            alt={room.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2.5 left-2.5 bg-stone-900/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
            Floor {room.floor || '1'}
          </div>
          <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-sm text-brand-500 font-bold px-2 py-0.5 rounded-full text-[11px] shadow-sm">
            ${currentPrice}/nt
          </div>
          <div className="absolute bottom-2.5 left-2.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm flex items-center gap-1 shadow-sm ${
              isAvailable
                ? 'bg-emerald-600/90 text-white'
                : (room.status === 'cleaning' ? 'bg-amber-500/90 text-white' : 'bg-rose-600/90 text-white')
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>{isAvailable ? 'Available Now' : (room.status === 'cleaning' ? 'Cleaning' : 'Occupied')}</span>
            </span>
          </div>
        </div>

        {/* Room Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
              <i className="fa-solid fa-bed mr-1 text-[10px]"></i>
              {room.categoryName || `${room.bedCount || 1} Bed`}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              <i className="fa-solid fa-user-group mr-1 text-[10px] text-stone-400"></i>
              Max {room.capacity || (room.bedCount * 2) || 2} Guests
            </span>
          </div>

          <h3 className="font-bold text-stone-900 text-lg font-display truncate">
            Room {room.name}
          </h3>
          <p className="text-xs text-stone-600 font-medium mt-0.5">
            {room.bedType || `${room.bedCount || 1} Bed`}
          </p>

          <p className="text-xs text-stone-500 mt-1 line-clamp-1">
            {room.description || 'Comfortable air-conditioned room near Angkor Wat with private hot shower and free Wi-Fi.'}
          </p>

          {/* Amenities chips */}
          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {amenities.slice(0, 4).map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium">
                  <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-brand-500 text-[9px]`}></i>
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price & Booking Actions */}
        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100 shrink-0">
          <div className="text-left md:text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-brand-500">${currentPrice}</span>
              <span className="text-xs text-stone-400 font-semibold">/night</span>
            </div>
            <span className="text-[10px] text-stone-400 block font-medium">
              ~{(currentPrice * 4100).toLocaleString()} ៛ KHR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
            >
              Details
            </button>
            <button
              onClick={() => onBook(room, room.bedCount || 1, currentPrice)}
              className="btn-primary px-4 py-2 text-xs font-bold shadow-md shadow-brand-500/20"
            >
              Book Room
            </button>
          </div>
        </div>
      </div>

      <GuestRoomDetailModal
        room={{ ...room, price: currentPrice }}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBook={() => onBook(room, room.bedCount || 1, currentPrice)}
      />
    </>
  );
}

export default function GuesthousesPage({ publicSettings, loadingSettings }) {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

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

    // 1. Firestore Real-time Subscriptions (onSnapshot)
    const unsubRooms = RoomService.subscribe((firestoreRooms) => {
      if (firestoreRooms && firestoreRooms.length > 0) {
        setRooms(prev => firestoreRooms.map(r => normalizeRoom(r, categories)));
      }
    });

    const unsubBedCategories = BedCategoryService.subscribe((firestoreCats) => {
      if (firestoreCats && firestoreCats.length > 0) {
        const safeCats = firestoreCats.map(normalizeBedCategory);
        setCategories(safeCats);
        setRooms(prev => prev.map(r => normalizeRoom(r, safeCats)));
      }
    });

    // 2. Socket.IO Real-time Events
    const socket = createSocket();
    socket.on('room_status_updated', fetchRoomsAndCategories);
    socket.on('rooms_updated', fetchRoomsAndCategories);
    socket.on('room_occupancy_updated', fetchRoomsAndCategories);
    socket.on('bed_categories_updated', fetchRoomsAndCategories);

    return () => {
      unsubRooms();
      unsubBedCategories();
      socket.disconnect();
    };
  }, []);

  const filteredRooms = useMemo(() => {
    let result = rooms.slice();

    // 1. Category Filter
    if (catFilter !== 'all') {
      result = result.filter(r => {
        if (String(r.categoryId) === String(catFilter)) return true;
        if (catFilter === '1bed' && (r.bedCount === 1 || r.beds === 1)) return true;
        if (catFilter === '2beds' && (r.bedCount === 2 || r.beds === 2)) return true;
        if (catFilter === '3beds' && (r.bedCount === 3 || r.beds === 3)) return true;
        return false;
      });
    }

    // 2. Floor Filter
    if (floorFilter !== 'all') {
      result = result.filter(r => String(r.floor || '1') === String(floorFilter));
    }

    // 3. Availability Filter
    if (availabilityFilter === 'available') {
      result = result.filter(r => !r.status || r.status === 'vacant' || r.status === 'available');
    }

    // 4. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        (r.name && String(r.name).toLowerCase().includes(q)) ||
        (r.number && String(r.number).toLowerCase().includes(q)) ||
        (r.categoryName && String(r.categoryName).toLowerCase().includes(q)) ||
        (r.bedType && String(r.bedType).toLowerCase().includes(q)) ||
        (r.description && String(r.description).toLowerCase().includes(q))
      );
    }

    // 5. Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => Number(a.price || a.rate || 0) - Number(b.price || b.rate || 0));
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => Number(b.price || b.rate || 0) - Number(a.price || a.rate || 0));
    } else if (sortBy === 'room-asc') {
      result.sort((a, b) => String(a.name || a.number).localeCompare(String(b.name || b.number), undefined, { numeric: true }));
    }

    return result;
  }, [rooms, catFilter, floorFilter, availabilityFilter, searchQuery, sortBy]);

  const navigate = useNavigate();

  const handleOpenBooking = (room, bedCount, price) => {
    navigate(`/book-room?roomId=${room.id}${bedCount ? `&beds=${bedCount}` : ''}`);
  };

  const clearFilters = () => {
    setCatFilter('all');
    setSearchQuery('');
    setFloorFilter('all');
    setAvailabilityFilter('all');
    setSortBy('default');
  };

  // Find lowest price across all rooms
  const lowestPrice = rooms.length > 0
    ? Math.min(...rooms.map(r => Number(r.price || r.rate || 25)))
    : 12;

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
              <div className="mb-8">
                <Link to="/" className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-brand-500 transition-colors mb-6 group">
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Home
                </Link>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="font-display text-4xl sm:text-5xl font-bold text-stone-900 mt-2 mb-3">
                      {publicSettings?.public_texts?.guesthouses_title || "Our Guesthouses"}
                    </h1>
                    <p className="text-stone-500 max-w-2xl text-base sm:text-lg leading-relaxed">
                      {publicSettings?.public_texts?.guesthouses_subtitle || "Comfortable, clean rooms near Angkor Wat — perfect for solo travellers, couples, and families. Review our available rooms below."}
                    </p>
                  </div>

                  {/* Direct Room Booking Page Button */}
                  <Link
                    to="/book-room"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all shrink-0 self-start md:self-auto"
                  >
                    <i className="fa-solid fa-calendar-check text-sm"></i>
                    <span>Open Booking Voucher Page</span>
                    <i className="fa-solid fa-arrow-right text-xs ml-1"></i>
                  </Link>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* 1. CATEGORY EASY VIEW CARDS BAR                                     */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Select Room Category
                    </p>
                    <span className="text-xs text-stone-500">
                      Showing <strong className="text-stone-800">{filteredRooms.length}</strong> of {rooms.length} rooms
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* ALL ROOMS CARD */}
                    <button
                      onClick={() => setCatFilter('all')}
                      className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                        catFilter === 'all'
                          ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/25 ring-2 ring-brand-400'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-brand-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                          catFilter === 'all' ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
                        }`}>
                          <i className="fa-solid fa-hotel"></i>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          catFilter === 'all' ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {rooms.length} {rooms.length === 1 ? 'Room' : 'Rooms'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm tracking-tight">All Rooms</h3>
                      <p className={`text-xs mt-0.5 ${catFilter === 'all' ? 'text-brand-100' : 'text-emerald-600 font-semibold'}`}>
                        from ${lowestPrice}/night
                      </p>
                    </button>

                    {/* CATEGORY CARDS */}
                    {categories.map((cat, idx) => {
                      const matchingRooms = rooms.filter(r => String(r.categoryId) === String(cat.id));
                      const minPrice = matchingRooms.length > 0
                        ? Math.min(...matchingRooms.map(r => Number(r.price || r.rate || 25)))
                        : (cat.price || 25);
                      const isSelected = String(catFilter) === String(cat.id);
                      const icons = ['fa-bed', 'fa-user-group', 'fa-people-roof', 'fa-crown'];
                      const icon = icons[idx % icons.length];

                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCatFilter(cat.id)}
                          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                            isSelected
                              ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/25 ring-2 ring-brand-400'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-brand-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                            }`}>
                              <i className={`fa-solid ${icon}`}></i>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isSelected ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {matchingRooms.length} {matchingRooms.length === 1 ? 'Room' : 'Rooms'}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm truncate tracking-tight">{cat.name}</h3>
                          <p className={`text-xs mt-0.5 ${isSelected ? 'text-brand-100' : 'text-emerald-600 font-semibold'}`}>
                            from ${minPrice}/night
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* 2. EASY VIEW TOOLBAR: SEARCH, FILTERS, VIEW MODE                    */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-sm mt-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search room name or number (e.g. 05, 3)..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-8 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filters, Sort & View Mode Switcher */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    {/* Floor filter */}
                    <select
                      value={floorFilter}
                      onChange={e => setFloorFilter(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="all">All Floors</option>
                      <option value="1">Floor 1</option>
                      <option value="2">Floor 2</option>
                      <option value="3">Floor 3</option>
                    </select>

                    {/* Availability filter */}
                    <select
                      value={availabilityFilter}
                      onChange={e => setAvailabilityFilter(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      <option value="available">Available Only</option>
                    </select>

                    {/* Sort */}
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="default">Sort: Recommended</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="room-asc">Room Number</option>
                    </select>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/80">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          viewMode === 'grid'
                            ? 'bg-white text-brand-600 shadow-sm'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Grid</span>
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          viewMode === 'list'
                            ? 'bg-white text-brand-600 shadow-sm'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Easy List View"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Easy List</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 3. ROOMS DISPLAY: GRID OR LIST MODE                                 */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <RoomCardSkeleton key={i} delayClass={`skeleton-delay-${(i % 3) + 1}`} />
                ))}
              </div>
            ) : viewMode === 'grid' ? (
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
                  <div className="col-span-full py-16 text-center text-stone-400 bg-white rounded-3xl border border-dashed border-stone-300 p-8">
                    <i className="fa-solid fa-hotel text-5xl mb-3 opacity-30 block text-brand-500"></i>
                    <h4 className="font-bold text-stone-700 text-base mb-1">No rooms match your criteria</h4>
                    <p className="text-xs text-stone-400 mb-4 max-w-sm mx-auto">
                      Try adjusting your category selection, floor filter, or search keywords.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* EASY LIST VIEW */
              <div className="space-y-4">
                {filteredRooms.map((room) => (
                  <RoomListRow
                    key={room.id}
                    room={room}
                    onBook={handleOpenBooking}
                  />
                ))}
                {filteredRooms.length === 0 && (
                  <div className="py-16 text-center text-stone-400 bg-white rounded-3xl border border-dashed border-stone-300 p-8">
                    <i className="fa-solid fa-hotel text-5xl mb-3 opacity-30 block text-brand-500"></i>
                    <h4 className="font-bold text-stone-700 text-base mb-1">No rooms match your criteria</h4>
                    <p className="text-xs text-stone-400 mb-4 max-w-sm mx-auto">
                      Try adjusting your category selection, floor filter, or search keywords.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      Clear All Filters
                    </button>
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
