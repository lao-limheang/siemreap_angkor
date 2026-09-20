import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';
import { useModal } from '../common/ModalProvider';
import { OccupancyService } from '../../services/DatabaseService';

export default function RoomIncomeTab({
  occupancy = [],
  setOccupancy,
  rooms = [],
  auth,
  fetchAll,
  cardCls = 'bg-white border border-stone-200 rounded-2xl shadow-sm',
  inputCls = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm',
  labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5',
  btnPrimary = 'px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors shadow-sm',
  btnSecondary = 'px-4 py-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-50 transition-colors',
  btnDanger = 'px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors',
  currency = 'USD'
}) {
  const { showModal, showConfirm } = useModal();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    const list = (occupancy || []).filter(o => {
      const matchSearch =
        !q ||
        (o.guestName || '').toLowerCase().includes(q) ||
        (o.roomName || '').toLowerCase().includes(q) ||
        (o.guestPhone || '').toLowerCase().includes(q);

      const matchFrom = !dateFrom || (o.checkInDate || '') >= dateFrom;
      const matchTo = !dateTo || (o.checkInDate || '') <= dateTo;
      return matchSearch && matchFrom && matchTo;
    });

    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        const da = new Date(a.checkInDate || a.createdAt || 0).getTime();
        const db = new Date(b.checkInDate || b.createdAt || 0).getTime();
        return db - da;
      }
      if (sortBy === 'date-asc') {
        const da = new Date(a.checkInDate || a.createdAt || 0).getTime();
        const db = new Date(b.checkInDate || b.createdAt || 0).getTime();
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
      if (sortBy === 'amount-desc') {
        return (parseFloat(b.totalPrice || b.dailyRate || 0)) - (parseFloat(a.totalPrice || a.dailyRate || 0));
      }
      if (sortBy === 'amount-asc') {
        return (parseFloat(a.totalPrice || a.dailyRate || 0)) - (parseFloat(b.totalPrice || b.dailyRate || 0));
      }
      return 0;
    });

    return list;
  }, [occupancy, search, dateFrom, dateTo, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalIncome = useMemo(() => {
    return filtered.reduce((sum, o) => sum + (parseFloat(o.totalPrice || o.dailyRate || 25) || 0), 0);
  }, [filtered]);

  // Payment breakdown
  const cashIncome = useMemo(() => {
    return filtered
      .filter(o => !o.paymentMethod || o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (parseFloat(o.totalPrice || o.dailyRate || 25) || 0), 0);
  }, [filtered]);

  const abaIncome = useMemo(() => {
    return filtered
      .filter(o => o.paymentMethod === 'aba')
      .reduce((sum, o) => sum + (parseFloat(o.totalPrice || o.dailyRate || 25) || 0), 0);
  }, [filtered]);

  const otherIncome = useMemo(() => {
    return filtered
      .filter(o => o.paymentMethod && o.paymentMethod !== 'cash' && o.paymentMethod !== 'aba')
      .reduce((sum, o) => sum + (parseFloat(o.totalPrice || o.dailyRate || 25) || 0), 0);
  }, [filtered]);

  const handleDelete = async (record) => {
    const name = record.guestName || `Room #${record.roomId || ''}`;
    const confirmed = await showConfirm(
      'Delete Room Income Record',
      `Are you sure you want to delete room income record for "${name}"?`,
      'Delete',
      'danger'
    );
    if (!confirmed) return;

    if (setOccupancy) {
      setOccupancy(prev => (prev || []).filter(o => String(o.id) !== String(record.id)));
    }

    try {
      // Delete from Firebase (shared cloud) first
      await OccupancyService.delete(record.id).catch(() => {});
      // Also sync to API (server-side backup)
      await fetch(`/api/room-occupancy/${record.id}`, {
        method: 'DELETE',
        headers: { ...(auth?.headers || {}) }
      });
      showModal('success', 'Record Deleted', `Room income record for ${name} deleted successfully.`);
      if (fetchAll) fetchAll();
    } catch (e) {
      console.error('Delete room income error:', e);
      if (fetchAll) fetchAll();
    }
  };

  const handleStartEdit = (record) => {
    setEditingRecord({
      ...record,
      guestName: record.guestName || '',
      guestPhone: record.guestPhone || '',
      roomId: record.roomId || '',
      bedCount: record.bedCount || 1,
      checkInDate: record.checkInDate || '',
      checkOutDate: record.checkOutDate || '',
      totalPrice: parseFloat(record.totalPrice || record.dailyRate || 25),
      paymentMethod: record.paymentMethod || 'cash',
      status: record.status || 'checked_in'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSaving(true);
    try {
      const selectedR = rooms.find(r => String(r.id) === String(editingRecord.roomId));
      const updated = {
        ...editingRecord,
        roomName: selectedR ? selectedR.name : editingRecord.roomName,
        totalPrice: Number(editingRecord.totalPrice || 0),
        bedCount: Number(editingRecord.bedCount || 1)
      };

      if (setOccupancy) {
        setOccupancy(prev => (prev || []).map(o => String(o.id) === String(updated.id) ? updated : o));
      }
      setEditingRecord(null);

      // Write to Firebase (shared cloud) first
      await OccupancyService.update(updated.id, { ...updated, updatedAt: Date.now() }).catch(() => {});
      // Also sync to API (server-side backup)
      await fetch(`/api/room-occupancy/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(updated)
      });

      showModal('success', 'Record Updated', `Room income record for ${updated.guestName} updated successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Error saving room income edit:', err);
      showModal('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

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
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">Other / ACLEDA</p>
          <div className="text-2xl font-bold text-indigo-600 font-display">${otherIncome.toFixed(2)}</div>
        </div>
      </div>

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
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className={`${inputCls} w-auto text-xs py-2 font-bold`}
            title="តម្រៀប (Sort)"
          >
            <option value="date-desc">កាលបរិច្ឆេទ: ថ្មីមុន (Newest)</option>
            <option value="date-asc">កាលបរិច្ឆេទ: ចាស់មុន (Oldest)</option>
            <option value="name-asc">ឈ្មោះភ្ញៀវ: A ដល់ Z (Name: A - Z)</option>
            <option value="name-desc">ឈ្មោះភ្ញៀវ: Z ដល់ A (Name: Z - A)</option>
            <option value="room-asc">បន្ទប់: A ដល់ Z (Room: A - Z)</option>
            <option value="amount-desc">ចំណូល: ខ្ពស់ទៅទាប</option>
            <option value="amount-asc">ចំណូល: ទាបទៅខ្ពស់</option>
          </select>
        </div>

        <button onClick={() => window.print()} className={`${btnSecondary} text-xs py-2 flex items-center gap-1.5`}>
          <i className="fa-solid fa-print"></i> Print Report
        </button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200 select-none">
                <th
                  onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by date"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
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
                <th className="p-4">Nights/Beds</th>
                <th className="p-4">Payment</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'amount-desc' ? 'amount-asc' : 'amount-desc')}
                  className="p-4 text-right cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by income"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Income</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('amount') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 text-stone-600">{o.checkInDate || '—'}</td>
                  <td className="p-4 font-bold text-stone-900">{o.roomName || `Room #${o.roomId}`}</td>
                  <td className="p-4 font-semibold text-stone-800">
                    <div>{o.guestName}</div>
                    {o.guestPhone && <div className="text-[11px] text-stone-400 font-normal">{o.guestPhone}</div>}
                  </td>
                  <td className="p-4 text-stone-600">{o.bedCount || 1} Bed{o.bedCount > 1 ? 's' : ''}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      o.paymentMethod === 'aba' ? 'bg-blue-100 text-blue-700' :
                      o.paymentMethod === 'card' ? 'bg-purple-100 text-purple-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {o.paymentMethod || 'cash'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-brand-600">
                    ${parseFloat(o.totalPrice || o.dailyRate || 25).toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(o)}
                        className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Room Income"
                      >
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(o)}
                        className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Room Income Record"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    No room income records found.
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

      {/* EDIT ROOM INCOME MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Room Income Record #{editingRecord.id}
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
                  <label className={labelCls}>Total Revenue ($)</label>
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
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={editingRecord.paymentMethod}
                    onChange={e => setEditingRecord({ ...editingRecord, paymentMethod: e.target.value })}
                    className={inputCls}
                  >
                    <option value="cash">Cash (សាច់ប្រាក់)</option>
                    <option value="aba">ABA Bank (KHQR)</option>
                    <option value="acleda">ACLEDA Bank</option>
                    <option value="card">Credit/Debit Card</option>
                  </select>
                </div>
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
    </div>
  );
}
