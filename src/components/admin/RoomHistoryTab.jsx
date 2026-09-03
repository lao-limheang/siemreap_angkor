import { useState, useMemo } from 'react';

export default function RoomHistoryTab({
  occupancy,
  rooms,
  cardCls,
  inputCls,
  btnSecondary,
  currency
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    return (occupancy || []).filter(o => {
      const q = search.toLowerCase();
      const matchSearch =
        (o.guestName || '').toLowerCase().includes(q) ||
        (o.roomName || '').toLowerCase().includes(q) ||
        (o.guestPhone || '').toLowerCase().includes(q);

      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchFrom = !dateFrom || o.checkInDate >= dateFrom;
      const matchTo = !dateTo || o.checkInDate <= dateTo;

      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [occupancy, search, statusFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-door-open text-brand-500"></i>
                      <span>{o.roomName || `Room #${o.roomId}`}</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-stone-800">
                    <div>{o.guestName}</div>
                    <div className="text-[11px] text-stone-400 font-normal">{o.guestPhone || o.guestNationality || ''}</div>
                  </td>
                  <td className="p-4">{o.bedCount || 1} Bed</td>
                  <td className="p-4 text-stone-600">{o.checkInDate}</td>
                  <td className="p-4 text-stone-600">{o.checkOutDate || 'Open'}</td>
                  <td className="p-4 font-bold text-brand-600">${parseFloat(o.totalPrice || o.dailyRate || 25).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      o.status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {o.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                    </span>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    No room history records found.
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
