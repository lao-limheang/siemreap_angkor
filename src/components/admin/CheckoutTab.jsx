import { useState, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { syncRentalCheckoutToOldSystem } from '../../services/DatabaseService';

export default function CheckoutTab({
  bikes,
  rentals,
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
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDoc, setCustDoc] = useState('');
  const [selectedBikeId, setSelectedBikeId] = useState('');
  const [dateOut, setDateOut] = useState(today());
  const [timeOut, setTimeOut] = useState('08:00');
  const [dateDue, setDateDue] = useState(today());
  const [timeDue, setTimeDue] = useState('18:00');
  const [rentalType, setRentalType] = useState('full'); // 'full' | 'half'
  const [extraHalfDay, setExtraHalfDay] = useState(false);
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('50');
  const [fuelOut, setFuelOut] = useState('Full');
  const [kmOut, setKmOut] = useState('');
  const [helmets, setHelmets] = useState('1');
  const [staffName, setStaffName] = useState('Reception');
  const [paymentType, setPaymentType] = useState('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { showModal } = useModal();

  // Available bikes
  const availableBikes = useMemo(() => {
    return bikes.filter(b => b.status === 'Available' || b.status === 'available');
  }, [bikes]);

  // Selected bike object
  const selectedBike = useMemo(() => {
    return bikes.find(b => String(b.id) === String(selectedBikeId));
  }, [bikes, selectedBikeId]);

  const handleBikeChange = (id) => {
    setSelectedBikeId(id);
    const found = bikes.find(b => String(b.id) === String(id));
    if (found) {
      setPricePerDay(String(found.price || 12));
    }
  };

  // Calculate days & total
  const calculatedDays = useMemo(() => {
    if (!dateOut || !dateDue) return 1;
    const d1 = new Date(dateOut);
    const d2 = new Date(dateDue);
    const diffTime = Math.max(0, d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let days = diffDays <= 0 ? 1 : diffDays;
    if (rentalType === 'half') {
      days = 0.5;
    } else if (extraHalfDay) {
      days += 0.5;
    }
    return days;
  }, [dateOut, dateDue, rentalType, extraHalfDay]);

  const totalPrice = useMemo(() => {
    const rate = parseFloat(pricePerDay) || 0;
    return (rate * calculatedDays).toFixed(2);
  }, [pricePerDay, calculatedDays]);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBikeId) {
      showModal('warning', 'Select Motorcycle', 'Please select a motorcycle before checking out.');
      return;
    }
    if (!custName.trim()) {
      showModal('warning', 'Customer Name Required', 'Please enter the customer name.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');

    try {
      const payload = {
        bikeId: selectedBike.id,
        bikeName: selectedBike.name,
        plateNumber: selectedBike.plateNumber || '',
        guestName: custName.trim(),
        guestPhone: custPhone.trim(),
        guestDoc: custDoc.trim(),
        startDate: dateOut,
        timeOut,
        endDate: dateDue,
        timeDue,
        rentalType,
        extraHalfDay,
        dailyRate: parseFloat(pricePerDay) || 0,
        totalDays: calculatedDays,
        totalPrice: parseFloat(totalPrice) || 0,
        deposit: parseFloat(deposit) || 0,
        depositType: paymentType,
        fuelOut,
        kmOut,
        helmets: parseInt(helmets) || 1,
        staffName,
        paymentType,
        notes: note
      };

      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(`Rental checked out successfully for ${custName} (${selectedBike.name})!`);
        // Realtime sync to chafe-2026 (Live old system)
        syncRentalCheckoutToOldSystem(payload).catch(console.error);

        // Reset
        setCustName('');
        setCustPhone('');
        setCustDoc('');
        setSelectedBikeId('');
        setNote('');
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        showModal('error', 'Checkout Error', data.error || 'Server error');
      }
    } catch (err) {
      showModal('error', 'Network Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={`${cardCls} p-6 sm:p-8`}>
        <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
          <div>
            <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-brand-500 rounded-full"></span>
              ចេញម៉ូតូជួល (New Motor Check-Out)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Dispatch a motorcycle to a customer, record deposit, inspection, and rental terms.
            </p>
          </div>
          <span className="text-xs font-bold text-stone-400">
            {availableBikes.length} Motos Available
          </span>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-semibold">
            <i className="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="space-y-6">
          {/* Section 1: Customer Details */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-user text-brand-500"></i> Customer Information (ព័ត៌មានអតិថិជន)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Guest Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe / គឹម សុង"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone / Telegram</label>
                <input
                  type="text"
                  placeholder="0xx xxx xxx"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Passport / National ID</label>
                <input
                  type="text"
                  placeholder="Passport or ID Number"
                  value={custDoc}
                  onChange={e => setCustDoc(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bike Selection */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-motorcycle text-brand-500"></i> Select Motorcycle (ជ្រើសរើសម៉ូតូ)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Motorbike <span className="text-red-500">*</span></label>
                <select
                  required
                  value={selectedBikeId}
                  onChange={e => handleBikeChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Choose an available motorcycle --</option>
                  {availableBikes.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} — Plate: {b.plateNumber || 'N/A'} ({b.color || 'Standard'}) - ${b.price}/day
                    </option>
                  ))}
                </select>
              </div>

              {selectedBike && (
                <div className="sm:col-span-2 p-3.5 bg-brand-50/60 border border-brand-200/60 rounded-xl flex items-center justify-between text-xs text-brand-900">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold">
                      <i className="fa-solid fa-motorcycle"></i>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{selectedBike.name}</p>
                      <p className="text-stone-500 font-mono">Plate: {selectedBike.plateNumber || 'No Plate'}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-base text-brand-700">${selectedBike.price}/day</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Rental Dates & Durations */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-calendar-days text-brand-500"></i> Dates & Schedule (កាលបរិច្ឆេទ)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Date Out</label>
                <input
                  type="date"
                  required
                  value={dateOut}
                  onChange={e => setDateOut(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Time Out</label>
                <input
                  type="time"
                  value={timeOut}
                  onChange={e => setTimeOut(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Return Date Due</label>
                <input
                  type="date"
                  required
                  value={dateDue}
                  onChange={e => setDateDue(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Return Time Due</label>
                <input
                  type="time"
                  value={timeDue}
                  onChange={e => setTimeDue(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Rental Type & Extra Half Day */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-stone-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="chk-type"
                  checked={rentalType === 'full'}
                  onChange={() => setRentalType('full')}
                  className="accent-brand-500"
                />
                Full Day (ពេញថ្ងៃ)
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="chk-type"
                  checked={rentalType === 'half'}
                  onChange={() => setRentalType('half')}
                  className="accent-brand-500"
                />
                Half Day (កន្លះថ្ងៃ - 0.5)
              </label>
              {rentalType === 'full' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraHalfDay}
                    onChange={e => setExtraHalfDay(e.target.checked)}
                    className="accent-amber-500"
                  />
                  + Extra Half Day (+0.5 ថ្ងៃ)
                </label>
              )}
            </div>
          </div>

          {/* Section 4: Inspection & Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Rate / Day ($)</label>
              <input
                type="number"
                step="any"
                required
                value={pricePerDay}
                onChange={e => setPricePerDay(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Total Days</label>
              <input
                type="text"
                readOnly
                value={`${calculatedDays} day(s)`}
                className={`${inputCls} bg-stone-100 font-bold text-stone-700`}
              />
            </div>
            <div>
              <label className={labelCls}>Deposit ($)</label>
              <input
                type="number"
                step="any"
                value={deposit}
                onChange={e => setDeposit(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Method</label>
              <select
                value={paymentType}
                onChange={e => setPaymentType(e.target.value)}
                className={inputCls}
              >
                <option value="cash">Cash (សាច់ប្រាក់)</option>
                <option value="aba">ABA Bank</option>
                <option value="acleda">ACLEDA</option>
                <option value="wing">Wing</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Fuel Level Out</label>
              <select value={fuelOut} onChange={e => setFuelOut(e.target.value)} className={inputCls}>
                <option>Full</option>
                <option>3/4</option>
                <option>1/2</option>
                <option>1/4</option>
                <option>Empty</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Odometer (KM Out)</label>
              <input
                type="number"
                placeholder="e.g. 12450"
                value={kmOut}
                onChange={e => setKmOut(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Helmets Count</label>
              <input
                type="number"
                min="0"
                value={helmets}
                onChange={e => setHelmets(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes / Existing Scratches</label>
            <textarea
              rows="2"
              placeholder="Any existing scratches, condition notes..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className={inputCls}
            ></textarea>
          </div>

          {/* Pricing Banner & Submit */}
          <div className="p-5 bg-stone-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-stone-400">Total Rental Price</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-brand-400">${totalPrice}</span>
                <span className="text-xs text-stone-400">({calculatedDays} days @ ${pricePerDay || 0}/day)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedBikeId}
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i> Save & Check Out Motor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
