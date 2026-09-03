import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';

export default function IncomeTab({
  rentals,
  bikes,
  cardCls,
  inputCls,
  btnSecondary,
  currency
}) {
  const [selectedBike, setSelectedBike] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    return (rentals || []).filter(r => {
      const matchBike = !selectedBike || String(r.bikeId || r.motoId) === String(selectedBike);
      const matchFrom = !dateFrom || (r.startDate || r.checkoutDate) >= dateFrom;
      const matchTo = !dateTo || (r.startDate || r.checkoutDate) <= dateTo;
      return matchBike && matchFrom && matchTo;
    });
  }, [rentals, selectedBike, dateFrom, dateTo]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Income metrics
  const grandTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (parseFloat(r.totalPrice) || 0) + (parseFloat(r.lateFee) || 0) + (parseFloat(r.damageFee) || 0), 0);
  }, [filtered]);

  const rentalTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (parseFloat(r.totalPrice) || 0), 0);
  }, [filtered]);

  const lateFeeTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (parseFloat(r.lateFee) || 0), 0);
  }, [filtered]);

  const damageTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (parseFloat(r.damageFee) || 0), 0);
  }, [filtered]);

  const exportCSV = () => {
    const headers = ['ID', 'Date', 'Customer', 'Bike', 'Rental Fee', 'Late Fee', 'Damage Fee', 'Total Income'];
    const rows = filtered.map(r => [
      r.id,
      r.startDate,
      `"${r.guestName || ''}"`,
      `"${r.bikeName || ''}"`,
      r.totalPrice || 0,
      r.lateFee || 0,
      r.damageFee || 0,
      ((parseFloat(r.totalPrice) || 0) + (parseFloat(r.lateFee) || 0) + (parseFloat(r.damageFee) || 0)).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `income_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-500 text-white rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-brand-100 font-bold uppercase tracking-wider mb-1">Grand Total Income</p>
          <div className="text-3xl font-black font-display">${grandTotal.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Rental Fees</p>
          <div className="text-2xl font-bold text-stone-900 font-display">${rentalTotal.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Late Return Fines</p>
          <div className="text-2xl font-bold text-amber-600 font-display">${lateFeeTotal.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Damage / Extras</p>
          <div className="text-2xl font-bold text-rose-600 font-display">${damageTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedBike}
              onChange={e => setSelectedBike(e.target.value)}
              className={`${inputCls} w-auto text-xs py-2`}
            >
              <option value="">All Motorcycles</option>
              {bikes.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.plateNumber || 'No Plate'})</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={`${inputCls} w-auto text-xs py-2`}
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={`${inputCls} w-auto text-xs py-2`}
              title="To date"
            />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className={`${btnSecondary} text-xs py-2 flex items-center gap-1.5`}>
              <i className="fa-solid fa-file-csv text-emerald-600"></i> Export CSV
            </button>
            <button onClick={() => window.print()} className={`${btnSecondary} text-xs py-2 flex items-center gap-1.5`}>
              <i className="fa-solid fa-print"></i> Print
            </button>
          </div>
        </div>
      </div>

      {/* Income Details Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Customer</th>
                <th className="p-4">Motorbike</th>
                <th className="p-4">Date</th>
                <th className="p-4">Rental Fee</th>
                <th className="p-4">Late Fee</th>
                <th className="p-4">Damage</th>
                <th className="p-4 text-right">Total Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(r => {
                const rowTotal = (parseFloat(r.totalPrice) || 0) + (parseFloat(r.lateFee) || 0) + (parseFloat(r.damageFee) || 0);
                return (
                  <tr key={r.id} className="hover:bg-stone-50/80 transition">
                    <td className="p-4 font-bold text-stone-900">{r.guestName || r.customerName || 'Customer'}</td>
                    <td className="p-4 font-semibold">{r.bikeName || 'Motor'}</td>
                    <td className="p-4 text-stone-600">{r.startDate || r.checkoutDate || '—'}</td>
                    <td className="p-4">${parseFloat(r.totalPrice || 0).toFixed(2)}</td>
                    <td className="p-4 text-amber-600">${parseFloat(r.lateFee || 0).toFixed(2)}</td>
                    <td className="p-4 text-rose-600">${parseFloat(r.damageFee || 0).toFixed(2)}</td>
                    <td className="p-4 text-right font-black text-emerald-600">${rowTotal.toFixed(2)}</td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    No income records found for this period.
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
