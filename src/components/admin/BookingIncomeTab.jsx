import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';
import { BookingService } from '../../services/DatabaseService';
import { useModal } from '../common/ModalProvider';

export default function BookingIncomeTab({
  bookings = [],
  setBookings,
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
    return filtered.reduce((sum, b) => sum + (parseFloat(b.totalFee || b.totalPrice || b.deposit || 0) || 0), 0);
  }, [filtered]);

  const handleDelete = async (booking) => {
    const name = booking.customerName || booking.name || `Reservation #${booking.id}`;
    const confirmed = await showConfirm(
      'Delete Reservation',
      `Are you sure you want to delete reservation record for "${name}"?`,
      'Delete',
      'danger'
    );
    if (!confirmed) return;

    if (setBookings) {
      setBookings(prev => (prev || []).filter(b => String(b.id) !== String(booking.id)));
    }

    try {
      await BookingService.delete(booking.id).catch(() => {});
      const urlId = booking.bookingRef || booking.id;
      await fetch(`/api/bookings/${urlId}`, {
        method: 'DELETE',
        headers: { ...(auth?.headers || {}) }
      }).catch(() => {});
      showModal('success', 'Reservation Deleted', `Reservation for ${name} deleted successfully.`);
      if (fetchAll) fetchAll();
    } catch (e) {
      console.error('Delete booking income error:', e);
      if (fetchAll) fetchAll();
    }
  };

  const handleStartEdit = (b) => {
    setEditingBooking({
      ...b,
      customerName: b.customerName || b.name || '',
      phone: b.phone || b.customerPhone || '',
      itemName: b.itemName || b.bikeName || b.roomName || 'Reservation',
      startDate: b.startDate || (b.createdAt || '').split('T')[0] || '',
      endDate: b.endDate || '',
      deposit: parseFloat(b.deposit || 0),
      totalFee: parseFloat(b.totalFee || b.totalPrice || 0),
      status: b.status || 'confirmed'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    setIsSaving(true);
    try {
      const updated = {
        ...editingBooking,
        deposit: Number(editingBooking.deposit || 0),
        totalFee: Number(editingBooking.totalFee || 0),
        totalPrice: Number(editingBooking.totalFee || 0)
      };

      if (setBookings) {
        setBookings(prev => (prev || []).map(b => String(b.id) === String(updated.id) ? updated : b));
      }
      setEditingBooking(null);

      // Clean payload for Firestore
      const firestorePayload = {
        customerName: updated.customerName || '',
        name: updated.customerName || '',
        phone: updated.phone || '',
        customerPhone: updated.phone || '',
        itemName: updated.itemName || '',
        startDate: updated.startDate || '',
        checkoutDate: updated.startDate || '',
        endDate: updated.endDate || '',
        returnDueDate: updated.endDate || '',
        deposit: Number(updated.deposit || 0),
        totalFee: Number(updated.totalFee || 0),
        totalPrice: Number(updated.totalFee || 0),
        status: updated.status || 'confirmed',
        updatedAt: Date.now()
      };
      Object.keys(firestorePayload).forEach(key => {
        if (firestorePayload[key] === undefined) delete firestorePayload[key];
      });

      await BookingService.update(updated.id, firestorePayload).catch(err => {
        console.warn('Firestore update warning:', err);
      });

      const urlId = updated.bookingRef || updated.id;
      await fetch(`/api/bookings/${urlId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(firestorePayload)
      }).catch(() => {});

      showModal('success', 'Reservation Updated', `Reservation for ${updated.customerName} updated successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Error saving booking income edit:', err);
      showModal('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

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
            placeholder="Search guest, model, phone..."
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
                <th className="p-4">Total Value</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Action</th>
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
                  <td className="p-4 font-bold text-stone-900">
                    ${parseFloat(b.totalFee || b.totalPrice || 0).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      b.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {b.status || 'pending'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(b)}
                        className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Reservation Income"
                      >
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Reservation"
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

      {/* EDIT BOOKING INCOME MODAL */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Reservation Income #{editingBooking.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Customer Name</label>
                  <input
                    type="text"
                    value={editingBooking.customerName}
                    onChange={e => setEditingBooking({ ...editingBooking, customerName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={editingBooking.phone}
                    onChange={e => setEditingBooking({ ...editingBooking, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Service / Item Name</label>
                <input
                  type="text"
                  value={editingBooking.itemName}
                  onChange={e => setEditingBooking({ ...editingBooking, itemName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input
                    type="date"
                    value={editingBooking.startDate}
                    onChange={e => setEditingBooking({ ...editingBooking, startDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input
                    type="date"
                    value={editingBooking.endDate}
                    onChange={e => setEditingBooking({ ...editingBooking, endDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Deposit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBooking.deposit}
                    onChange={e => setEditingBooking({ ...editingBooking, deposit: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Total Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBooking.totalFee}
                    onChange={e => setEditingBooking({ ...editingBooking, totalFee: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={editingBooking.status}
                    onChange={e => setEditingBooking({ ...editingBooking, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={isSaving} className={`${btnPrimary} flex-1 justify-center cursor-pointer`}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingBooking(null)} className={`${btnSecondary} cursor-pointer`}>
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
