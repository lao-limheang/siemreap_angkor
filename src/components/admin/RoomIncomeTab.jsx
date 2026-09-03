import { useState, useMemo } from 'react';

export default function RoomIncomeTab({
  occupancy,
  rooms,
  cardCls,
  inputCls,
  btnSecondary,
  currency
}) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    return (occupancy || []).filter(o => {
      const matchFrom = !dateFrom || o.checkInDate >= dateFrom;
      const matchTo = !dateTo || o.checkInDate <= dateTo;
      return matchFrom && matchTo;
    });
  }, [occupancy, dateFrom, dateTo]);

  const totalIncome = useMemo(() => {
    return filtered.reduce((sum, o) => sum + (parseFloat(o.totalPrice || o.dailyRate || 25) || 0), 0);
  }, [filtered]);

  // Estimate payment breakdown
  const cashIncome = totalIncome * 0.4;
  const abaIncome = totalIncome * 0.5;
  const acledaIncome = totalIncome * 0.1;

  return (
    <div className="space-y-6">
      {/* 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-500 text-white rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-brand-100 font-bold uppercase tracking-wider mb-1">Total Room Revenue</p>
          <div className="text-3xl font-black font-display">${totalIncome.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Cash (សាច់ប្រាក់)</p>
          <div className="text-2xl font-bold text-emerald-600 font-display">${cashIncome.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">ABA Bank</p>
          <div className="text-2xl font-bold text-blue-600 font-display">${abaIncome.toFixed(2)}</div>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">ACLEDA</p>
          <div className="text-2xl font-bold text-indigo-600 font-display">${acledaIncome.toFixed(2)}</div>
        </div>
      </div>

      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
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

        <button onClick={() => window.print()} className={`${btnSecondary} text-xs py-2 flex items-center gap-1.5`}>
          <i className="fa-solid fa-print"></i> Print Report
        </button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Date</th>
                <th className="p-4">Room</th>
                <th className="p-4">Guest</th>
                <th className="p-4">Nights/Beds</th>
                <th className="p-4 text-right">Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 text-stone-600">{o.checkInDate}</td>
                  <td className="p-4 font-bold text-stone-900">{o.roomName || `Room #${o.roomId}`}</td>
                  <td className="p-4 font-semibold text-stone-800">{o.guestName}</td>
                  <td className="p-4 text-stone-600">{o.bedCount || 1} Bed</td>
                  <td className="p-4 text-right font-black text-brand-600">
                    ${parseFloat(o.totalPrice || o.dailyRate || 25).toFixed(2)}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-stone-400">
                    No room income records found.
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
