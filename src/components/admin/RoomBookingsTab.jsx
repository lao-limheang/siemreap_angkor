import { useState, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { BookingService, syncBookingToOldSystem } from '../../services/DatabaseService';

export default function RoomBookingsTab({
  bookings = [],
  setBookings,
  rooms = [],
  bedCategories = [],
  auth,
  fetchAll,
  fetchDash,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  statusBadge,
  today,
  currency = 'USD'
}) {
  const { showModal, showConfirm } = useModal();

  // Filters & view modes
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modals
  const [detailBooking, setDetailBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);

  // New Booking Form State
  const todayStr = today ? today() : new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [newForm, setNewForm] = useState({
    roomId: '',
    customerName: '',
    phone: '',
    email: '',
    nationality: '',
    startDate: todayStr,
    endDate: tomorrowStr,
    guests: 2,
    bedCount: 1,
    paymentMethod: 'cash',
    arrivalTime: '14:00 - 16:00',
    specialRequests: ''
  });

  // Filter ONLY room bookings
  const roomBookings = useMemo(() => {
    return (bookings || []).filter(b => {
      return (
        b.type === 'room' ||
        Boolean(b.roomId) ||
        Boolean(b.roomName) ||
        String(b.itemName || '').toLowerCase().includes('room')
      );
    });
  }, [bookings]);

  // Apply search & filters
  const filteredBookings = useMemo(() => {
    const q = search.toLowerCase().trim();
    return roomBookings.filter(b => {
      const matchSearch =
        !q ||
        String(b.customerName || '').toLowerCase().includes(q) ||
        String(b.phone || b.customerPhone || '').toLowerCase().includes(q) ||
        String(b.bookingRef || '').toLowerCase().includes(q) ||
        String(b.roomName || b.itemName || '').toLowerCase().includes(q) ||
        String(b.nationality || '').toLowerCase().includes(q);

      const bStatus = b.status || 'confirmed';
      const matchStatus = statusFilter === 'all' || bStatus === statusFilter;

      const matchCat =
        categoryFilter === 'all' ||
        String(b.categoryName || '').toLowerCase().includes(categoryFilter.toLowerCase()) ||
        String(b.categoryId || '') === String(categoryFilter);

      return matchSearch && matchStatus && matchCat;
    });
  }, [roomBookings, search, statusFilter, categoryFilter]);

  // Metrics
  const pendingCount = roomBookings.filter(b => (b.status || 'pending') === 'pending').length;
  const confirmedCount = roomBookings.filter(b => b.status === 'confirmed').length;
  const checkedInCount = roomBookings.filter(b => b.status === 'checked_in').length;
  const cancelledCount = roomBookings.filter(b => b.status === 'cancelled').length;

  const totalRevenueUSD = useMemo(() => {
    return roomBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.totalFee || b.price * b.totalDays || 0), 0);
  }, [roomBookings]);

  const exchangeRate = 4100;
  const totalRevenueKHR = (totalRevenueUSD * exchangeRate).toLocaleString();

  // Status badges
  const bookingStatusBadge = {
    pending: 'bg-amber-100 text-amber-800 border border-amber-300',
    confirmed: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    checked_in: 'bg-blue-100 text-blue-800 border border-blue-300',
    cancelled: 'bg-rose-100 text-rose-800 border border-rose-300'
  };

  // ─── STATUS UPDATES ────────────────────────────────────────────────────────
  const handleUpdateStatus = (id, newStatus) => {
    setBookings(prev => prev.map(b => (b.id === id ? { ...b, status: newStatus } : b)));
    fetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      ...auth,
      headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => {
      console.error('Status update failed:', err);
      if (fetchAll) fetchAll();
    });
  };

  // ─── CHECK-IN GUEST DIRECTLY TO ROOM ──────────────────────────────────────
  const handleDirectCheckIn = async (booking) => {
    if (!await showConfirm(
      'Confirm Check-In',
      `Check in ${booking.customerName} into Room ${booking.roomName || booking.roomId}? This will set the room to occupied.`,
      'Check In Now',
      'primary'
    )) return;

    try {
      // 1. Resolve roomId — look it up from rooms list by name if missing
      const resolvedRoom =
        rooms.find(r => String(r.id) === String(booking.roomId)) ||
        rooms.find(r => r.name === booking.roomName) ||
        null;
      const resolvedRoomId = resolvedRoom?.id || booking.roomId || '';
      const resolvedRoomName = booking.roomName || resolvedRoom?.name || '';

      // 2. Post to room-occupancy API — properly await and check status
      const occupancyPayload = {
        roomId: resolvedRoomId,
        roomName: resolvedRoomName,   // server uses this as fallback to find room by name
        guestName: booking.customerName,
        guestPhone: booking.phone || booking.customerPhone || '',
        guestNationality: booking.nationality || '',
        bedCount: booking.bedCount || 1,
        checkInDate: booking.startDate || todayStr,
        checkOutDate: booking.endDate || tomorrowStr,
        notes: `Booking Ref: ${booking.bookingRef || booking.id}. ${booking.specialRequests || ''}`.trim()
      };

      const occupancyRes = await fetch('/api/room-occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(occupancyPayload)
      });

      if (!occupancyRes.ok) {
        const errBody = await occupancyRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error ${occupancyRes.status}: Could not create check-in record.`);
      }

      // 3. Mark booking as checked_in in bookings table + local state
      handleUpdateStatus(booking.id, 'checked_in');

      showModal('success', 'Guest Checked In', `${booking.customerName} is now checked in to Room ${booking.roomName || resolvedRoomId || ''}.`);

      // 4. Refresh ALL data so occupancy/history tabs update instantly
      if (fetchAll) await fetchAll();
      if (fetchDash) fetchDash();
    } catch (err) {
      console.error('Check-in failed:', err);
      showModal('error', 'Check-in Failed', err.message || 'Could not complete check-in. Please try again.');
    }
  };

  // ─── DELETE BOOKING ────────────────────────────────────────────────────────
  const handleDeleteBooking = async (id) => {
    if (!await showConfirm('Delete Booking', 'Are you sure you want to permanently delete this reservation?', 'Delete', 'danger')) return;
    setBookings(prev => prev.filter(b => b.id !== id));
    fetch(`/api/bookings/${id}`, { method: 'DELETE', ...auth })
      .catch(err => {
        console.error('Delete error:', err);
        if (fetchAll) fetchAll();
      });
  };

  // ─── CREATE NEW ROOM BOOKING (MANUAL) ──────────────────────────────────────
  const handleCreateNewBooking = async (e) => {
    e.preventDefault();
    if (!newForm.customerName.trim() || !newForm.phone.trim()) {
      showModal('error', 'Missing Information', 'Please enter guest name and phone number.');
      return;
    }

    const selectedR = rooms.find(r => String(r.id) === String(newForm.roomId)) || rooms[0];
    const roomName = selectedR ? selectedR.name : '101';
    const categoryName = selectedR ? selectedR.categoryName : 'Standard';
    const bedType = selectedR ? selectedR.bedType : '1 Bed';
    const nightlyRate = selectedR ? (selectedR.price || selectedR.rate || 25) : 25;

    const start = new Date(newForm.startDate);
    const end = new Date(newForm.endDate);
    const nights = Math.max(1, Math.ceil((end - start) / 86400000));
    const totalFee = nightlyRate * nights;

    const bookingRef = `SR-ROOM-${Math.floor(10000 + Math.random() * 90000)}`;
    const itemName = `Room ${roomName} (${categoryName})`;

    const bookingData = {
      type: 'room',
      itemName,
      roomId: selectedR?.id || '',
      roomName,
      categoryName,
      bedType,
      bedCount: newForm.bedCount || selectedR?.bedCount || 1,
      guests: newForm.guests || 2,
      customerName: newForm.customerName.trim(),
      phone: newForm.phone.trim(),
      email: newForm.email.trim(),
      nationality: newForm.nationality.trim(),
      startDate: newForm.startDate,
      endDate: newForm.endDate,
      totalDays: nights,
      pricePerDay: nightlyRate,
      totalFee,
      paymentMethod: newForm.paymentMethod,
      arrivalTime: newForm.arrivalTime,
      specialRequests: newForm.specialRequests.trim(),
      bookingRef,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Sync to chafe-2026 Firestore
      await syncBookingToOldSystem(bookingData).catch(() => {});

      // 2. Submit to backend API
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      const saved = await res.json().catch(() => ({}));

      const newRecord = { ...bookingData, id: saved.id || Date.now().toString() };
      setBookings(prev => [newRecord, ...prev]);
      setNewBookingModalOpen(false);

      // Reset form
      setNewForm({
        roomId: '',
        customerName: '',
        phone: '',
        email: '',
        nationality: '',
        startDate: todayStr,
        endDate: tomorrowStr,
        guests: 2,
        bedCount: 1,
        paymentMethod: 'cash',
        arrivalTime: '14:00 - 16:00',
        specialRequests: ''
      });

      showModal('success', 'Reservation Created', `Booking for Room ${roomName} (Ref: ${bookingRef}) created successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      showModal('error', 'Booking Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP METRICS DASHBOARD                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className={`${cardCls} p-4 flex items-center gap-3.5`}>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-hotel"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">All Room Bookings</p>
            <p className="text-xl font-black text-stone-900">{roomBookings.length}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3.5 border-amber-200 bg-amber-50/40`}>
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-black shrink-0 relative">
            <i className="fa-solid fa-clock"></i>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Action</p>
            <p className="text-xl font-black text-amber-900">{pendingCount}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3.5 border-emerald-200 bg-emerald-50/40`}>
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Confirmed</p>
            <p className="text-xl font-black text-emerald-900">{confirmedCount}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3.5 border-blue-200 bg-blue-50/40`}>
          <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-user-check"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Checked In</p>
            <p className="text-xl font-black text-blue-900">{checkedInCount}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3.5 border-brand-200 bg-brand-50/40 col-span-2 sm:col-span-1`}>
          <div className="w-11 h-11 rounded-2xl bg-brand-500 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
            <i className="fa-solid fa-hand-holding-dollar"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">Total Revenue</p>
            <p className="text-xl font-black text-stone-900">${totalRevenueUSD}</p>
            <span className="text-[10px] text-stone-400 font-mono font-medium block">≈ {totalRevenueKHR} ៛</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. CONTROLS BAR: SEARCH, FILTERS & NEW BOOKING BUTTON              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className={`${cardCls} p-4 flex flex-col lg:flex-row items-center justify-between gap-4`}>
        {/* Search */}
        <div className="w-full lg:w-96 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by guest, phone, ref, room..."
            className={`${inputCls} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* Status Filter */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            {['all', 'pending', 'confirmed', 'checked_in', 'cancelled'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === s ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
                }`}
              >
                {s === 'checked_in' ? 'Checked In' : s}
              </button>
            ))}
          </div>

          {/* Bed Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 outline-none"
          >
            <option value="all">All Bed Categories</option>
            {bedCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-white text-brand-600 shadow-xs' : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Card / Voucher View"
            >
              <i className="fa-solid fa-grip text-xs"></i>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-brand-600 shadow-xs' : 'text-stone-400 hover:text-stone-700'
              }`}
              title="Table View"
            >
              <i className="fa-solid fa-table-list text-xs"></i>
            </button>
          </div>

          {/* New Booking Button */}
          <button
            type="button"
            onClick={() => setNewBookingModalOpen(true)}
            className={`${btnPrimary} flex items-center gap-1.5 shrink-0 text-xs py-2 px-3.5`}
          >
            <i className="fa-solid fa-calendar-plus"></i> New Room Reservation
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. BOOKINGS VIEW: CARDS / GRID VIEW                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBookings.map(b => {
            const bStatus = b.status || 'confirmed';
            const nightly = b.pricePerDay || b.price || 25;
            const total = b.totalFee || nightly * (b.totalDays || 1);
            const khrAmt = (total * exchangeRate).toLocaleString();

            return (
              <div
                key={b.id}
                className={`${cardCls} overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow border-stone-200`}
              >
                <div>
                  {/* Top Reference & Status */}
                  <div className="p-4 pb-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-stone-900 block">
                        {b.bookingRef || `REF-#${String(b.id).slice(-5)}`}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(b.createdAt || Date.now()).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${bookingStatusBadge[bStatus] || bookingStatusBadge.confirmed}`}>
                      {bStatus === 'checked_in' ? 'Checked In' : bStatus}
                    </span>
                  </div>

                  {/* Room & Bed Details */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-stone-900 text-lg font-display">
                          Room {b.roomName || b.roomId || '101'}
                        </h4>
                        <p className="text-xs font-bold text-indigo-600">
                          {b.categoryName || `${b.bedCount || 1} Bed Room`} • {b.bedType || `${b.bedCount || 1} Bed`}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-brand-600">${total}</span>
                        <span className="block text-[10px] text-stone-400 font-mono">≈ {khrAmt} ៛</span>
                      </div>
                    </div>

                    {/* Stay Dates Box */}
                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400 uppercase block">Check-in</span>
                        <span className="font-bold text-stone-800">{b.startDate}</span>
                      </div>
                      <div className="text-center px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-black border border-brand-200">
                        🌙 {b.totalDays || 1} Night{b.totalDays > 1 ? 's' : ''}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-stone-400 uppercase block">Check-out</span>
                        <span className="font-bold text-stone-800">{b.endDate}</span>
                      </div>
                    </div>

                    {/* Guest Information */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Guest:</span>
                        <span className="font-bold text-stone-900 flex items-center gap-1">
                          <i className="fa-solid fa-user text-stone-400 text-[10px]"></i>
                          {b.customerName} {b.nationality && `(${b.nationality})`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Contact:</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${b.phone || b.customerPhone}`}
                            className="font-mono text-stone-700 font-bold hover:text-brand-600"
                          >
                            {b.phone || b.customerPhone}
                          </a>
                          {b.phone && (
                            <a
                              href={`https://wa.me/${String(b.phone).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700"
                              title="WhatsApp Chat"
                            >
                              <i className="fa-brands fa-whatsapp text-sm"></i>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Payment:</span>
                        <span className="font-medium text-stone-700 capitalize">
                          {b.paymentMethod === 'cash' ? 'Pay upon Check-in (Cash)' : 'ABA PAY / KHQR'}
                        </span>
                      </div>

                      {b.specialRequests && (
                        <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-[11px] text-amber-900 italic">
                          "{b.specialRequests}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="p-3 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {bStatus === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <i className="fa-solid fa-check"></i> Confirm
                      </button>
                    )}

                    {bStatus !== 'checked_in' && bStatus !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleDirectCheckIn(b)}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-xs"
                        title="Direct Check-In into Hotel Room"
                      >
                        <i className="fa-solid fa-user-check"></i> Check In
                      </button>
                    )}

                    {bStatus !== 'cancelled' && bStatus !== 'checked_in' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                        className="px-2 py-1 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-300 transition-colors"
                        title="Cancel Reservation"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailBooking(b)}
                      className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-receipt text-stone-400"></i> Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBooking(b.id)}
                      className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredBookings.length === 0 && (
            <div className="col-span-full py-16 text-center text-stone-400">
              <i className="fa-solid fa-calendar-xmark text-4xl mb-3 opacity-30 block"></i>
              No room bookings found matching current filters.
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════ */
        /* 4. BOOKINGS VIEW: COMPACT DATA TABLE VIEW                          */
        /* ═══════════════════════════════════════════════════════════════════ */
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                <tr>
                  {['Ref / Status', 'Room & Category', 'Guest', 'Phone', 'Dates', 'Stay Duration', 'Total Rate', 'Payment', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredBookings.map(b => {
                  const bStatus = b.status || 'confirmed';
                  const nightly = b.pricePerDay || b.price || 25;
                  const total = b.totalFee || nightly * (b.totalDays || 1);

                  return (
                    <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                      {/* Ref & Status */}
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-stone-900">{b.bookingRef || `#${String(b.id).slice(-5)}`}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5 ${bookingStatusBadge[bStatus] || bookingStatusBadge.confirmed}`}>
                          {bStatus === 'checked_in' ? 'Checked In' : bStatus}
                        </span>
                      </td>

                      {/* Room */}
                      <td className="px-4 py-3">
                        <span className="font-black text-stone-900 block">Room {b.roomName || b.roomId || '101'}</span>
                        <span className="text-xs text-indigo-600 font-medium">{b.categoryName || `${b.bedCount || 1} Bed`}</span>
                      </td>

                      {/* Guest */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-stone-900 block">{b.customerName}</span>
                        {b.nationality && <span className="text-[11px] text-stone-400">{b.nationality}</span>}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 font-mono text-xs text-stone-700">
                        <a href={`tel:${b.phone || b.customerPhone}`} className="hover:text-brand-600">
                          {b.phone || b.customerPhone}
                        </a>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3 text-xs text-stone-700">
                        <div className="font-medium">{b.startDate} → {b.endDate}</div>
                        <span className="text-[10px] text-stone-400">{b.arrivalTime || 'Standard Check-in'}</span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-xs">
                        <span className="font-bold text-stone-800">{b.totalDays || 1} Nights</span>
                        <span className="block text-[11px] text-stone-400">{b.guests || 2} Guests</span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3">
                        <span className="font-black text-brand-600 text-sm block">${total}.00</span>
                        <span className="text-[10px] text-stone-400 font-mono">${nightly}/night</span>
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3 text-xs capitalize text-stone-600">
                        {b.paymentMethod === 'cash' ? 'Cash' : 'ABA QR'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {bStatus !== 'checked_in' && bStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleDirectCheckIn(b)}
                              className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1"
                              title="Check-In"
                            >
                              <i className="fa-solid fa-user-check text-[10px]"></i> Check In
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailBooking(b)}
                            className="w-7 h-7 flex items-center justify-center text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
                            title="View Full Voucher"
                          >
                            <i className="fa-solid fa-receipt text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBooking(b.id)}
                            className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-100 rounded-lg"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-stone-400">
                      No room reservations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. MODAL: "SEE ALL" RESERVATION VOUCHER MODAL                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center text-lg font-black shadow-sm">
                  <i className="fa-solid fa-hotel"></i>
                </div>
                <div>
                  <h3 className="font-bold text-base font-display">Room Reservation Voucher</h3>
                  <p className="text-xs text-stone-300 font-mono">Ref: {detailBooking.bookingRef || `#${detailBooking.id}`}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-stone-700">
              {/* Status Header */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase block">Reservation Status</span>
                  <span className="font-black text-sm capitalize text-stone-900">{detailBooking.status || 'Confirmed'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block">Total Amount</span>
                  <span className="font-black text-brand-600 text-base">
                    ${detailBooking.totalFee || detailBooking.pricePerDay * detailBooking.totalDays || 25}.00 USD
                  </span>
                </div>
              </div>

              {/* Guest Details */}
              <div>
                <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wider mb-2">Guest Profile</h4>
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Guest Name</span>
                    <span className="font-bold text-stone-900">{detailBooking.customerName}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Phone Number</span>
                    <span className="font-mono font-bold text-stone-900">{detailBooking.phone || detailBooking.customerPhone}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Email Address</span>
                    <span>{detailBooking.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Nationality</span>
                    <span>{detailBooking.nationality || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Room & Stay Details */}
              <div>
                <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wider mb-2">Room & Stay Details</h4>
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Assigned Room</span>
                    <span className="font-black text-stone-900 text-sm">Room {detailBooking.roomName || detailBooking.roomId}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Bed Category</span>
                    <span className="font-bold text-indigo-700">{detailBooking.categoryName || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Check-in Date</span>
                    <span className="font-bold text-stone-900">{detailBooking.startDate}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Check-out Date</span>
                    <span className="font-bold text-stone-900">{detailBooking.endDate}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Length of Stay</span>
                    <span className="font-bold text-brand-600">{detailBooking.totalDays || 1} Night(s)</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Estimated Arrival</span>
                    <span>{detailBooking.arrivalTime || '14:00 - 16:00'}</span>
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              {detailBooking.specialRequests && (
                <div>
                  <h4 className="font-bold text-stone-900 text-sm uppercase tracking-wider mb-1.5">Special Requests</h4>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    {detailBooking.specialRequests}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors flex items-center gap-1.5"
              >
                <i className="fa-solid fa-print"></i> Print Voucher
              </button>

              <div className="flex items-center gap-2">
                {detailBooking.status !== 'checked_in' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailBooking(null);
                      handleDirectCheckIn(detailBooking);
                    }}
                    className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-user-check"></i> Check In Room
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailBooking(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-200 hover:bg-stone-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. MODAL: CREATE NEW ROOM RESERVATION (WALK-IN / PHONE)            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {newBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center font-black">
                  <i className="fa-solid fa-calendar-plus"></i>
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base font-display">New Room Reservation</h3>
                  <p className="text-xs text-stone-400">Add a direct or phone reservation into the system.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewBookingModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCreateNewBooking} className="p-6 overflow-y-auto space-y-4">
              {/* Room Selection */}
              <div>
                <label className={labelCls}>Select Room *</label>
                <select
                  value={newForm.roomId}
                  onChange={e => setNewForm({ ...newForm, roomId: e.target.value })}
                  className={inputCls}
                  required
                >
                  <option value="">-- Choose Room --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.name} — Floor {r.floor || '1'} — {r.categoryName || `${r.bedCount || 1} Bed`} (${r.price || r.rate || 25}/night) [{r.status || 'vacant'}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Michael Brown"
                    value={newForm.customerName}
                    onChange={e => setNewForm({ ...newForm, customerName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+855 12 345 678"
                    value={newForm.phone}
                    onChange={e => setNewForm({ ...newForm, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. France, Cambodia"
                    value={newForm.nationality}
                    onChange={e => setNewForm({ ...newForm, nationality: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Stay Dates */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <label className={labelCls}>Check-In Date *</label>
                  <input
                    type="date"
                    required
                    value={newForm.startDate}
                    onChange={e => setNewForm({ ...newForm, startDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Check-Out Date *</label>
                  <input
                    type="date"
                    required
                    value={newForm.endDate}
                    onChange={e => setNewForm({ ...newForm, endDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Payment & Arrival */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={newForm.paymentMethod}
                    onChange={e => setNewForm({ ...newForm, paymentMethod: e.target.value })}
                    className={inputCls}
                  >
                    <option value="cash">Pay on Arrival (Cash)</option>
                    <option value="aba">ABA PAY / KHQR</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Estimated Arrival</label>
                  <select
                    value={newForm.arrivalTime}
                    onChange={e => setNewForm({ ...newForm, arrivalTime: e.target.value })}
                    className={inputCls}
                  >
                    <option value="12:00 - 14:00">12:00 - 14:00</option>
                    <option value="14:00 - 16:00">14:00 - 16:00</option>
                    <option value="16:00 - 18:00">16:00 - 18:00</option>
                    <option value="18:00 - 21:00">18:00 - 21:00</option>
                    <option value="Late Night">Late Night</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes / Special Requests</label>
                <textarea
                  rows="2"
                  placeholder="Quiet room, extra pillow, etc."
                  value={newForm.specialRequests}
                  onChange={e => setNewForm({ ...newForm, specialRequests: e.target.value })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewBookingModalOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={btnPrimary}
                >
                  <i className="fa-solid fa-check mr-1.5"></i> Create Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
