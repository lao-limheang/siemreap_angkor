import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';
import { RentalService } from '../../services/DatabaseService';
import { useModal } from '../common/ModalProvider';
import RoomInvoiceModal from './RoomInvoiceModal';

export default function HistoryTab({
  rentals = [],
  setRentals,
  bikes = [],
  auth,
  fetchAll,
  inputCls = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm',
  labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5',
  cardCls = 'bg-white border border-stone-200 rounded-2xl shadow-sm',
  btnPrimary = 'px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors shadow-sm',
  btnSecondary = 'px-4 py-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-50 transition-colors',
  btnDanger = 'px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors',
  statusBadge,
  currency = 'USD',
  sendCategoryTelegramAlert,
  tgSending,
  settings = {}
}) {
  const { showModal, showConfirm } = useModal();
  const [localTgSending, setLocalTgSending] = useState(false);

  const handleHistoryTelegramAlert = async () => {
    setLocalTgSending(true);
    try {
      const completed = (rentals || []).filter(r => r.status === 'returned' || r.status === 'completed').length;
      const active = (rentals || []).filter(r => r.status === 'active' || r.status === 'rented').length;
      const totalRev = (rentals || []).reduce((sum, r) => sum + Number(r.totalPrice || r.pricePerDay || 0), 0);

      if (sendCategoryTelegramAlert) {
        await sendCategoryTelegramAlert({
          category: 'Rental History',
          title: 'Motorbike Rental History Report',
          summary: `Total Rentals: ${rentals.length}.\nCompleted: ${completed} | Active: ${active}\nTotal Volume: $${totalRev.toFixed(2)} USD`,
          details: `Rental history audit across all fleet records.`
        });
      } else {
        await fetch('/api/telegram/send-alert', {
          method: 'POST',
          headers: auth?.headers || { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'Rental History',
            title: 'Motorbike Rental History Report',
            summary: `Total Rentals: ${rentals.length}.\nCompleted: ${completed} | Active: ${active}\nTotal Volume: $${totalRev.toFixed(2)} USD`,
            details: `Rental history audit across all fleet records.`
          })
        });
        showModal('success', 'Telegram Alert Sent', 'Motor rental history report sent to Telegram.');
      }
    } catch (err) {
      showModal('error', 'Error', err.message);
    } finally {
      setLocalTgSending(false);
    }
  };
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingRental, setEditingRental] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [printRental, setPrintRental] = useState(null);

  const filtered = useMemo(() => {
    const list = (rentals || []).filter(r => {
      const q = search.toLowerCase();
      const matchSearch =
        (r.guestName || r.customerName || '').toLowerCase().includes(q) ||
        (r.bikeName || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q) ||
        (r.guestPhone || r.phone || '').toLowerCase().includes(q);

      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchFrom = !dateFrom || (r.startDate || r.checkoutDate) >= dateFrom;
      const matchTo = !dateTo || (r.startDate || r.checkoutDate) <= dateTo;

      return matchSearch && matchStatus && matchFrom && matchTo;
    });

    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
        const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
        return db - da;
      }
      if (sortBy === 'date-asc') {
        const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
        const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
        return da - db;
      }
      if (sortBy === 'name-asc') {
        const na = (a.guestName || a.customerName || '').trim();
        const nb = (b.guestName || b.customerName || '').trim();
        return na.localeCompare(nb, 'km');
      }
      if (sortBy === 'name-desc') {
        const na = (a.guestName || a.customerName || '').trim();
        const nb = (b.guestName || b.customerName || '').trim();
        return nb.localeCompare(na, 'km');
      }
      if (sortBy === 'price-desc') {
        return (Number(b.totalPrice || b.totalFee || 0)) - (Number(a.totalPrice || a.totalFee || 0));
      }
      if (sortBy === 'price-asc') {
        return (Number(a.totalPrice || a.totalFee || 0)) - (Number(b.totalPrice || b.totalFee || 0));
      }
      return 0;
    });

    return list;
  }, [rentals, search, dateFrom, dateTo, statusFilter, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const exportCSV = () => {
    const headers = ['ID', 'Customer', 'Phone', 'Bike', 'Plate', 'Date Out', 'Date Return', 'Total Price', 'Deposit', 'Status'];
    const rows = filtered.map(r => [
      r.id,
      `"${r.guestName || r.customerName || ''}"`,
      `"${r.guestPhone || r.phone || ''}"`,
      `"${r.bikeName || ''}"`,
      `"${r.plateNumber || ''}"`,
      r.startDate || r.checkoutDate || '',
      r.endDate || r.returnDueDate || '',
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

  const handleDelete = async (rental) => {
    const name = rental.guestName || rental.customerName || `Rental #${rental.id}`;
    const confirmed = await showConfirm(
      'Delete Rental Record',
      `Are you sure you want to delete rental history record for "${name}"?`,
      'Delete',
      'danger'
    );
    if (!confirmed) return;

    if (setRentals) {
      setRentals(prev => (prev || []).filter(r => String(r.id) !== String(rental.id)));
    }

    try {
      await RentalService.delete(rental.id).catch(() => {});
      await fetch(`/api/rentals/${rental.id}`, {
        method: 'DELETE',
        headers: { ...(auth?.headers || {}) }
      }).catch(() => {});
      showModal('success', 'Record Deleted', `Rental history record #${rental.id} deleted successfully.`);
      if (fetchAll) fetchAll();
    } catch (e) {
      console.error('Delete rental error:', e);
      if (fetchAll) fetchAll();
    }
  };

  const handleStartEdit = (rental) => {
    setEditingRental({
      ...rental,
      guestName: rental.guestName || rental.customerName || '',
      guestPhone: rental.guestPhone || rental.phone || '',
      bikeId: rental.bikeId || rental.motoId || '',
      startDate: rental.startDate || rental.checkoutDate || '',
      endDate: rental.endDate || rental.returnDueDate || '',
      totalPrice: parseFloat(rental.totalPrice || 0),
      deposit: parseFloat(rental.deposit || 0),
      lateFee: parseFloat(rental.lateFee || 0),
      damageFee: parseFloat(rental.damageFee || 0),
      status: rental.status || 'active'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRental) return;
    setIsSaving(true);
    try {
      const selectedB = bikes.find(b => String(b.id) === String(editingRental.bikeId));
      const updated = {
        ...editingRental,
        bikeName: selectedB ? selectedB.name : editingRental.bikeName || 'Motorbike',
        plateNumber: selectedB?.plateNumber || editingRental.plateNumber || '',
        totalPrice: Number(editingRental.totalPrice || 0),
        deposit: Number(editingRental.deposit || 0),
        lateFee: Number(editingRental.lateFee || 0),
        damageFee: Number(editingRental.damageFee || 0)
      };

      if (setRentals) {
        setRentals(prev => (prev || []).map(r => String(r.id) === String(updated.id) ? updated : r));
      }
      setEditingRental(null);

      // Clean payload for Firestore
      const firestorePayload = {
        customerName: updated.guestName || '',
        guestName: updated.guestName || '',
        guestPhone: updated.guestPhone || '',
        phone: updated.guestPhone || '',
        motoId: updated.bikeId || '',
        bikeId: updated.bikeId || '',
        bikeName: updated.bikeName || '',
        plateNumber: updated.plateNumber || '',
        checkoutDate: updated.startDate || '',
        startDate: updated.startDate || '',
        returnDueDate: updated.endDate || '',
        endDate: updated.endDate || '',
        totalPrice: Number(updated.totalPrice || 0),
        totalFee: Number(updated.totalPrice || 0),
        deposit: Number(updated.deposit || 0),
        lateFee: Number(updated.lateFee || 0),
        damageFee: Number(updated.damageFee || 0),
        status: updated.status || 'active',
        updatedAt: Date.now()
      };
      Object.keys(firestorePayload).forEach(key => {
        if (firestorePayload[key] === undefined) delete firestorePayload[key];
      });

      await RentalService.update(updated.id, firestorePayload).catch(err => {
        console.warn('Firestore update warning:', err);
      });

      await fetch(`/api/rentals/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(firestorePayload)
      }).catch(() => {});

      showModal('success', 'Record Updated', `Rental record for ${updated.guestName} updated successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Error updating rental record:', err);
      showModal('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
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
              placeholder="Search customer, bike, plate, phone..."
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
              <option value="">All Statuses (ស្ថានភាពទាំងអស់)</option>
              <option value="active">Active (កំពុងជួល)</option>
              <option value="returned">Returned (បានត្រឡប់)</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className={`${inputCls} w-auto text-xs py-2 font-semibold`}
              title="តម្រៀប (Sort)"
            >
              <option value="date-desc">កាលបរិច្ឆេទ: ថ្មីមុន (Date: Newest)</option>
              <option value="date-asc">កាលបរិច្ឆេទ: ចាស់មុន (Date: Oldest)</option>
              <option value="name-asc">ឈ្មោះ: A ដល់ Z (Name: A - Z)</option>
              <option value="name-desc">ឈ្មោះ: Z ដល់ A (Name: Z - A)</option>
              <option value="price-desc">តម្លៃ: ខ្ពស់ទៅទាប (Price: High)</option>
              <option value="price-asc">តម្លៃ: ទាបទៅខ្ពស់ (Price: Low)</option>
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
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200 select-none">
                <th className="p-4">ID</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by customer name"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Motorbike</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by date out"
                >
                  <div className="flex items-center gap-1">
                    <span>Date Out</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Date Return</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'price-desc' ? 'price-asc' : 'price-desc')}
                  className="p-4 cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by fee"
                >
                  <div className="flex items-center gap-1">
                    <span>Rental Fee</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('price') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Deposit</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(r => (
                <tr key={r.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-mono font-bold text-stone-400">#{r.id}</td>
                  <td className="p-4 font-bold text-stone-900">
                    <div>{r.guestName || r.customerName || 'Customer'}</div>
                    {(r.guestPhone || r.phone) && <div className="text-[11px] text-stone-400 font-normal">{r.guestPhone || r.phone}</div>}
                  </td>
                  <td className="p-4 font-semibold">
                    <div>{r.bikeName || 'Motor'}</div>
                    <div className="text-[11px] font-mono text-stone-500">{r.plateNumber || 'No Plate'}</div>
                  </td>
                  <td className="p-4 text-stone-600">{r.startDate || r.checkoutDate || '—'}</td>
                  <td className="p-4 text-stone-600">{r.endDate || r.returnDueDate || '—'}</td>
                  <td className="p-4 font-bold text-brand-600">${parseFloat(r.totalPrice || 0).toFixed(2)}</td>
                  <td className="p-4 font-medium text-amber-700">${parseFloat(r.deposit || 0).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {r.status || 'returned'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintRental({
                            id: r.id,
                            guestName: r.guestName || r.customerName || 'Customer',
                            guestPhone: r.guestPhone || r.phone || 'N/A',
                            checkInDate: r.startDate || r.checkoutDate || '2026-09-20',
                            checkOutDate: r.endDate || r.returnDueDate || '2026-09-20',
                            totalAmount: Number(r.totalPrice || 0),
                            paymentMethod: r.paymentMethod || 'cash',
                            paymentStatus: r.status === 'active' ? 'unpaid' : 'paid',
                            invoiceNumber: `INV-MOTO-${r.id}-${(r.startDate || '20260920').replace(/-/g, '')}`,
                            customItems: [
                              {
                                description: `Motor Rental: ${r.bikeName || 'Motorbike'} (${r.plateNumber || 'Fleet'})`,
                                subtitle: `Rental period ${r.startDate || ''} to ${r.endDate || ''}`,
                                qty: 1,
                                rate: Number(r.totalPrice || 0),
                                total: Number(r.totalPrice || 0)
                              }
                            ]
                          });
                        }}
                        className="px-2 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Print Rental Invoice / Folio (A4 or POS)"
                      >
                        <i className="fa-solid fa-print text-[10px]"></i> Print
                      </button>
                      <button
                        onClick={() => handleStartEdit(r)}
                        className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Rental Record"
                      >
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Rental Record"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
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

      {/* EDIT RENTAL MODAL */}
      {editingRental && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Rental Record #{editingRental.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRental(null)}
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
                    value={editingRental.guestName}
                    onChange={e => setEditingRental({ ...editingRental, guestName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={editingRental.guestPhone}
                    onChange={e => setEditingRental({ ...editingRental, guestPhone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Motorbike</label>
                <select
                  value={editingRental.bikeId}
                  onChange={e => setEditingRental({ ...editingRental, bikeId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select Motorbike</option>
                  {bikes.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.plateNumber || 'No Plate'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date Out (Start)</label>
                  <input
                    type="date"
                    value={editingRental.startDate}
                    onChange={e => setEditingRental({ ...editingRental, startDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Date Return (End)</label>
                  <input
                    type="date"
                    value={editingRental.endDate}
                    onChange={e => setEditingRental({ ...editingRental, endDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Rental Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRental.totalPrice}
                    onChange={e => setEditingRental({ ...editingRental, totalPrice: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Deposit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRental.deposit}
                    onChange={e => setEditingRental({ ...editingRental, deposit: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Late Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRental.lateFee}
                    onChange={e => setEditingRental({ ...editingRental, lateFee: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Damage Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRental.damageFee}
                    onChange={e => setEditingRental({ ...editingRental, damageFee: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={editingRental.status}
                  onChange={e => setEditingRental({ ...editingRental, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="active">Active (កំពុងជួល)</option>
                  <option value="returned">Returned (បានត្រឡប់)</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={isSaving} className={`${btnPrimary} flex-1 justify-center cursor-pointer`}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingRental(null)} className={`${btnSecondary} cursor-pointer`}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (A4 & POS) */}
      {printRental && (
        <RoomInvoiceModal
          isOpen={!!printRental}
          onClose={() => setPrintRental(null)}
          occupancy={printRental}
          relatedOccupancies={[]}
          rooms={[]}
          settings={settings}
          currency={typeof currency === 'function' ? currency : (v) => `$${Number(v || 0).toFixed(2)}`}
        />
      )}
    </div>
  );
}
