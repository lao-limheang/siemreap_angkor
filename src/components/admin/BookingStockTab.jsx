import { useState, useMemo } from 'react';
import { calculateBookingStock } from '../../services/StockService';
import { syncBookingToOldSystem } from '../../services/DatabaseService';

export default function BookingStockTab({
  bikes = [],
  models = [],
  rentals = [],
  bookings = [],
  auth,
  fetchAll,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  today,
  currency
}) {
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [selectedModelFilter, setSelectedModelFilter] = useState('');
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveForm, setReserveForm] = useState({
    customerName: '',
    customerPhone: '',
    deposit: '10',
    pricePerDay: '15',
    note: ''
  });
  const [reserving, setReserving] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState('');

  // Quick date presets
  const setQuickDates = (type) => {
    const d1 = new Date();
    const d2 = new Date();
    if (type === 'today') {
      setStartDate(d1.toISOString().split('T')[0]);
      setEndDate(d1.toISOString().split('T')[0]);
    } else if (type === 'tomorrow') {
      d2.setDate(d2.getDate() + 1);
      setStartDate(d1.toISOString().split('T')[0]);
      setEndDate(d2.toISOString().split('T')[0]);
    } else if (type === 'week') {
      d2.setDate(d2.getDate() + 7);
      setStartDate(d1.toISOString().split('T')[0]);
      setEndDate(d2.toISOString().split('T')[0]);
    }
  };

  // Calculate live stock
  const stock = useMemo(() => {
    return calculateBookingStock(bikes, models, rentals, bookings, startDate, endDate);
  }, [bikes, models, rentals, bookings, startDate, endDate]);

  // Filtered bikes
  const filteredBikes = useMemo(() => {
    if (!selectedModelFilter) return stock.motoStock;
    return stock.motoStock.filter(m => String(m.modelId) === String(selectedModelFilter) || m.name === selectedModelFilter);
  }, [stock.motoStock, selectedModelFilter]);

  const openReserve = (target) => {
    setReserveTarget(target);
    setReserveForm({
      customerName: '',
      customerPhone: '',
      deposit: '10',
      pricePerDay: String(target.price || 15),
      note: ''
    });
    setReserveModalOpen(true);
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (!reserveForm.customerName.trim()) {
      alert('Please enter guest name.');
      return;
    }

    setReserving(true);
    setSyncSuccess('');
    try {
      const isBike = Boolean(reserveTarget.plateNumber);
      const bookingData = {
        customerName: reserveForm.customerName.trim(),
        customerPhone: reserveForm.customerPhone.trim(),
        motoId: isBike ? reserveTarget.id : '',
        motoName: reserveTarget.name,
        checkoutDate: startDate,
        returnDueDate: endDate,
        pricePerDay: Number(reserveForm.pricePerDay) || 15,
        deposit: Number(reserveForm.deposit) || 0,
        status: 'confirmed',
        deliveryType: 'Pickup at Shop',
        contactFrom: 'Admin Booking Stock',
        specialRequests: reserveForm.note || ''
      };

      // 1. Sync to chafe-2026 (Live old system Firebase)
      await syncBookingToOldSystem(bookingData);

      // 2. Save to local SQLite / backend
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'motor',
          itemName: reserveTarget.name,
          customerName: reserveForm.customerName.trim(),
          phone: reserveForm.customerPhone.trim(),
          startDate,
          endDate,
          deposit: Number(reserveForm.deposit) || 0,
          specialRequests: reserveForm.note || ''
        })
      });

      setSyncSuccess(`Reserved ${reserveTarget.name} for ${reserveForm.customerName}! Real-time synced to Firebase.`);
      setReserveModalOpen(false);
      fetchAll();
      setTimeout(() => setSyncSuccess(''), 5000);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Picker */}
      <div className={`${cardCls} p-5 sm:p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-100 pb-5 mb-5">
          <div>
            <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2.5">
              <i className="fa-solid fa-boxes-stacked text-brand-500"></i>
              ស្តុកការកក់ម៉ូតូ (Booking Stock & Fleet Availability)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Real-time motor stock tracking, anti-overbooking manager, and live synchronization with old system.
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-xs">
              <span className="font-bold text-stone-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-xs">
              <span className="font-bold text-stone-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent font-semibold text-stone-800 outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setQuickDates('today')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-stone-700 hover:bg-white transition"
              >
                Today
              </button>
              <button
                onClick={() => setQuickDates('tomorrow')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-stone-700 hover:bg-white transition"
              >
                1 Night
              </button>
              <button
                onClick={() => setQuickDates('week')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-stone-700 hover:bg-white transition"
              >
                7 Days
              </button>
            </div>
          </div>
        </div>

        {syncSuccess && (
          <div className="p-4 mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
            <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
            <span>{syncSuccess}</span>
          </div>
        )}

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">Total Fleet</span>
              <i className="fa-solid fa-motorcycle text-stone-500"></i>
            </div>
            <div className="text-3xl font-black font-display">{stock.totalFleet}</div>
            <p className="text-[11px] text-stone-400 mt-1">Total registered bikes</p>
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-blue-600 font-bold uppercase tracking-wider">Currently Rented</span>
              <i className="fa-solid fa-key text-blue-400"></i>
            </div>
            <div className="text-3xl font-black text-blue-700 font-display">{stock.totalRented}</div>
            <p className="text-[11px] text-stone-400 mt-1">Active out on road</p>
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-600 font-bold uppercase tracking-wider">Reserved/Booked</span>
              <i className="fa-solid fa-calendar-check text-amber-400"></i>
            </div>
            <div className="text-3xl font-black text-amber-700 font-display">{stock.totalBooked}</div>
            <p className="text-[11px] text-stone-400 mt-1">Locked for these dates</p>
          </div>

          <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-emerald-100 font-bold uppercase tracking-wider">Free In Stock</span>
              <i className="fa-solid fa-circle-check text-emerald-200"></i>
            </div>
            <div className="text-3xl font-black font-display">{stock.totalAvailable}</div>
            <p className="text-[11px] text-emerald-100 mt-1">
              Ready for new bookings ({stock.totalFleet > 0 ? Math.round((stock.totalAvailable / stock.totalFleet) * 100) : 0}% free)
            </p>
          </div>
        </div>
      </div>

      {/* Model Stock Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <span>Stock by Motorcycle Model</span>
            <span className="text-xs font-normal text-stone-500">({stock.modelStock.length} models)</span>
          </h4>
          {selectedModelFilter && (
            <button
              onClick={() => setSelectedModelFilter('')}
              className="text-xs text-brand-600 font-bold hover:underline"
            >
              Show All Models
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stock.modelStock.map(m => {
            const pct = m.totalFleet > 0 ? Math.round((m.availableCount / m.totalFleet) * 100) : 0;
            const isSelected = String(selectedModelFilter) === String(m.id);

            return (
              <div
                key={m.id}
                onClick={() => setSelectedModelFilter(isSelected ? '' : m.id)}
                className={`${cardCls} p-5 hover:shadow-md transition cursor-pointer border-2 ${
                  isSelected ? 'border-brand-500 bg-brand-50/20' : 'border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.name} className="w-12 h-12 object-cover rounded-xl border border-stone-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-motorcycle"></i>
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-stone-900 text-sm leading-snug">{m.name}</h5>
                      <p className="text-xs font-bold text-brand-600">${m.price}/day</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                    m.stockStatus === 'in_stock'
                      ? 'bg-emerald-100 text-emerald-800'
                      : m.stockStatus === 'low_stock'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {m.stockStatus === 'in_stock' ? `${m.availableCount} In Stock` : m.stockStatus === 'low_stock' ? 'Only 1 Left!' : 'Out of Stock'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-[11px] font-semibold text-stone-500">
                    <span>Available Stock</span>
                    <span className="font-bold text-stone-800">{m.availableCount} / {m.totalFleet} units</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                    <div
                      className="bg-blue-400 transition-all duration-500"
                      style={{ width: `${m.totalFleet > 0 ? (m.rentedCount / m.totalFleet) * 100 : 0}%` }}
                    ></div>
                    <div
                      className="bg-amber-400 transition-all duration-500"
                      style={{ width: `${m.totalFleet > 0 ? (m.bookedCount / m.totalFleet) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Breakdown pills */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold mb-4">
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
                    Free: {m.availableCount}
                  </div>
                  <div className="p-1.5 bg-blue-50 text-blue-800 rounded-lg">
                    Rented: {m.rentedCount}
                  </div>
                  <div className="p-1.5 bg-amber-50 text-amber-800 rounded-lg">
                    Booked: {m.bookedCount}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openReserve(m); }}
                    disabled={m.availableCount <= 0}
                    className={`${btnPrimary} w-full text-xs py-2 disabled:opacity-40 flex items-center justify-center gap-1.5`}
                  >
                    <i className="fa-solid fa-lock"></i> Reserve This Model
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Motorbike Availability Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <i className="fa-solid fa-list-check text-brand-500"></i>
              Motor Fleet Unit Availability ({filteredBikes.length} Bikes)
            </h4>
            <p className="text-xs text-stone-500">Status for selected period: {startDate} &rarr; {endDate}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Motorbike</th>
                <th className="p-4">Plate Number</th>
                <th className="p-4">Color</th>
                <th className="p-4">Rate</th>
                <th className="p-4">Status for Selected Dates</th>
                <th className="p-4">Current Customer / Booking</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredBikes.map(b => (
                <tr key={b.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-motorcycle text-stone-400"></i>
                      <span>{b.name}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-stone-600">{b.plateNumber || 'No Plate'}</td>
                  <td className="p-4 text-stone-600">{b.color || 'Standard'}</td>
                  <td className="p-4 font-bold text-brand-600">${b.price || 15}/day</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      b.availability === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.availability === 'rented'
                        ? 'bg-blue-100 text-blue-800'
                        : b.availability === 'booked'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        b.availability === 'available' ? 'bg-emerald-500' : b.availability === 'rented' ? 'bg-blue-500' : b.availability === 'booked' ? 'bg-amber-500' : 'bg-rose-500'
                      }`}></span>
                      {b.availability === 'available' ? 'Free to Book' : b.availability === 'rented' ? 'Out on Rental' : b.availability === 'booked' ? 'Booked' : 'Maintenance'}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600">
                    {b.activeRental ? (
                      <span className="text-blue-700 font-semibold">
                        {b.activeRental.guestName} (Due: {b.activeRental.endDate})
                      </span>
                    ) : b.activeBooking ? (
                      <span className="text-amber-700 font-semibold">
                        {b.activeBooking.customerName || b.activeBooking.name} (Booked)
                      </span>
                    ) : (
                      <span className="text-stone-400 italic">None</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {b.availability === 'available' && (
                      <button
                        onClick={() => openReserve(b)}
                        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-xs transition"
                      >
                        Reserve
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredBikes.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    No motorbikes match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reserve Stock Modal */}
      {reserveModalOpen && reserveTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div>
                <h4 className="font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-lock text-brand-500"></i>
                  Reserve Motor Stock
                </h4>
                <p className="text-xs text-stone-500">{reserveTarget.name} {reserveTarget.plateNumber ? `(${reserveTarget.plateNumber})` : ''}</p>
              </div>
              <button onClick={() => setReserveModalOpen(false)} className="text-stone-400 hover:text-stone-600">&times;</button>
            </div>

            <form onSubmit={handleReserveSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl space-y-1 text-stone-600">
                <div className="flex justify-between"><span>Selected Check-in:</span><span className="font-bold text-stone-800">{startDate}</span></div>
                <div className="flex justify-between"><span>Selected Due Date:</span><span className="font-bold text-stone-800">{endDate}</span></div>
              </div>

              <div>
                <label className={labelCls}>Guest Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sokha / John"
                  value={reserveForm.customerName}
                  onChange={e => setReserveForm({ ...reserveForm, customerName: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Phone / Telegram</label>
                <input
                  type="text"
                  placeholder="0xx xxx xxx"
                  value={reserveForm.customerPhone}
                  onChange={e => setReserveForm({ ...reserveForm, customerPhone: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Rate / Day ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={reserveForm.pricePerDay}
                    onChange={e => setReserveForm({ ...reserveForm, pricePerDay: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Deposit ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={reserveForm.deposit}
                    onChange={e => setReserveForm({ ...reserveForm, deposit: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Note</label>
                <textarea
                  rows="2"
                  placeholder="Special requests..."
                  value={reserveForm.note}
                  onChange={e => setReserveForm({ ...reserveForm, note: e.target.value })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setReserveModalOpen(false)} className={`${btnSecondary} flex-1`}>
                  Cancel
                </button>
                <button type="submit" disabled={reserving} className={`${btnPrimary} flex-1 flex items-center justify-center gap-1.5`}>
                  {reserving ? 'Reserving...' : 'Confirm & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
