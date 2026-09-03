import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';

export default function HistoryTab({
  rentals,
  auth,
  fetchAll,
  inputCls,
  cardCls,
  btnSecondary,
  btnDanger,
  statusBadge,
  currency
}) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    return rentals.filter(r => {
      const q = search.toLowerCase();
      const matchSearch =
        (r.guestName || '').toLowerCase().includes(q) ||
        (r.bikeName || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q);

      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchFrom = !dateFrom || r.startDate >= dateFrom;
      const matchTo = !dateTo || r.startDate <= dateTo;

      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [rentals, search, dateFrom, dateTo, statusFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const exportCSV = () => {
    const headers = ['ID', 'Customer', 'Phone', 'Bike', 'Plate', 'Date Out', 'Date Return', 'Total Price', 'Deposit', 'Status'];
    const rows = filtered.map(r => [
      r.id,
      `"${r.guestName || ''}"`,
      `"${r.guestPhone || ''}"`,
      `"${r.bikeName || ''}"`,
      `"${r.plateNumber || ''}"`,
      r.startDate,
      r.endDate,
      r.totalPrice || 0,
      r.deposit || 0,
      r.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rentals_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete rental record #${id}?`)) return;
    try {
      const res = await fetch(`/api/rentals/${id}`, { method: 'DELETE', headers: auth.headers });
      if (res.ok) fetchAll();
      else alert('Failed to delete rental record');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 space-y-4`}>
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search customer, bike, plate..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputCls} w-full sm:w-56 text-xs py-2`}
            />
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
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`${inputCls} w-auto text-xs py-2`}
            >
              <option value="">All Statuses</option>
              <option value="active">Active (កំពុងជួល)</option>
              <option value="returned">Returned (បានត្រឡប់)</option>
            </select>
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

      {/* Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Motorbike</th>
                <th className="p-4">Date Out</th>
                <th className="p-4">Date Return</th>
                <th className="p-4">Rental Fee</th>
                <th className="p-4">Deposit</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(r => (
                <tr key={r.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-mono font-bold text-stone-400">#{r.id}</td>
                  <td className="p-4 font-bold text-stone-900">
                    <div>{r.guestName}</div>
                    {r.guestPhone && <div className="text-[11px] text-stone-400 font-normal">{r.guestPhone}</div>}
                  </td>
                  <td className="p-4 font-semibold">
                    <div>{r.bikeName}</div>
                    <div className="text-[11px] font-mono text-stone-500">{r.plateNumber || 'No Plate'}</div>
                  </td>
                  <td className="p-4 text-stone-600">{r.startDate}</td>
                  <td className="p-4 text-stone-600">{r.endDate}</td>
                  <td className="p-4 font-bold text-brand-600">${parseFloat(r.totalPrice || 0).toFixed(2)}</td>
                  <td className="p-4 font-medium text-amber-700">${parseFloat(r.deposit || 0).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete Record"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-stone-400">
                    No rental history records found.
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
    </div>
  );
}
