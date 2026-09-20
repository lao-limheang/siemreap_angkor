import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';
import { BookingService, OccupancyService, RoomService } from '../../services/DatabaseService';
import { useModal } from '../common/ModalProvider';
import RoomInvoiceModal from './RoomInvoiceModal';

export default function RoomHistoryTab({
  occupancy = [],
  setOccupancy,
  bookings = [],
  setBookings,
  rooms = [],
  auth,
  fetchAll,
  cardCls = 'bg-white border border-stone-200 rounded-2xl shadow-sm',
  inputCls = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm',
  labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5',
  btnPrimary = 'px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors shadow-sm',
  btnSecondary = 'px-4 py-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-50 transition-colors',
  btnDanger = 'px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors',
  currency = 'USD',
  settings = {}
}) {
  const { showModal, showConfirm } = useModal();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [printRecord, setPrintRecord] = useState(null);

  // ── Merge occupancy records + checked-in bookings (as fallback) ─────────────
  const allHistory = useMemo(() => {
    // 1. Normalize real occupancy records from room_occupancy table
    const fromOccupancy = (occupancy || []).map(o => {
      const matchedRoom = (rooms || []).find(r => 
        (o.roomId && String(r.id) === String(o.roomId)) ||
        (o.roomName && (r.name === o.roomName || `Room ${r.name}` === o.roomName || r.name === String(o.roomName).replace(/^Room\s*#?/i, '')))
      ) || (rooms || []).find(r => r.status === 'occupied') || rooms[0];

      const cleanRoomName = o.roomName && String(o.roomName).trim() && String(o.roomName).trim().toLowerCase() !== 'null' && String(o.roomName).trim() !== 'room #null'
        ? (String(o.roomName).startsWith('Room') ? o.roomName : `Room ${o.roomName}`)
        : (matchedRoom?.name ? `Room ${matchedRoom.name}` : (o.roomId && String(o.roomId) !== 'null' ? `Room ${o.roomId}` : 'Room 101'));

      const rawStatus = String(o.status || '').toLowerCase().trim();
      const isCheckedOut = rawStatus === 'checked_out' || rawStatus === 'completed' || rawStatus === 'returned' || !!o.checkOutActual;
      const isCheckedIn = !isCheckedOut && (rawStatus === 'checked_in' || rawStatus === 'active' || rawStatus === 'occupied' || !rawStatus);
      const normalizedStatus = isCheckedIn ? 'checked_in' : 'checked_out';

      return {
        id: `occ-${o.id}`,
        rawId: o.id,
        occupancyId: o.id,
        roomName: cleanRoomName,
        roomId: o.roomId || matchedRoom?.id || '101',
        guestName: o.guestName,
        guestPhone: o.guestPhone,
        guestNationality: o.guestNationality,
        bedCount: o.bedCount || matchedRoom?.bedCount || 1,
        checkInDate: o.checkInDate,
        checkOutDate: o.checkOutDate || o.actualCheckOut,
        totalPrice: o.totalPrice || o.dailyRate || null,
        status: normalizedStatus,
        source: 'occupancy',
        notes: o.notes
      };
    });

    // 2. Pull checked-in bookings that have NO corresponding occupancy record yet
    const occupancyGuestNames = new Set(fromOccupancy.map(o => o.guestName?.toLowerCase()));
    const fromBookings = (bookings || [])
      .filter(b =>
        b.status === 'checked_in' &&
        (b.roomId || b.roomName) &&
        !occupancyGuestNames.has((b.customerName || '').toLowerCase())
      )
      .map(b => ({
        id: `bk-${b.id}`,
        rawId: b.id,
        occupancyId: null,
        roomName: b.roomName || b.itemName || `Room #${b.roomId}`,
        roomId: b.roomId,
        guestName: b.customerName,
        guestPhone: b.phone || b.customerPhone,
        guestNationality: b.nationality,
        bedCount: b.bedCount || 1,
        checkInDate: b.startDate,
        checkOutDate: b.endDate,
        totalPrice: b.totalFee || (b.pricePerDay * b.totalDays) || null,
        status: 'checked_in',
        source: 'booking',
        notes: b.specialRequests,
        bookingRef: b.bookingRef
      }));

    return [...fromOccupancy, ...fromBookings];
  }, [occupancy, bookings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = allHistory.filter(o => {
      const matchSearch =
        !q ||
        (o.guestName || '').toLowerCase().includes(q) ||
        (o.roomName || '').toLowerCase().includes(q) ||
        (o.guestPhone || '').toLowerCase().includes(q);

      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchFrom = !dateFrom || (o.checkInDate || '') >= dateFrom;
      const matchTo = !dateTo || (o.checkInDate || '') <= dateTo;

      return matchSearch && matchStatus && matchFrom && matchTo;
    });

    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        const da = new Date(a.checkInDate || a.startDate || 0).getTime();
        const db = new Date(b.checkInDate || b.startDate || 0).getTime();
        return db - da;
      }
      if (sortBy === 'date-asc') {
        const da = new Date(a.checkInDate || a.startDate || 0).getTime();
        const db = new Date(b.checkInDate || b.startDate || 0).getTime();
        return da - db;
      }
      if (sortBy === 'name-asc') {
        return String(a.guestName || '').trim().localeCompare(String(b.guestName || '').trim(), 'km');
      }
      if (sortBy === 'name-desc') {
        return String(b.guestName || '').trim().localeCompare(String(a.guestName || '').trim(), 'km');
      }
      if (sortBy === 'room-asc') {
        return String(a.roomName || '').trim().localeCompare(String(b.roomName || '').trim(), undefined, { numeric: true });
      }
      if (sortBy === 'price-desc') {
        return (Number(b.totalPrice || 0)) - (Number(a.totalPrice || 0));
      }
      if (sortBy === 'price-asc') {
        return (Number(a.totalPrice || 0)) - (Number(b.totalPrice || 0));
      }
      return 0;
    });

    return list;
  }, [allHistory, search, statusFilter, dateFrom, dateTo, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ── Quick KPI stats ─────────────────────────────────────────────────────────
  const activeCount = allHistory.filter(o => o.status === 'checked_in').length;
  const checkedOutCount = allHistory.filter(o => o.status === 'checked_out').length;

  // ── Check-out a real occupancy record ──────────────────────────────────────
  const handleCheckOut = async (record) => {
    if (!record.occupancyId) {
      showModal('warning', 'Notice', 'This record was checked in from a booking without an occupancy row. Please edit its status or manage it via Room Bookings.');
      return;
    }
    const confirmed = await showConfirm(
      'Check Out Guest',
      `Check out ${record.guestName} from ${record.roomName}?`,
      'Check Out',
      'warning'
    );
    if (!confirmed) return;
    try {
      // Optimistic state update in real time
      if (setOccupancy) {
        setOccupancy(prev => (prev || []).map(o => String(o.id) === String(record.occupancyId) ? { ...o, status: 'checked_out', actualCheckOut: new Date().toISOString().split('T')[0] } : o));
      }

      // Write to Firebase (shared cloud) first
      await OccupancyService.update(record.occupancyId, {
        status: 'checked_out',
        checkOutActual: new Date().toISOString(),
        updatedAt: Date.now()
      }).catch(e => console.warn('Firebase checkout update:', e));

      // Update room status in Firebase
      if (record.roomId) {
        RoomService.update(record.roomId, { status: 'cleaning' }).catch(() => {});
      }

      // Also sync to API (server-side backup, non-blocking)
      fetch(`/api/room-occupancy/${record.occupancyId}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) }
      }).catch(e => console.warn('API checkout sync:', e));

      showModal('success', 'Checked Out', `${record.guestName} has been checked out successfully.`);
      if (fetchAll) await fetchAll();
    } catch (err) {
      showModal('error', 'Check-out Failed', err.message);
    }
  };

  // ── Delete history record ──────────────────────────────────────────────────
  const handleDelete = async (record) => {
    const name = record.guestName || `Room #${record.roomId}`;
    const confirmed = await showConfirm(
      'Delete Room History',
      `Are you sure you want to delete room history record for "${name}"?`,
      'Delete',
      'danger'
    );
    if (!confirmed) return;

    if (record.source === 'occupancy' && record.occupancyId) {
      if (setOccupancy) {
        setOccupancy(prev => (prev || []).filter(o => String(o.id) !== String(record.occupancyId)));
      }
      try {
        // Delete from Firebase (shared cloud) first
        await OccupancyService.delete(record.occupancyId).catch(() => {});
        // Also sync to API (server-side backup)
        await fetch(`/api/room-occupancy/${record.occupancyId}`, {
          method: 'DELETE',
          headers: { ...(auth?.headers || {}) }
        });
        showModal('success', 'Record Deleted', `Room history for ${name} deleted.`);
      } catch (err) {
        console.error('Delete occupancy error:', err);
      }
    } else if (record.source === 'booking') {
      if (setBookings) {
        setBookings(prev => (prev || []).filter(b => String(b.id) !== String(record.rawId)));
      }
      try {
        await BookingService.delete(record.rawId).catch(() => {});
        const urlId = record.bookingRef || record.rawId;
        await fetch(`/api/bookings/${urlId}`, {
          method: 'DELETE',
          headers: { ...(auth?.headers || {}) }
        });
        showModal('success', 'Record Deleted', `Booking record for ${name} deleted.`);
      } catch (err) {
        console.error('Delete booking error:', err);
      }
    }

    if (fetchAll) fetchAll();
  };

  // ── Start edit ─────────────────────────────────────────────────────────────
  const handleStartEdit = (record) => {
    setEditingRecord({
      ...record,
      guestName: record.guestName || '',
      guestPhone: record.guestPhone || '',
      guestNationality: record.guestNationality || '',
      roomId: record.roomId || '',
      bedCount: record.bedCount || 1,
      checkInDate: record.checkInDate || '',
      checkOutDate: record.checkOutDate || '',
      totalPrice: parseFloat(record.totalPrice || 25),
      status: record.status || 'checked_in',
      notes: record.notes || ''
    });
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSaving(true);
    try {
      const selectedR = rooms.find(r => String(r.id) === String(editingRecord.roomId));
      const roomName = selectedR ? selectedR.name : editingRecord.roomName;

      if (editingRecord.source === 'occupancy' && editingRecord.occupancyId) {
        const updated = {
          roomId: editingRecord.roomId,
          roomName,
          guestName: editingRecord.guestName,
          guestPhone: editingRecord.guestPhone,
          guestNationality: editingRecord.guestNationality,
          bedCount: Number(editingRecord.bedCount || 1),
          checkInDate: editingRecord.checkInDate,
          checkOutDate: editingRecord.checkOutDate,
          totalPrice: Number(editingRecord.totalPrice || 0),
          status: editingRecord.status,
          notes: editingRecord.notes
        };

        if (setOccupancy) {
          setOccupancy(prev => (prev || []).map(o => String(o.id) === String(editingRecord.occupancyId) ? { ...o, ...updated } : o));
        }

        // Write to Firebase (shared cloud) first
        await OccupancyService.update(editingRecord.occupancyId, { ...updated, updatedAt: Date.now() }).catch(() => {});
        // Also sync to API (server-side backup)
        await fetch(`/api/room-occupancy/${editingRecord.occupancyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
          body: JSON.stringify(updated)
        });
      } else if (editingRecord.source === 'booking') {
        const updatedBooking = {
          customerName: editingRecord.guestName,
          phone: editingRecord.guestPhone,
          nationality: editingRecord.guestNationality,
          roomId: editingRecord.roomId,
          roomName,
          itemName: `Room ${roomName}`,
          bedCount: Number(editingRecord.bedCount || 1),
          startDate: editingRecord.checkInDate,
          endDate: editingRecord.checkOutDate,
          totalFee: Number(editingRecord.totalPrice || 0),
          totalPrice: Number(editingRecord.totalPrice || 0),
          status: editingRecord.status,
          specialRequests: editingRecord.notes
        };

        if (setBookings) {
          setBookings(prev => (prev || []).map(b => String(b.id) === String(editingRecord.rawId) ? { ...b, ...updatedBooking } : b));
        }

        await BookingService.update(editingRecord.rawId, updatedBooking).catch(() => {});
        const urlId = editingRecord.bookingRef || editingRecord.rawId;
        await fetch(`/api/bookings/${urlId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
          body: JSON.stringify(updatedBooking)
        }).catch(() => {});
      }

      setEditingRecord(null);
      showModal('success', 'History Updated', `Room history for ${editingRecord.guestName} updated successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Error saving room history edit:', err);
      showModal('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Records</p>
            <p className="text-2xl font-black text-stone-900">{allHistory.length}</p>
          </div>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3 border-emerald-200 bg-emerald-50/40`}>
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-user-check"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Currently Checked In</p>
            <p className="text-2xl font-black text-emerald-900">{activeCount}</p>
          </div>
        </div>
        <div className={`${cardCls} p-4 flex items-center gap-3 border-stone-200 bg-stone-50/60`}>
          <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center text-lg font-black shrink-0">
            <i className="fa-solid fa-door-open"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Checked Out</p>
            <p className="text-2xl font-black text-stone-700">{checkedOutCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search guest, room, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputCls} w-full sm:w-56 text-xs py-2`}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className={`${inputCls} w-auto text-xs py-2`}
            title="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className={`${inputCls} w-auto text-xs py-2`}
            title="To"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`${inputCls} w-auto text-xs py-2`}
          >
            <option value="">All Statuses (ស្ថានភាពទាំងអស់)</option>
            <option value="checked_in">Checked In (កំពុងស្នាក់)</option>
            <option value="checked_out">Checked Out (បានចាកចេញ)</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className={`${inputCls} w-auto text-xs py-2 font-bold`}
            title="តម្រៀប (Sort)"
          >
            <option value="date-desc">ថ្ងៃ Check-in: ថ្មីមុន (Newest)</option>
            <option value="date-asc">ថ្ងៃ Check-in: ចាស់មុន (Oldest)</option>
            <option value="name-asc">ឈ្មោះភ្ញៀវ: A ដល់ Z (Name: A - Z)</option>
            <option value="name-desc">ឈ្មោះភ្ញៀវ: Z ដល់ A (Name: Z - A)</option>
            <option value="room-asc">បន្ទប់: A ដល់ Z (Room: A - Z)</option>
            <option value="price-desc">តម្លៃសរុប: ខ្ពស់ទៅទាប (Price: High)</option>
            <option value="price-asc">តម្លៃសរុប: ទាបទៅខ្ពស់ (Price: Low)</option>
          </select>
        </div>

        <button onClick={() => window.print()} className={`${btnSecondary} text-xs py-2 flex items-center gap-1.5`}>
          <i className="fa-solid fa-print"></i> Print
        </button>
      </div>

      {/* Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200 select-none">
                <th
                  onClick={() => setSortBy(prev => prev === 'room-asc' ? 'name-asc' : 'room-asc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by room"
                >
                  <div className="flex items-center gap-1">
                    <span>Room</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy === 'room-asc' ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th
                  onClick={() => setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by guest name"
                >
                  <div className="flex items-center gap-1">
                    <span>Guest</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Beds</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by date"
                >
                  <div className="flex items-center gap-1">
                    <span>Check-In</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Check-Out</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'price-desc' ? 'price-asc' : 'price-desc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by price"
                >
                  <div className="flex items-center gap-1">
                    <span>Total Fee</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('price') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-door-open text-brand-500"></i>
                      <span>{o.roomName}</span>
                    </div>
                    {o.source === 'booking' && (
                      <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 mt-0.5">
                        <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                        <span>From booking</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-bold text-stone-800">
                    <div>{o.guestName}</div>
                    <div className="text-[11px] text-stone-400 font-normal">{o.guestPhone || o.guestNationality || ''}</div>
                  </td>
                  <td className="p-4">{o.bedCount || 1} Bed{o.bedCount > 1 ? 's' : ''}</td>
                  <td className="p-4 text-stone-600">{o.checkInDate || '—'}</td>
                  <td className="p-4 text-stone-600">{o.checkOutDate || 'Open'}</td>
                  <td className="p-4 font-bold text-brand-600">
                    {o.totalPrice ? `$${parseFloat(o.totalPrice).toFixed(2)}` : '—'}
                  </td>
                  <td className="p-4">
                    {o.status === 'checked_in' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Checked In</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                        <i className="fa-solid fa-check text-[9px] text-stone-400"></i>
                        <span>Checked Out</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {o.status === 'checked_in' && o.occupancyId && (
                        <button
                          type="button"
                          onClick={() => handleCheckOut(o)}
                          className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Check Out Guest"
                        >
                          <i className="fa-solid fa-right-from-bracket text-[10px]"></i> Out
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrintRecord(o)}
                        className="px-2 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Print Official Folio / Receipt (A4 or POS)"
                      >
                        <i className="fa-solid fa-print text-[10px]"></i> Print
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(o)}
                        className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Record"
                      >
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(o)}
                        className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <i className="fa-solid fa-clock-rotate-left text-4xl text-stone-200 mb-3 block"></i>
                    <p className="text-stone-400 font-medium">No room history records found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={filtered.length}
        />
      </div>

      {/* EDIT ROOM HISTORY MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Room History #{editingRecord.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Guest Name</label>
                  <input
                    type="text"
                    value={editingRecord.guestName}
                    onChange={e => setEditingRecord({ ...editingRecord, guestName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={editingRecord.guestPhone}
                    onChange={e => setEditingRecord({ ...editingRecord, guestPhone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Room</label>
                  <select
                    value={editingRecord.roomId}
                    onChange={e => setEditingRecord({ ...editingRecord, roomId: e.target.value })}
                    className={inputCls}
                    required
                  >
                    <option value="">Select Room</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.categoryName || r.type || 'Room'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Bed Count</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={editingRecord.bedCount}
                    onChange={e => setEditingRecord({ ...editingRecord, bedCount: parseInt(e.target.value) || 1 })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Check-In Date</label>
                  <input
                    type="date"
                    value={editingRecord.checkInDate}
                    onChange={e => setEditingRecord({ ...editingRecord, checkInDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Check-Out Date</label>
                  <input
                    type="date"
                    value={editingRecord.checkOutDate}
                    onChange={e => setEditingRecord({ ...editingRecord, checkOutDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Total Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRecord.totalPrice}
                    onChange={e => setEditingRecord({ ...editingRecord, totalPrice: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={editingRecord.status}
                    onChange={e => setEditingRecord({ ...editingRecord, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="checked_in">Checked In (កំពុងស្នាក់)</option>
                    <option value="checked_out">Checked Out (បានចាកចេញ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  rows="2"
                  value={editingRecord.notes}
                  onChange={e => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  className={inputCls}
                  placeholder="Special requests, notes..."
                ></textarea>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={isSaving} className={`${btnPrimary} flex-1 justify-center cursor-pointer`}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingRecord(null)} className={`${btnSecondary} cursor-pointer`}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (A4 & POS) */}
      {printRecord && (
        <RoomInvoiceModal
          isOpen={!!printRecord}
          onClose={() => setPrintRecord(null)}
          occupancy={printRecord}
          relatedOccupancies={[]}
          rooms={rooms}
          settings={settings}
          currency={typeof currency === 'function' ? currency : (v) => `$${Number(v || 0).toFixed(2)}`}
        />
      )}
    </div>
  );
}
