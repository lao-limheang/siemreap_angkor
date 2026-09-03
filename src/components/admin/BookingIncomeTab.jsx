import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';

export default function BookingIncomeTab({
  bookings,
  cardCls,
  inputCls,
  btnSecondary,
  currency
}) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    return (bookings || []).filter(b => {
      const q = (search || '').toLowerCase();
      const matchSearch =
        (b.customerName || b.name || '').toLowerCase().includes(q) ||
        (b.itemName || b.bikeName || b.roomName || '').toLowerCase().includes(q) ||
        (b.customerPhone || b.phone || '').toLowerCase().includes(q);

      const d = b.startDate || (b.createdAt || '').split('T')[0];
      const matchFrom = !dateFrom || d >= dateFrom;
      const matchTo = !dateTo || d <= dateTo;

      return matchSearch && matchFrom && matchTo;
    });
  }, [bookings, search, dateFrom, dateTo]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalDeposit = useMemo(() => {
    return filtered.reduce((sum, b) => sum + (parseFloat(b.deposit) || 0), 0);
  }, [filtered]);

  const totalBookingsValue = useMemo(() => {
    return filtered.reduce((sum, b) => sum + (parseFloat(b.totalPrice || b.deposit || 0) || 0), 0);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-brand-500 text-white rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-brand-100 font-bold uppercase tracking-wider mb-1">Total Deposits Collected</p>
          <div className="text-3xl font-black font-display">${totalDeposit.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Total Bookings Value</p>
          <div className="text-2xl font-bold text-stone-900 font-display">${totalBookingsValue.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Total Reservations</p>
          <div className="text-2xl font-bold text-stone-800 font-display">{filtered.length}</div>
        </div>
      </div>

      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search guest or model..."
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
                <th className="p-4">Customer</th>
                <th className="p-4">Service / Model</th>
                <th className="p-4">Booking Date</th>
                <th className="p-4">Deposit (ប្រាក់កក់)</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(b => (
                <tr key={b.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div>{b.customerName || b.name || 'Guest'}</div>
                    <div className="text-[11px] text-stone-400 font-normal">{b.customerPhone || b.phone || ''}</div>
                  </td>
                  <td className="p-4 font-semibold text-stone-800">{b.itemName || b.bikeName || b.roomName || 'Booking'}</td>
                  <td className="p-4 text-stone-600">{b.startDate || (b.createdAt || '').split('T')[0]}</td>
                  <td className="p-4 font-black text-amber-600 text-sm">
                    ${parseFloat(b.deposit || 0).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-full font-bold text-[10px] uppercase">
                      {b.status || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-stone-400">
                    No booking income records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          totalItems={filtered.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
