import { useState, useMemo } from 'react';
import PaginationControls from '../common/PaginationControls';
import { RentalService } from '../../services/DatabaseService';
import { useModal } from '../common/ModalProvider';

export default function IncomeTab({
  rentals = [],
  setRentals,
  bikes = [],
  staff = [],
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
  const [search, setSearch] = useState('');
  const [selectedBike, setSelectedBike] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingRental, setEditingRental] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Extract unique staff names from rentals for filter dropdown
  const staffOptions = useMemo(() => {
    const set = new Set();
    (rentals || []).forEach(r => {
      const name = r.staffName || r.resellStaff || r.sellerName;
      if (name && name.trim()) set.add(name.trim());
    });
    (staff || []).forEach(s => {
      const name = s.fullName || s.username || s.name;
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set);
  }, [rentals, staff]);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    const list = (rentals || []).filter(r => {
      const pay = String(r.paymentBy || r.paymentType || r.depositType || '').toLowerCase();
      const st = String(r.staffName || r.resellStaff || '').toLowerCase();

      const matchSearch =
        !q ||
        (r.guestName || r.customerName || '').toLowerCase().includes(q) ||
        (r.bikeName || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q) ||
        (r.guestPhone || r.phone || '').toLowerCase().includes(q) ||
        pay.includes(q) ||
        st.includes(q);

      const matchBike = !selectedBike || String(r.bikeId || r.motoId) === String(selectedBike);
      const matchPayment = !selectedPayment || pay.includes(selectedPayment.toLowerCase());
      const matchStaff = !selectedStaff || st === selectedStaff.toLowerCase();
      const matchFrom = !dateFrom || (r.startDate || r.checkoutDate) >= dateFrom;
      const matchTo = !dateTo || (r.startDate || r.checkoutDate) <= dateTo;
      return matchSearch && matchBike && matchPayment && matchStaff && matchFrom && matchTo;
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
        return String(a.guestName || a.customerName || '').trim().localeCompare(String(b.guestName || b.customerName || '').trim(), 'km');
      }
      if (sortBy === 'name-desc') {
        return String(b.guestName || b.customerName || '').trim().localeCompare(String(a.guestName || a.customerName || '').trim(), 'km');
      }
      if (sortBy === 'amount-desc') {
        const sumA = (parseFloat(a.totalPrice) || 0) + (parseFloat(a.lateFee) || 0) + (parseFloat(a.damageFee) || 0);
        const sumB = (parseFloat(b.totalPrice) || 0) + (parseFloat(b.lateFee) || 0) + (parseFloat(b.damageFee) || 0);
        return sumB - sumA;
      }
      if (sortBy === 'amount-asc') {
        const sumA = (parseFloat(a.totalPrice) || 0) + (parseFloat(a.lateFee) || 0) + (parseFloat(a.damageFee) || 0);
        const sumB = (parseFloat(b.totalPrice) || 0) + (parseFloat(b.lateFee) || 0) + (parseFloat(b.damageFee) || 0);
        return sumA - sumB;
      }
      return 0;
    });

    return list;
  }, [rentals, search, selectedBike, selectedPayment, selectedStaff, dateFrom, dateTo, sortBy]);

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
    const headers = ['ID', 'Date', 'Customer', 'Phone', 'Bike', 'Plate', 'Payment By', 'Staff Resell', 'Rental Fee', 'Late Fee', 'Damage Fee', 'Total Income'];
    const rows = filtered.map(r => [
      r.id,
      r.startDate || r.checkoutDate || '',
      `"${r.guestName || r.customerName || ''}"`,
      `"${r.guestPhone || r.phone || ''}"`,
      `"${r.bikeName || ''}"`,
      `"${r.plateNumber || ''}"`,
      `"${(r.paymentBy || r.paymentType || r.depositType || 'Cash').toUpperCase()}"`,
      `"${r.staffName || r.resellStaff || 'Reception'}"`,
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

  const handleDelete = async (rental) => {
    const name = rental.guestName || rental.customerName || `Record #${rental.id}`;
    const confirmed = await showConfirm(
      'Delete Income Record',
      `Are you sure you want to delete the income/rental record for "${name}"?`,
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
      showModal('success', 'Record Deleted', `Income record for ${name} deleted successfully.`);
      if (fetchAll) fetchAll();
    } catch (e) {
      console.error('Delete income error:', e);
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
      lateFee: parseFloat(rental.lateFee || 0),
      damageFee: parseFloat(rental.damageFee || 0),
      deposit: parseFloat(rental.deposit || 0),
      paymentType: rental.paymentType || rental.depositType || 'cash',
      paymentBy: rental.paymentBy || rental.paymentType || rental.depositType || 'Cash',
      staffName: rental.staffName || rental.resellStaff || 'Reception',
      resellStaff: rental.resellStaff || rental.staffName || 'Reception',
      status: rental.status || 'returned'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRental) return;
    setIsSaving(true);
    try {
      const selectedB = bikes.find(b => String(b.id) === String(editingRental.bikeId));
      const payType = editingRental.paymentType || 'cash';
      const payBy = editingRental.paymentBy || payType;
      const stName = editingRental.staffName || 'Reception';

      const updated = {
        ...editingRental,
        bikeName: selectedB ? selectedB.name : editingRental.bikeName || 'Motorbike',
        plateNumber: selectedB?.plateNumber || editingRental.plateNumber || '',
        totalPrice: Number(editingRental.totalPrice || 0),
        lateFee: Number(editingRental.lateFee || 0),
        damageFee: Number(editingRental.damageFee || 0),
        deposit: Number(editingRental.deposit || 0),
        paymentType: payType,
        paymentBy: payBy,
        staffName: stName,
        resellStaff: stName
      };

      if (setRentals) {
        setRentals(prev => (prev || []).map(r => String(r.id) === String(updated.id) ? updated : r));
      }
      setEditingRental(null);

      // Clean payload for Firestore (no undefined values)
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
        lateFee: Number(updated.lateFee || 0),
        damageFee: Number(updated.damageFee || 0),
        deposit: Number(updated.deposit || 0),
        paymentType: payType,
        paymentBy: payBy,
        depositType: payType,
        staffName: stName,
        resellStaff: stName,
        status: updated.status || 'returned',
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

      showModal('success', 'Record Updated', `Income record for ${updated.guestName} updated successfully.`);
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Error updating income record:', err);
      showModal('error', 'Update Failed', err.message);
    } finally {
      setIsSaving(false);
    }
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search customer, bike, plate..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className={`${inputCls} w-full sm:w-56 text-xs py-2`}
            />
            <select
              value={selectedBike}
              onChange={e => { setSelectedBike(e.target.value); setPage(1); }}
              className={`${inputCls} w-auto text-xs py-2`}
            >
              <option value="">All Motorcycles</option>
              {bikes.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.plateNumber || 'No Plate'})</option>
              ))}
            </select>
            <select
              value={selectedPayment}
              onChange={e => { setSelectedPayment(e.target.value); setPage(1); }}
              className={`${inputCls} w-auto text-xs py-2 font-medium`}
              title="Filter by Payment Method"
            >
              <option value="">All Payments (គ្រប់វិធីបង់ប្រាក់)</option>
              <option value="cash">💵 Cash</option>
              <option value="aba">🏦 ABA Bank</option>
              <option value="acleda">🏦 ACLEDA</option>
              <option value="wing">📱 Wing</option>
              <option value="other">💳 Other</option>
            </select>
            <select
              value={selectedStaff}
              onChange={e => { setSelectedStaff(e.target.value); setPage(1); }}
              className={`${inputCls} w-auto text-xs py-2 font-medium`}
              title="Filter by Staff Resell"
            >
              <option value="">All Staff (បុគ្គលិកទាំងអស់)</option>
              {staffOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className={`${inputCls} w-auto text-xs py-2`}
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
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
              <option value="name-asc">ឈ្មោះ: A ដល់ Z (Name: A - Z)</option>
              <option value="name-desc">ឈ្មោះ: Z ដល់ A (Name: Z - A)</option>
              <option value="amount-desc">ចំណូលសរុប: ខ្ពស់ទៅទាប</option>
              <option value="amount-asc">ចំណូលសរុប: ទាបទៅខ្ពស់</option>
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

      {/* Income Details Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200 select-none">
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
                  title="Click to sort by date"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4">Payment By (បង់តាម)</th>
                <th className="p-4">Staff Resell (បុគ្គលិកលក់)</th>
                <th className="p-4">Rental Fee</th>
                <th className="p-4">Late Fee</th>
                <th className="p-4">Damage</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'amount-desc' ? 'amount-asc' : 'amount-desc')}
                  className="p-4 text-right cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by total income"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Income</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('amount') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(r => {
                const rowTotal = (parseFloat(r.totalPrice) || 0) + (parseFloat(r.lateFee) || 0) + (parseFloat(r.damageFee) || 0);
                return (
                  <tr key={r.id} className="hover:bg-stone-50/80 transition">
                    <td className="p-4 font-bold text-stone-900">
                      <div>{r.guestName || r.customerName || 'Customer'}</div>
                      {r.guestPhone && <div className="text-[11px] text-stone-400 font-normal">{r.guestPhone}</div>}
                    </td>
                    <td className="p-4 font-semibold">
                      <div>{r.bikeName || 'Motor'}</div>
                      <div className="text-[11px] font-mono text-stone-400">{r.plateNumber || ''}</div>
                    </td>
                    <td className="p-4 text-stone-600">{r.startDate || r.checkoutDate || '—'}</td>
                    <td className="p-4">
                      {(() => {
                        const p = (r.paymentBy || r.paymentType || r.depositType || 'cash').toLowerCase();
                        let badgeCls = 'bg-stone-100 text-stone-700 border-stone-200';
                        let icon = 'fa-solid fa-money-bill-wave';
                        let label = r.paymentBy || r.paymentType || r.depositType || 'Cash';
                        if (p.includes('cash')) {
                          badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          icon = 'fa-solid fa-money-bill-wave';
                        } else if (p.includes('aba')) {
                          badgeCls = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                          icon = 'fa-solid fa-building-columns';
                        } else if (p.includes('acleda')) {
                          badgeCls = 'bg-blue-50 text-blue-700 border-blue-200';
                          icon = 'fa-solid fa-credit-card';
                        } else if (p.includes('wing')) {
                          badgeCls = 'bg-lime-50 text-lime-800 border-lime-200';
                          icon = 'fa-solid fa-mobile-screen-button';
                        }
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${badgeCls}`}>
                            <i className={icon}></i>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200/80 text-stone-800 text-xs font-semibold">
                        <i className="fa-solid fa-user-tag text-brand-500 text-[10px]"></i>
                        <span>{r.staffName || r.resellStaff || r.sellerName || 'Reception'}</span>
                      </div>
                    </td>
                    <td className="p-4">${parseFloat(r.totalPrice || 0).toFixed(2)}</td>
                    <td className="p-4 text-amber-600">${parseFloat(r.lateFee || 0).toFixed(2)}</td>
                    <td className="p-4 text-rose-600">${parseFloat(r.damageFee || 0).toFixed(2)}</td>
                    <td className="p-4 text-right font-black text-emerald-600">${rowTotal.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(r)}
                          className="w-7 h-7 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Income Record"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="w-7 h-7 flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          title="Delete Income Record"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-stone-400">
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

      {/* EDIT INCOME MODAL */}
      {editingRental && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Income Record #{editingRental.id}
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

              <div className="grid grid-cols-3 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={editingRental.status}
                    onChange={e => setEditingRental({ ...editingRental, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="returned">Returned (រួចរាល់)</option>
                    <option value="active">Active (កំពុងជួល)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Payment By (វិធីបង់ប្រាក់)</label>
                  <select
                    value={editingRental.paymentType || 'cash'}
                    onChange={e => setEditingRental({ ...editingRental, paymentType: e.target.value, paymentBy: e.target.value })}
                    className={inputCls}
                  >
                    <option value="cash">💵 Cash (សាច់ប្រាក់)</option>
                    <option value="aba">🏦 ABA Bank</option>
                    <option value="acleda">🏦 ACLEDA</option>
                    <option value="wing">📱 Wing</option>
                    <option value="other">💳 Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Staff Resell (បុគ្គលិកលក់)</label>
                  <input
                    type="text"
                    value={editingRental.staffName || ''}
                    onChange={e => setEditingRental({ ...editingRental, staffName: e.target.value, resellStaff: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. Reception, Sokha..."
                  />
                </div>
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
    </div>
  );
}
