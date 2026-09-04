import { useState, useMemo } from 'react';

export default function RoomHistoryTab({
  occupancy = [],
  bookings = [],
  rooms = [],
  auth,
  fetchAll,
  cardCls,
  inputCls,
  btnSecondary,
  currency = 'USD'
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Merge occupancy records + checked-in bookings (as fallback) ─────────────
  const allHistory = useMemo(() => {
    // 1. Normalize real occupancy records from room_occupancy table
    const fromOccupancy = (occupancy || []).map(o => ({
      id: `occ-${o.id}`,
      occupancyId: o.id,
      roomName: o.roomName || `Room #${o.roomId}`,
      roomId: o.roomId,
      guestName: o.guestName,
      guestPhone: o.guestPhone,
      guestNationality: o.guestNationality,
      bedCount: o.bedCount || 1,
      checkInDate: o.checkInDate,
      checkOutDate: o.checkOutDate || o.actualCheckOut,
      totalPrice: o.totalPrice || o.dailyRate || null,
      status: o.status || 'checked_in',
      source: 'occupancy',
      notes: o.notes
    }));

    // 2. Pull checked-in bookings that have NO corresponding occupancy record yet
    //    (in case the POST to /api/room-occupancy silently failed before the fix)
    const occupancyGuestNames = new Set(fromOccupancy.map(o => o.guestName?.toLowerCase()));
    const fromBookings = (bookings || [])
      .filter(b =>
        b.status === 'checked_in' &&
        (b.roomId || b.roomName) &&
        !occupancyGuestNames.has((b.customerName || '').toLowerCase())
      )
      .map(b => ({
        id: `bk-${b.id}`,
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
        notes: b.specialRequests
      }));

    return [...fromOccupancy, ...fromBookings];
  }, [occupancy, bookings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allHistory.filter(o => {
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
  }, [allHistory, search, statusFilter, dateFrom, dateTo]);

  // ── Quick KPI stats ─────────────────────────────────────────────────────────
  const activeCount = allHistory.filter(o => o.status === 'checked_in').length;
  const checkedOutCount = allHistory.filter(o => o.status === 'checked_out').length;

  // ── Check-out a real occupancy record ──────────────────────────────────────
  const handleCheckOut = async (record) => {
    if (!record.occupancyId) {
      // No occupancy record yet — can't checkout via API, just inform user
      alert('This record was checked in from a booking but has no occupancy record. Use the Rooms > Check-in tab to manage check-out.');
      return;
    }
    if (!window.confirm(`Check out ${record.guestName} from ${record.roomName}?`)) return;
    try {
      const res = await fetch(`/api/room-occupancy/${record.occupancyId}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) }
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      if (fetchAll) await fetchAll();
    } catch (err) {
      alert('Check-out failed: ' + err.message);
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
            placeholder="Search guest or room..."
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
            <option value="">All Statuses</option>
            <option value="checked_in">Checked In (កំពុងស្នាក់)</option>
            <option value="checked_out">Checked Out (បានចាកចេញ)</option>
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
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Room</th>
                <th className="p-4">Guest</th>
                <th className="p-4">Beds</th>
                <th className="p-4">Check-In</th>
                <th className="p-4">Check-Out</th>
                <th className="p-4">Total Fee</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-door-open text-brand-500"></i>
                      <span>{o.roomName}</span>
                    </div>
                    {o.source === 'booking' && (
                      <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                        ⚠ From booking — no occupancy record
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      o.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {o.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                    </span>
                  </td>
                  <td className="p-4">
                    {o.status === 'checked_in' && (
                      <button
                        type="button"
                        onClick={() => handleCheckOut(o)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Check Out Guest"
                      >
                        <i className="fa-solid fa-right-from-bracket text-[10px]"></i> Check Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center">
                    <i className="fa-solid fa-clock-rotate-left text-4xl text-stone-200 mb-3 block"></i>
                    <p className="text-stone-400 font-medium">No room history records found.</p>
                    <p className="text-stone-300 text-[11px] mt-1">
                      Records appear here after guests are checked in from the Room Bookings or Check-in &amp; Occupancy tab.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
