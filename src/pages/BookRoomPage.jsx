import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Clock, Calendar, Users, Bed, CreditCard, Sparkles, Phone, MessageCircle } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { dbRooms } from '../firebase';
import { RoomService, BedCategoryService, syncBookingToOldSystem } from '../services/DatabaseService';
import { normalizeRoom, normalizeBedCategory } from '../utils/dataNormalizer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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

export default function BookRoomPage({ publicSettings, loadingSettings }) {
  const [searchParams] = useSearchParams();
  const { id: routeRoomId } = useParams();
  const navigate = useNavigate();

  const preselectedRoomId = searchParams.get('roomId') || routeRoomId || '';

  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(preselectedRoomId);
  const [currentImg, setCurrentImg] = useState(0);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    nationality: '',
    startDate: todayStr,
    endDate: tomorrowStr,
    guests: 2,
    bedCount: 1,
    arrivalTime: '14:00 - 16:00',
    paymentMethod: 'cash',
    specialRequests: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [catalogCatFilter, setCatalogCatFilter] = useState('all');

  // 1. Fetch Rooms & Categories
  useEffect(() => {
    window.scrollTo(0, 0);

    const loadData = async () => {
      try {
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

        // Auto select room
        if (preselectedRoomId && normalized.some(r => String(r.id) === String(preselectedRoomId))) {
          setSelectedRoomId(preselectedRoomId);
        } else if (normalized.length > 0) {
          setSelectedRoomId(normalized[0].id);
        }
      } catch (err) {
        console.error('Error loading rooms:', err);
      } finally {
        setLoadingRooms(false);
      }
    };

    loadData();
  }, [preselectedRoomId]);

  // Selected Room Object
  const selectedRoom = useMemo(() => {
    return rooms.find(r => String(r.id) === String(selectedRoomId)) || rooms[0] || null;
  }, [rooms, selectedRoomId]);

  // Update bed count and guests when room changes
  useEffect(() => {
    if (selectedRoom) {
      setCurrentImg(0);
      setForm(prev => ({
        ...prev,
        bedCount: selectedRoom.bedCount || 1,
        guests: Math.min(prev.guests || 2, selectedRoom.capacity || 2)
      }));
    }
  }, [selectedRoom]);

  // Duration & Pricing calculations
  const totalNights = useMemo(() => {
    if (!form.startDate || !form.endDate) return 1;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [form.startDate, form.endDate]);

  const nightlyRate = selectedRoom?.price || selectedRoom?.rate || 25;
  const subtotal = nightlyRate * totalNights;
  const exchangeRate = publicSettings?.pricing_tax?.exchangeRate || 4100;
  const totalKHR = (subtotal * exchangeRate).toLocaleString();

  const roomImages = useMemo(() => {
    if (!selectedRoom) return ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80'];
    if (Array.isArray(selectedRoom.images) && selectedRoom.images.length > 0) return selectedRoom.images;
    if (selectedRoom.imageUrl) return [selectedRoom.imageUrl];
    return ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80'];
  }, [selectedRoom]);

  // Handle Form Submit
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom) {
      setErrorMsg('Please select a room to book.');
      return;
    }
    if (!form.customerName.trim() || !form.phone.trim()) {
      setErrorMsg('Please enter your full name and phone number.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const bookingRef = `SR-ROOM-${Math.floor(10000 + Math.random() * 90000)}`;
    const itemName = `Room ${selectedRoom.name} (${selectedRoom.categoryName || `${selectedRoom.bedCount} Bed`})`;

    const bookingPayload = {
      type: 'room',
      itemName,
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      categoryName: selectedRoom.categoryName,
      bedType: selectedRoom.bedType,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      nationality: form.nationality.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays: totalNights,
      bedCount: form.bedCount || selectedRoom.bedCount || 1,
      guests: form.guests || 2,
      pricePerDay: nightlyRate,
      totalFee: subtotal,
      paymentMethod: form.paymentMethod,
      arrivalTime: form.arrivalTime,
      specialRequests: form.specialRequests.trim(),
      bookingRef,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Sync directly to chafe-2026 Firestore (Live Realtime Database)
      await syncBookingToOldSystem({
        type: 'room',
        itemName,
        pricePerDay: nightlyRate,
        totalDays: totalNights,
        totalFee: subtotal,
        ...bookingPayload
      }).catch(err => console.warn('Sync firestore:', err));

      // 2. Submit to local SQLite + Telegram Alert
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'room',
          itemName,
          ...bookingPayload
        })
      }).catch(err => console.warn('API error:', err));

      setBookingConfirmed({
        ...bookingPayload,
        room: selectedRoom
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg('Failed to process booking. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="font-sans min-h-screen bg-[#fbf9f5] text-stone-800">
      <Navbar alwaysSolid={true} data={publicSettings?.business_profile} loading={loadingSettings} />

      <main className="pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb / Back Link */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/guesthouses"
              className="inline-flex items-center text-sm font-bold text-stone-500 hover:text-brand-500 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to All Guesthouses
            </Link>

            <span className="text-xs font-bold px-3 py-1 bg-brand-50 text-brand-600 rounded-full border border-brand-200">
              <Sparkles className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Direct Hotel Booking Guarantee
            </span>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STATE A: BOOKING CONFIRMED VOUCHER ("SEE ALL" CONFIRMATION)        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {bookingConfirmed ? (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden anim-fade-in print:border-none print:shadow-none">
              {/* Voucher Top Banner */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-8 text-center relative">
                <div className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">Booking Confirmed!</h1>
                <p className="text-emerald-100 text-sm mt-1">ការកក់បន្ទប់របស់អ្នកត្រូវបានទទួលជោគជ័យ</p>
                <div className="mt-4 inline-block px-4 py-1 rounded-full bg-black/20 backdrop-blur-sm text-xs font-mono font-bold tracking-wider">
                  REFERENCE: {bookingConfirmed.bookingRef}
                </div>
              </div>

              {/* Voucher Content */}
              <div className="p-6 sm:p-8 space-y-6 text-sm">
                {/* Stay Highlights Card */}
                <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Room</span>
                    <span className="font-black text-stone-900 text-base">Room {bookingConfirmed.roomName}</span>
                    <span className="text-stone-500 block">Floor {bookingConfirmed.room?.floor || '1'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Bed Category</span>
                    <span className="font-bold text-indigo-700">{bookingConfirmed.categoryName || 'Standard'}</span>
                    <span className="text-stone-500 block">{bookingConfirmed.bedType}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Check-in Date</span>
                    <span className="font-bold text-stone-900 text-sm">{bookingConfirmed.startDate}</span>
                    <span className="text-stone-500 block">From 2:00 PM</span>
                  </div>
                  <div>
                    <span className="text-stone-400 font-bold uppercase tracking-wider block text-[10px]">Check-out Date</span>
                    <span className="font-bold text-amber-700 text-sm">{bookingConfirmed.endDate}</span>
                    <span className="text-stone-500 block">Until 12:00 PM</span>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="bg-stone-100 px-5 py-3 font-bold text-xs text-stone-700 uppercase tracking-wider border-b border-stone-200">
                    Guest & Reservation Summary
                  </div>
                  <div className="divide-y divide-stone-100 text-xs">
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Primary Guest Name</span>
                      <span className="font-bold text-stone-900">{bookingConfirmed.customerName}</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Phone Number (WhatsApp/Telegram)</span>
                      <span className="font-mono font-bold text-stone-900">{bookingConfirmed.phone}</span>
                    </div>
                    {bookingConfirmed.email && (
                      <div className="px-5 py-3 flex justify-between">
                        <span className="text-stone-500">Email Address</span>
                        <span className="text-stone-900">{bookingConfirmed.email}</span>
                      </div>
                    )}
                    {bookingConfirmed.nationality && (
                      <div className="px-5 py-3 flex justify-between">
                        <span className="text-stone-500">Nationality</span>
                        <span className="text-stone-900">{bookingConfirmed.nationality}</span>
                      </div>
                    )}
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Duration of Stay</span>
                      <span className="font-bold text-stone-900">{bookingConfirmed.totalDays} Night{bookingConfirmed.totalDays > 1 ? 's' : ''}</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Number of Guests</span>
                      <span className="text-stone-900">{bookingConfirmed.guests} Persons</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Estimated Arrival Time</span>
                      <span className="text-stone-900">{bookingConfirmed.arrivalTime}</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between bg-stone-50 font-bold">
                      <span className="text-stone-700">Total Nightly Rate ({bookingConfirmed.totalDays} x ${bookingConfirmed.pricePerDay})</span>
                      <span className="text-brand-600 text-base">${bookingConfirmed.totalFee}.00 USD ({totalKHR} ៛)</span>
                    </div>
                    <div className="px-5 py-3 flex justify-between">
                      <span className="text-stone-500">Payment Status</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold capitalize">
                        {bookingConfirmed.paymentMethod === 'cash' ? 'Pay upon Check-in (Cash)' : 'Pay via ABA KHQR / Bank'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hotel Contact & Direct Assistance */}
                <div className="p-5 bg-warm-50 rounded-2xl border border-warm-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Need help or early check-in?</h4>
                    <p className="text-xs text-stone-500 mt-0.5">Our front desk team is ready on Telegram & WhatsApp 24/7.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {publicSettings?.contact_info?.telegramUrl && (
                      <a
                        href={publicSettings.contact_info.telegramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-sky-500 text-white font-bold rounded-xl text-xs hover:bg-sky-600 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <i className="fa-brands fa-telegram text-sm"></i> Telegram
                      </a>
                    )}
                    {publicSettings?.contact_info?.whatsappUrl && (
                      <a
                        href={publicSettings.contact_info.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <i className="fa-brands fa-whatsapp text-sm"></i> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <i className="fa-solid fa-print"></i> Print / Save Voucher
                  </button>

                  <div className="flex items-center gap-2">
                    <Link
                      to="/motor-rentals"
                      className="px-4 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-motorcycle"></i> Add a Motorbike
                    </Link>
                    <Link
                      to="/guesthouses"
                      className="btn-primary px-5 py-2.5 text-xs font-bold"
                    >
                      Back to Guesthouses
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* STATE B: ACTIVE ROOM BOOKING FORM & "SEE ALL" ROOM SUMMARY         */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div id="booking-form">
              {/* Header Title */}
              <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-black text-stone-900 font-display">
                  Book Your Room (កក់បន្ទប់ស្នាក់នៅ)
                </h1>
                <p className="text-stone-500 text-sm sm:text-base mt-1.5 max-w-2xl">
                  Review complete room details, bed configurations, transparent rates, and confirm your stay near Angkor Wat with zero booking fees.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 2-Column Booking Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ── LEFT COLUMN (7 COLS): GUEST & STAY FORM ────────────────── */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6">
                  <form onSubmit={handleBookingSubmit} className="space-y-6">
                    {/* Step 1: Room Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                          <Bed className="w-4 h-4 text-brand-500" />
                          1. Select Room & Bed Configuration
                        </label>
                        <span className="text-xs font-bold text-stone-400">
                          {rooms.length} Rooms Available
                        </span>
                      </div>

                      <select
                        value={selectedRoomId}
                        onChange={e => setSelectedRoomId(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm font-bold text-stone-800 outline-none focus:border-brand-500 focus:bg-white transition-all shadow-xs mb-3"
                      >
                        {rooms.map(r => (
                          <option key={r.id} value={r.id}>
                            Room {r.name} — Floor {r.floor || '1'} — {r.categoryName || `${r.bedCount || 1} Bed`} (${r.price || r.rate}/night)
                          </option>
                        ))}
                      </select>

                      {/* Visual Room Quick Picker Cards ("See All" room options) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-stone-400 font-bold px-1">
                          <span>Quick Choose Room:</span>
                          <span className="text-brand-600">Click card to select</span>
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                          {rooms.map(r => {
                            const isSelected = String(r.id) === String(selectedRoomId);
                            const img = (Array.isArray(r.images) && r.images[0]) || r.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300&q=80';
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setSelectedRoomId(r.id)}
                                className={`shrink-0 w-36 text-left rounded-xl border p-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 shadow-xs'
                                    : 'border-stone-200 bg-stone-50/70 hover:border-stone-300 hover:bg-white'
                                }`}
                              >
                                <div className="h-16 rounded-lg overflow-hidden mb-1.5 relative bg-stone-200">
                                  <img src={img} alt={r.name} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-1 right-1 bg-stone-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    ${r.price || r.rate || 25}
                                  </span>
                                </div>
                                <div className="font-bold text-xs text-stone-900 truncate">Room {r.name}</div>
                                <div className="text-[10px] text-indigo-600 font-medium truncate">
                                  {r.categoryName || `${r.bedCount || 1} Bed`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Stay Dates & Guests */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-brand-500" />
                          2. Dates of Stay & Guests
                        </label>
                        <span className="text-xs font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                          🌙 {totalNights} Night{totalNights > 1 ? 's' : ''} Stay
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Check-in Date (ថ្ងៃចូល)</label>
                          <input
                            type="date"
                            min={todayStr}
                            value={form.startDate}
                            onChange={e => setForm({ ...form, startDate: e.target.value })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-800 outline-none focus:border-brand-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Check-out Date (ថ្ងៃចេញ)</label>
                          <input
                            type="date"
                            min={form.startDate || todayStr}
                            value={form.endDate}
                            onChange={e => setForm({ ...form, endDate: e.target.value })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-800 outline-none focus:border-brand-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-stone-400" /> Number of Guests
                          </label>
                          <select
                            value={form.guests}
                            onChange={e => setForm({ ...form, guests: parseInt(e.target.value) || 1 })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-800 outline-none focus:border-brand-500"
                          >
                            {[1, 2, 3, 4, 5, 6].map(n => (
                              <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" /> Estimated Arrival
                          </label>
                          <select
                            value={form.arrivalTime}
                            onChange={e => setForm({ ...form, arrivalTime: e.target.value })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-800 outline-none focus:border-brand-500"
                          >
                            <option value="12:00 - 14:00">12:00 - 14:00 (Early Check-in)</option>
                            <option value="14:00 - 16:00">14:00 - 16:00 (Standard)</option>
                            <option value="16:00 - 18:00">16:00 - 18:00 (Late Afternoon)</option>
                            <option value="18:00 - 21:00">18:00 - 21:00 (Evening)</option>
                            <option value="After 21:00">After 21:00 (Late Night)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Guest Personal Information */}
                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-brand-500" />
                        3. Guest Contact Details
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Full Name (ឈ្មោះពេញ) *</label>
                          <input
                            type="text"
                            placeholder="e.g. John Doe or Chan Sophea"
                            value={form.customerName}
                            onChange={e => setForm({ ...form, customerName: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">
                            Phone / WhatsApp / Telegram *
                          </label>
                          <input
                            type="tel"
                            placeholder="+855 12 345 678"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-brand-500 focus:bg-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Email Address</label>
                          <input
                            type="email"
                            placeholder="guest@example.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Nationality / Country</label>
                          <input
                            type="text"
                            placeholder="e.g. Cambodia, France, USA, Japan..."
                            value={form.nationality}
                            onChange={e => setForm({ ...form, nationality: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-stone-600 mb-1.5">Special Requests or Notes</label>
                          <textarea
                            rows="2"
                            placeholder="Quiet room, ground floor preference, airport pickup, or bundle with motorcycle rental..."
                            value={form.specialRequests}
                            onChange={e => setForm({ ...form, specialRequests: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Payment Preference */}
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-brand-500" />
                        4. Payment Preference
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            form.paymentMethod === 'cash' ? 'border-brand-500 bg-brand-50/50' : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={form.paymentMethod === 'cash'}
                            onChange={() => setForm({ ...form, paymentMethod: 'cash' })}
                            className="mt-1 accent-brand-500"
                          />
                          <div>
                            <span className="font-bold text-stone-900 text-sm block">Pay on Arrival (Cash)</span>
                            <span className="text-xs text-stone-500 block mt-0.5">Pay in USD or KHR when you check in at reception.</span>
                          </div>
                        </label>

                        <label
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                            form.paymentMethod === 'aba' ? 'border-brand-500 bg-brand-50/50' : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="aba"
                            checked={form.paymentMethod === 'aba'}
                            onChange={() => setForm({ ...form, paymentMethod: 'aba' })}
                            className="mt-1 accent-brand-500"
                          />
                          <div>
                            <span className="font-bold text-stone-900 text-sm block">ABA PAY / KHQR Bank</span>
                            <span className="text-xs text-stone-500 block mt-0.5">Scan KHQR code using any Cambodian bank app.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 space-y-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary w-full justify-center py-4 text-base font-black shadow-xl shadow-brand-500/25 disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Processing Reservation...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-check-circle mr-2"></i> Confirm Room Reservation — ${subtotal}.00 USD
                          </>
                        )}
                      </button>

                      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-stone-500 font-medium">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Free Cancellation up to 24h
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Instant Confirmation
                        </span>
                        <span>•</span>
                        <span>No hidden service fees</span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* ── RIGHT COLUMN (5 COLS): "SEE ALL" ROOM SUMMARY CARD ────── */}
                <div className="lg:col-span-5 sticky top-24 space-y-5">
                  <div className="bg-white rounded-3xl border border-stone-200 shadow-card overflow-hidden">
                    {/* Photo Slider */}
                    <div className="relative h-60 bg-stone-900 overflow-hidden group">
                      <img
                        src={roomImages[currentImg]}
                        alt={selectedRoom?.name}
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      />
                      {roomImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCurrentImg((currentImg - 1 + roomImages.length) % roomImages.length)}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-800 flex items-center justify-center shadow hover:bg-white transition-colors"
                          >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentImg((currentImg + 1) % roomImages.length)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-stone-800 flex items-center justify-center shadow hover:bg-white transition-colors"
                          >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {roomImages.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setCurrentImg(i)}
                                className={`h-1.5 rounded-full transition-all ${i === currentImg ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5">
                        <i className="fa-solid fa-bed text-indigo-400"></i>
                        <span>{selectedRoom?.categoryName || `${selectedRoom?.bedCount || 1} Bed`}</span>
                      </div>
                      <div className="absolute top-3 right-3 bg-brand-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
                        ${nightlyRate} / night
                      </div>
                    </div>

                    {/* Room Info */}
                    <div className="p-6 space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-2xl font-black text-stone-900 font-display">
                              Room {selectedRoom?.name}
                            </h3>
                            <p className="text-xs font-bold text-indigo-600 mt-0.5">
                              {selectedRoom?.bedType || `${selectedRoom?.bedCount || 1} Bed`} • Floor {selectedRoom?.floor || '1'}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                            Max {selectedRoom?.capacity || (selectedRoom?.bedCount * 2) || 2} Guests
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-2.5 leading-relaxed">
                          {selectedRoom?.description || 'Clean, comfortable, and modern room equipped with air conditioning, hot shower, and free high-speed Wi-Fi.'}
                        </p>
                      </div>

                      {/* "See All" Amenities with Icons */}
                      <div className="pt-2 border-t border-stone-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                          Room Amenities (សម្ភារៈបន្ទប់)
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(selectedRoom?.amenities || Object.keys(AMENITY_ICONS).slice(0, 6)).map(a => (
                            <div key={a} className="flex items-center gap-2 text-stone-700">
                              <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-brand-500 text-xs w-3.5 shrink-0`}></i>
                              <span className="truncate">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* "See All" Price Calculation Breakdown */}
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
                        <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] mb-2">
                          Price Breakdown (ការគណនាតម្លៃ)
                        </h4>
                        <div className="flex justify-between text-stone-600">
                          <span>${nightlyRate} × {totalNights} night{totalNights > 1 ? 's' : ''}</span>
                          <span className="font-mono font-bold">${subtotal}.00</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>Cleaning & Housekeeping</span>
                          <span className="text-emerald-600 font-bold">Free</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>Wi-Fi & Service Taxes</span>
                          <span className="text-emerald-600 font-bold">Included</span>
                        </div>
                        <div className="pt-2 border-t border-stone-200 flex items-baseline justify-between">
                          <span className="font-bold text-stone-900 text-sm">Total Due</span>
                          <div className="text-right">
                            <span className="text-xl font-black text-brand-500">${subtotal}.00 USD</span>
                            <span className="block text-[11px] text-stone-400 font-mono">≈ {totalKHR} KHR</span>
                          </div>
                        </div>
                      </div>

                      {/* Policies */}
                      <div className="text-[11px] text-stone-500 space-y-1 bg-warm-50/50 p-3 rounded-xl border border-warm-100">
                        <p><strong>Check-in:</strong> 2:00 PM | <strong>Check-out:</strong> 12:00 PM</p>
                        <p><strong>Free cancellation:</strong> Up to 24 hours prior to arrival.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* "SEE ALL AVAILABLE ROOMS" CATALOG & DIRECT SELECTION GRID     */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div className="mt-16 pt-12 border-t border-stone-200">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold border border-brand-200 mb-2">
                      <Bed className="w-3.5 h-3.5" />
                      Compare All Accommodations
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-stone-900 font-display">
                      See All Rooms & Bed Categories
                    </h2>
                    <p className="text-stone-500 text-sm mt-1">
                      Explore our full collection of rooms. Click any room below to load its details and book immediately.
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCatalogCatFilter('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        catalogCatFilter === 'all'
                          ? 'bg-brand-500 text-white shadow-sm'
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      All Rooms ({rooms.length})
                    </button>
                    {categories.map(cat => {
                      const count = rooms.filter(r => String(r.categoryId) === String(cat.id)).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCatalogCatFilter(cat.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            String(catalogCatFilter) === String(cat.id)
                              ? 'bg-brand-500 text-white shadow-sm'
                              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {cat.name} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rooms
                    .filter(r => catalogCatFilter === 'all' || String(r.categoryId) === String(catalogCatFilter))
                    .map(room => {
                      const isCurrent = String(room.id) === String(selectedRoomId);
                      const img = (Array.isArray(room.images) && room.images[0]) || room.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80';
                      return (
                        <div
                          key={room.id}
                          className={`bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                            isCurrent
                              ? 'border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                              : 'border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300'
                          }`}
                        >
                          <div>
                            <div className="relative h-48 bg-stone-100 overflow-hidden group">
                              <img src={img} alt={room.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              <div className="absolute top-2.5 left-2.5 bg-stone-900/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                                <i className="fa-solid fa-bed text-indigo-400 text-[10px]"></i>
                                <span>{room.categoryName || `${room.bedCount || 1} Bed`}</span>
                              </div>
                              <div className="absolute top-2.5 right-2.5 bg-white/95 px-2.5 py-0.5 rounded-full text-xs font-black text-brand-500 shadow-xs">
                                ${room.price || room.rate || 25}/night
                              </div>
                            </div>

                            <div className="p-5 space-y-2.5">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-bold text-stone-900 text-lg font-display">Room {room.name}</h4>
                                  <p className="text-xs text-indigo-600 font-bold">{room.bedType || `${room.bedCount || 1} Bed`}</p>
                                </div>
                                <span className="text-[11px] text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded">
                                  Floor {room.floor || '1'}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                                {room.description || 'Clean, quiet, and comfortable room with private bathroom, air conditioning, and free Wi-Fi.'}
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(room.amenities || Object.keys(AMENITY_ICONS).slice(0, 4)).slice(0, 4).map(a => (
                                  <span key={a} className="text-[11px] bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-md font-medium">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="p-5 pt-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRoomId(room.id);
                                const formEl = document.getElementById('booking-form');
                                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                isCurrent
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-stone-900 hover:bg-brand-500 text-white'
                              }`}
                            >
                              {isCurrent ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Currently Selected For Booking
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-calendar-check text-[11px]"></i> Select & Book This Room
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer businessProfile={publicSettings?.business_profile} contactInfo={publicSettings?.contact_info} loading={loadingSettings} />
    </div>
  );
}
