import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useModal } from '../common/ModalProvider';
import { syncRentalCheckoutToOldSystem, CustomerService } from '../../services/DatabaseService';

export default function CheckoutTab({
  bikes = [],
  models = [],
  setBikes,
  rentals = [],
  setRentals,
  staff = [],
  guests = [],
  setGuests,
  auth,
  fetchAll,
  inputCls = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm',
  labelCls = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5',
  cardCls = 'bg-white border border-stone-200 rounded-2xl shadow-sm',
  btnPrimary = 'px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors shadow-sm',
  btnSecondary = 'px-4 py-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-50 transition-colors',
  today = () => new Date().toISOString().split('T')[0],
  currency = 'USD'
}) {
  const { showModal } = useModal();

  // Customer states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDoc, setCustDoc] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [custSearchOpen, setCustSearchOpen] = useState(false);
  const custSearchRef = useRef(null);

  // New Customer Modal
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: '',
    phone: '',
    passportOrId: '',
    nationality: '',
    notes: ''
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Multi-motor rental state: list of { id, modelId, bikeId, pricePerDay }
  const [selectedMotors, setSelectedMotors] = useState([
    { id: 'motor-1', modelId: '', bikeId: '', pricePerDay: '' }
  ]);

  // Schedule states
  const [dateOut, setDateOut] = useState(today());
  const [timeOut, setTimeOut] = useState('08:00');
  const [dateDue, setDateDue] = useState(today());
  const [timeDue, setTimeDue] = useState('18:00');
  const [rentalType, setRentalType] = useState('full'); // 'full' | 'half'
  const [extraHalfDay, setExtraHalfDay] = useState(false);

  // Payment & Staff states
  const [deposit, setDeposit] = useState('50');
  const [fuelOut, setFuelOut] = useState('Full');
  const [kmOut, setKmOut] = useState('');
  const [helmets, setHelmets] = useState('1');
  const [staffName, setStaffName] = useState(auth?.user?.name || auth?.user?.fullName || 'Reception');
  const [customStaff, setCustomStaff] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Close customer search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (custSearchRef.current && !custSearchRef.current.contains(e.target)) {
        setCustSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available bikes in fleet
  const availableBikes = useMemo(() => {
    return bikes.filter(b => b.status === 'Available' || b.status === 'available');
  }, [bikes]);

  // Filter matching customers from list for search autocomplete
  const matchingCustomers = useMemo(() => {
    if (!guests || guests.length === 0) return [];
    const q = (custName || '').toLowerCase().trim();
    if (!q) return guests.slice(0, 8);
    return guests.filter(g =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.phone || '').includes(q) ||
      (g.passportOrId || g.passportId || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [guests, custName]);

  // Auto-fill selected customer
  const handleSelectCustomer = (c) => {
    setCustName(c.name || '');
    setCustPhone(c.phone || c.customerPhone || '');
    setCustDoc(c.passportOrId || c.passportId || c.idNumber || c.guestDoc || '');
    setSelectedCustomerId(c.id);
    setCustSearchOpen(false);
  };

  // Clear selected customer
  const handleClearCustomer = () => {
    setCustName('');
    setCustPhone('');
    setCustDoc('');
    setSelectedCustomerId(null);
  };

  // Create new customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustForm.name.trim()) return;
    setSavingCustomer(true);
    try {
      const payload = {
        name: newCustForm.name.trim(),
        phone: newCustForm.phone.trim(),
        passportOrId: newCustForm.passportOrId.trim(),
        nationality: newCustForm.nationality.trim(),
        notes: newCustForm.notes.trim(),
        createdAt: Date.now()
      };

      const res = await CustomerService.create(payload);
      const createdCustomer = { id: res.id, ...payload };

      // Sync to SQLite guests table
      fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          passportId: payload.passportOrId,
          nationality: payload.nationality,
          notes: payload.notes
        })
      }).catch(err => console.warn('SQLite guest sync notice:', err));

      if (setGuests) {
        setGuests(prev => [createdCustomer, ...(prev || [])]);
      }

      // Auto-fill into checkout form
      setCustName(createdCustomer.name);
      setCustPhone(createdCustomer.phone);
      setCustDoc(createdCustomer.passportOrId);
      setSelectedCustomerId(createdCustomer.id);
      setCustSearchOpen(false);

      setNewCustomerModalOpen(false);
      setNewCustForm({ name: '', phone: '', passportOrId: '', nationality: '', notes: '' });
      showModal('success', 'Customer Created (បង្កើតអតិថិជនបានជោគជ័យ)', `Customer "${createdCustomer.name}" successfully created and auto-filled.`);
    } catch (err) {
      console.error('Error creating customer:', err);
      showModal('error', 'Error Creating Customer', err.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  // Available models list derived from models prop and available bikes
  const modelList = useMemo(() => {
    const list = [...(models || [])];
    (bikes || []).forEach(b => {
      const bModelName = b.modelName || b.name;
      if (b.modelId && !list.some(m => String(m.id) === String(b.modelId))) {
        list.push({
          id: String(b.modelId),
          name: bModelName || `Model ${b.modelId}`,
          fullName: bModelName || `Model ${b.modelId}`,
          dailyPrice: b.price || 15,
          price: b.price || 15
        });
      } else if (!b.modelId && bModelName && !list.some(m => m.name === bModelName || m.fullName === bModelName)) {
        list.push({
          id: `by-name-${bModelName}`,
          name: bModelName,
          fullName: bModelName,
          dailyPrice: b.price || 15,
          price: b.price || 15
        });
      }
    });
    return list;
  }, [models, bikes]);

  // Helper to filter available bikes by chosen model
  const getBikesForModel = useCallback((modelId) => {
    if (!modelId) return [];
    if (modelId === 'all') return availableBikes;
    return availableBikes.filter(b => {
      if (modelId.startsWith('by-name-')) {
        const namePart = modelId.replace('by-name-', '').toLowerCase().trim();
        return (b.name || '').toLowerCase().trim() === namePart || (b.modelName || '').toLowerCase().trim() === namePart;
      }
      if (String(b.modelId) === String(modelId)) return true;
      const targetModel = modelList.find(m => String(m.id) === String(modelId));
      if (targetModel) {
        const tFullName = (targetModel.fullName || '').toLowerCase().trim();
        const tName = (targetModel.name || '').toLowerCase().trim();
        const bName = (b.name || '').toLowerCase().trim();
        const bMName = (b.modelName || '').toLowerCase().trim();
        if (tFullName && (bName === tFullName || bMName === tFullName)) return true;
        if (tName && (bName === tName || bMName === tName)) return true;
      }
      return false;
    });
  }, [availableBikes, modelList]);

  // Multi-motor row handlers
  const handleAddMotorRow = () => {
    const newId = `motor-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setSelectedMotors(prev => [
      ...prev,
      { id: newId, modelId: '', bikeId: '', pricePerDay: '' }
    ]);
    setDeposit(prev => String(Math.max(50, (parseFloat(prev) || 0) + 50)));
    setHelmets(prev => String((parseInt(prev) || 0) + 1));
  };

  const handleRemoveMotorRow = (rowId) => {
    if (selectedMotors.length <= 1) return;
    setSelectedMotors(prev => prev.filter(m => m.id !== rowId));
    setDeposit(prev => String(Math.max(50, (parseFloat(prev) || 50) - 50)));
    setHelmets(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)));
  };

  const handleModelChange = (rowId, modelId) => {
    const selectedModel = modelList.find(m => String(m.id) === String(modelId));
    const modelPrice = selectedModel ? (selectedModel.dailyPrice || selectedModel.price) : null;
    const modelBikes = getBikesForModel(modelId);

    setSelectedMotors(prev => prev.map(m => {
      if (m.id !== rowId) return m;

      let newBikeId = m.bikeId;
      // If currently selected bike is not part of this model, reset bike selection
      if (newBikeId && modelId && modelId !== 'all') {
        const stillValid = modelBikes.some(b => String(b.id) === String(newBikeId));
        if (!stillValid) newBikeId = '';
      }

      const newPrice = modelPrice ? String(modelPrice) : m.pricePerDay;

      return {
        ...m,
        modelId,
        bikeId: newBikeId,
        pricePerDay: newPrice || m.pricePerDay
      };
    }));
  };

  const handleMotorChange = (rowId, bikeId) => {
    const found = bikes.find(b => String(b.id) === String(bikeId));
    setSelectedMotors(prev => prev.map(m => {
      if (m.id === rowId) {
        let rowModelId = m.modelId;
        if (!rowModelId && found) {
          rowModelId = found.modelId || (modelList.find(mod => mod.name === found.name)?.id) || '';
        }
        return {
          ...m,
          bikeId,
          modelId: rowModelId || m.modelId,
          pricePerDay: (found && (found.price || found.dailyPrice)) ? String(found.price || found.dailyPrice) : (m.pricePerDay || '15')
        };
      }
      return m;
    }));
  };

  const handleMotorPriceChange = (rowId, price) => {
    setSelectedMotors(prev => prev.map(m => m.id === rowId ? { ...m, pricePerDay: price } : m));
  };

  // Days & pricing calculations
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

  const totalDailyRate = useMemo(() => {
    return selectedMotors.reduce((sum, m) => sum + (parseFloat(m.pricePerDay) || 0), 0);
  }, [selectedMotors]);

  const totalRentalPrice = useMemo(() => {
    return (totalDailyRate * calculatedDays).toFixed(2);
  }, [totalDailyRate, calculatedDays]);

  // Submit checkout
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();

    if (!custName.trim()) {
      showModal('warning', 'Customer Name Required', 'Please enter or select a customer before checking out.');
      return;
    }

    if (selectedMotors.length === 0) {
      showModal('warning', 'Select Motor', 'Please select at least one motorcycle.');
      return;
    }

    for (let i = 0; i < selectedMotors.length; i++) {
      const m = selectedMotors[i];
      if (!m.bikeId) {
        showModal('warning', 'Incomplete Selection', `Please select a motorcycle for Motor #${i + 1}.`);
        return;
      }
    }

    const activeStaff = staffName === 'custom' ? (customStaff.trim() || 'Reception') : (staffName || 'Reception');

    setSubmitting(true);
    setSuccessMsg('');

    try {
      const createdRentals = [];
      const rentedBikeIds = [];
      const rentedBikeLabels = [];
      const totalDeposit = parseFloat(deposit) || 0;
      const depositPerBike = parseFloat((totalDeposit / selectedMotors.length).toFixed(2));

      for (let i = 0; i < selectedMotors.length; i++) {
        const m = selectedMotors[i];
        const bikeObj = bikes.find(b => String(b.id) === String(m.bikeId));
        const rate = parseFloat(m.pricePerDay) || (bikeObj?.price || 15);
        const itemTotal = parseFloat((rate * calculatedDays).toFixed(2));

        const payload = {
          bikeId: bikeObj ? bikeObj.id : m.bikeId,
          motoId: bikeObj ? bikeObj.id : m.bikeId,
          bikeName: bikeObj ? bikeObj.name : 'Motorbike',
          plateNumber: bikeObj?.plateNumber || '',
          guestName: custName.trim(),
          customerName: custName.trim(),
          customerId: selectedCustomerId || null,
          guestPhone: custPhone.trim(),
          phone: custPhone.trim(),
          guestDoc: custDoc.trim(),
          startDate: dateOut,
          checkoutDate: dateOut,
          timeOut,
          endDate: dateDue,
          returnDueDate: dateDue,
          timeDue,
          rentalType,
          extraHalfDay,
          dailyRate: rate,
          totalDays: calculatedDays,
          totalPrice: itemTotal,
          totalFee: itemTotal,
          deposit: depositPerBike,
          depositType: paymentType,
          paymentType,
          paymentBy: paymentType,
          fuelOut,
          kmOut,
          helmets: Math.max(1, Math.round((parseInt(helmets) || 1) / selectedMotors.length)),
          staffName: activeStaff,
          resellStaff: activeStaff,
          notes: selectedMotors.length > 1 ? `[Group Rental: ${selectedMotors.length} Motos] ${note}`.trim() : note,
          note,
          status: 'active'
        };

        // 1. Primary write to Firestore live system
        const firestoreRes = await syncRentalCheckoutToOldSystem(payload);
        const createdId = firestoreRes?.id || `local_${Date.now()}_${i}`;

        createdRentals.push({ ...payload, id: createdId });
        rentedBikeIds.push(String(payload.bikeId));
        rentedBikeLabels.push(`${payload.bikeName} (${payload.plateNumber || 'No Plate'})`);

        // 2. Background sync to SQLite API
        fetch('/api/rentals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
          body: JSON.stringify({ ...payload, id: createdId })
        }).catch(err => console.warn('SQLite rental sync notice:', err));
      }

      // Optimistic local state updates
      if (setBikes) {
        setBikes(prev => (prev || []).map(b => rentedBikeIds.includes(String(b.id)) ? { ...b, status: 'rented' } : b));
      }
      if (setRentals) {
        setRentals(prev => [...createdRentals, ...(prev || [])]);
      }

      const successText = `បានចេញម៉ូតូចំនួន ${selectedMotors.length} គ្រឿង (${rentedBikeLabels.join(', ')}) ជូនអតិថិជន ${custName} ដោយជោគជ័យ!`;
      setSuccessMsg(successText);
      showModal(
        'success',
        'Checkout Complete (ចេញម៉ូតូរួចរាល់)',
        `Successfully rented ${selectedMotors.length} motorcycle(s) to ${custName}:\n• ${rentedBikeLabels.join('\n• ')}\n\nTotal: $${totalRentalPrice} | Staff: ${activeStaff} | Payment: ${paymentType.toUpperCase()}`
      );

      // Reset form
      setCustName('');
      setCustPhone('');
      setCustDoc('');
      setSelectedCustomerId(null);
      setNote('');
      setSelectedMotors([{ id: 'motor-1', modelId: '', bikeId: '', pricePerDay: '' }]);
      setDeposit('50');
      setHelmets('1');
      if (fetchAll) fetchAll();
    } catch (err) {
      console.error('Checkout error:', err);
      showModal('error', 'Checkout Error', err.message || 'Failed to checkout motorcycles');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={`${cardCls} p-6 sm:p-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-4 mb-6 gap-3">
          <div>
            <h3 className="font-display font-bold text-xl text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-brand-500 rounded-full"></span>
              ចេញម៉ូតូជួល (New Motor Check-Out)
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Dispatch motorcycles to customers, support multiple motorbikes per customer, record deposits and seller staff.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              <i className="fa-solid fa-motorcycle text-brand-500 mr-1.5"></i>
              {availableBikes.length} Motos Available
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-semibold animate-in fade-in duration-300">
            <i className="fa-solid fa-circle-check text-emerald-600 text-xl flex-shrink-0"></i>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="space-y-6">
          {/* Section 1: Customer Details */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-user text-brand-500"></i> Customer Information (ព័ត៌មានអតិថិជន)
              </h4>
              <button
                type="button"
                onClick={() => setNewCustomerModalOpen(true)}
                className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-user-plus"></i> + Add New Customer (បង្កើតអតិថិជនថ្មី)
              </button>
            </div>

            {selectedCustomerId && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                  <span>Selected from CRM: <b>{custName}</b> {custPhone && `(${custPhone})`}</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-stone-400 hover:text-stone-700 text-xs underline font-bold cursor-pointer"
                >
                  Change / Clear
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Guest Name with Search Autocomplete */}
              <div className="relative" ref={custSearchRef}>
                <label className={labelCls}>
                  Guest Name (ឈ្មោះ) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type name to search customer..."
                    value={custName}
                    onChange={e => {
                      setCustName(e.target.value);
                      setSelectedCustomerId(null);
                      setCustSearchOpen(true);
                    }}
                    onFocus={() => setCustSearchOpen(true)}
                    className={`${inputCls} pr-8`}
                  />
                  {custName ? (
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                      title="Clear"
                    >
                      &times;
                    </button>
                  ) : (
                    <i className="fa-solid fa-magnifying-glass absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none"></i>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {custSearchOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-stone-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-stone-100 text-xs">
                    <div className="p-2 bg-stone-50 text-[11px] font-bold text-stone-500 flex items-center justify-between">
                      <span>Existing Customers ({matchingCustomers.length})</span>
                      <button
                        type="button"
                        onClick={() => { setCustSearchOpen(false); setNewCustomerModalOpen(true); }}
                        className="text-brand-600 hover:underline font-bold"
                      >
                        + Add New
                      </button>
                    </div>
                    {matchingCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-3 hover:bg-brand-50/70 cursor-pointer transition flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {(c.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 truncate">{c.name}</p>
                            <p className="text-[11px] text-stone-400 truncate">
                              {c.phone ? `📞 ${c.phone}` : 'No phone'} {c.passportOrId ? `• ID: ${c.passportOrId}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100 flex-shrink-0">
                          Select
                        </span>
                      </div>
                    ))}

                    {matchingCustomers.length === 0 && (
                      <div className="p-4 text-center text-stone-400">
                        <p className="font-medium">No matching customer found.</p>
                        <button
                          type="button"
                          onClick={() => { setCustSearchOpen(false); setNewCustomerModalOpen(true); }}
                          className="mt-2 px-3 py-1 bg-brand-500 text-white font-bold rounded-lg text-xs"
                        >
                          + Create New Customer
                        </button>
                      </div>
                    )}
                  </div>
                )}
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

          {/* Section 2: Multi-Motor Selection */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
              <div>
                <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-2">
                  <i className="fa-solid fa-motorcycle text-brand-500"></i>
                  Select Motorcycles ({selectedMotors.length} Motor{selectedMotors.length > 1 ? 's' : ''})
                </h4>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  One customer can rent multiple motorcycles in this single check-out.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddMotorRow}
                disabled={availableBikes.length <= selectedMotors.filter(m => m.bikeId).length}
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <i className="fa-solid fa-plus"></i> + Add Another Motor (បន្ថែមម៉ូតូ)
              </button>
            </div>

            <div className="space-y-3">
              {selectedMotors.map((mRow, idx) => {
                const chosenBike = bikes.find(b => String(b.id) === String(mRow.bikeId));
                // Other rows' chosen bike IDs
                const otherChosenIds = new Set(
                  selectedMotors.filter((_, oIdx) => oIdx !== idx).map(m => String(m.bikeId)).filter(Boolean)
                );
                const bikesForThisRow = getBikesForModel(mRow.modelId);

                return (
                  <div key={mRow.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-black">
                          #{idx + 1}
                        </span>
                        <span>Motorcycle #{idx + 1}</span>
                      </span>
                      {selectedMotors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMotorRow(mRow.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                        >
                          <i className="fa-solid fa-trash text-[10px]"></i> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* 1. Choose Model First */}
                      <div className="sm:col-span-5">
                        <label className={labelCls}>
                          1. Choose Model (ជ្រើសរើសម៉ូឌែល) <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={mRow.modelId || ''}
                          onChange={e => handleModelChange(mRow.id, e.target.value)}
                          className={inputCls}
                        >
                          <option value="">-- Select Model (ជ្រើសរើសម៉ូឌែល) --</option>
                          <option value="all">-- All Models (បង្ហាញគ្រប់ម៉ូឌែល) --</option>
                          {modelList.map(mod => {
                            const availCount = getBikesForModel(mod.id).length;
                            return (
                              <option key={mod.id} value={mod.id}>
                                {mod.fullName || mod.name} (${mod.dailyPrice || mod.price || 15}/d) — {availCount > 0 ? `${availCount} Available` : '0 Available'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* 2. Choose Motor / Plate */}
                      <div className="sm:col-span-4">
                        <label className={labelCls}>
                          2. Choose Motor (ជ្រើសរើសម៉ូតូ) <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={mRow.bikeId}
                          onChange={e => handleMotorChange(mRow.id, e.target.value)}
                          disabled={!mRow.modelId}
                          className={`${inputCls} ${!mRow.modelId ? 'opacity-60 cursor-not-allowed bg-stone-100' : ''}`}
                        >
                          {!mRow.modelId ? (
                            <option value="">-- Select model first --</option>
                          ) : bikesForThisRow.length === 0 ? (
                            <option value="">-- No available bikes in this model --</option>
                          ) : (
                            <>
                              <option value="">-- Select Motorcycle (ស្លាកលេខ) --</option>
                              {bikesForThisRow.map(b => {
                                const isChosenElsewhere = otherChosenIds.has(String(b.id));
                                return (
                                  <option key={b.id} value={b.id} disabled={isChosenElsewhere}>
                                    Plate: {b.plateNumber || 'No Plate'} ({b.color || 'Standard'}) - ${b.price || 15}/d {isChosenElsewhere ? ' (In another row)' : ''}
                                  </option>
                                );
                              })}
                            </>
                          )}
                        </select>
                      </div>

                      {/* 3. Rate / Day */}
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Rate / Day ($) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="15"
                            value={mRow.pricePerDay}
                            onChange={e => handleMotorPriceChange(mRow.id, e.target.value)}
                            className={`${inputCls} pl-7 font-bold`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick feedback message after model selection */}
                    {!mRow.bikeId && mRow.modelId && (
                      <div className="text-[11px] pt-0.5">
                        {bikesForThisRow.length > 0 ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <i className="fa-solid fa-circle-check text-[10px]"></i>
                            <span>{bikesForThisRow.length} motorcycle(s) ready in this model. Please select unit / plate above.</span>
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                            <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                            <span>All units for this model are currently rented out or unavailable.</span>
                          </span>
                        )}
                      </div>
                    )}

                    {chosenBike && (
                      <div className="p-3 bg-brand-50/50 border border-brand-200/50 rounded-xl flex items-center justify-between text-xs text-brand-950">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm">
                            <i className="fa-solid fa-motorcycle"></i>
                          </div>
                          <div>
                            <p className="font-bold">{chosenBike.name}</p>
                            <p className="text-stone-500 font-mono text-[11px]">Plate: {chosenBike.plateNumber || 'No Plate'} • {chosenBike.color || 'Color'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-brand-700 text-sm">${mRow.pricePerDay || chosenBike.price}/day</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Rental Dates & Schedule */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-2">
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

          {/* Section 4: Pricing, Deposit, Payment Method */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Total Rate / Day ($)</label>
              <input
                type="text"
                readOnly
                value={`$${totalDailyRate.toFixed(2)} / day`}
                className={`${inputCls} bg-stone-100 font-bold text-stone-800`}
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
              <label className={labelCls}>Total Deposit ($)</label>
              <input
                type="number"
                step="any"
                value={deposit}
                onChange={e => setDeposit(e.target.value)}
                className={`${inputCls} font-bold text-amber-800`}
              />
            </div>
            <div>
              <label className={labelCls}>Payment By (វិធីបង់ប្រាក់) <span className="text-red-500">*</span></label>
              <select
                value={paymentType}
                onChange={e => setPaymentType(e.target.value)}
                className={`${inputCls} font-bold`}
              >
                <option value="cash">💵 Cash (សាច់ប្រាក់)</option>
                <option value="aba">🏦 ABA Bank</option>
                <option value="acleda">🏦 ACLEDA</option>
                <option value="wing">📱 Wing</option>
                <option value="other">💳 Other</option>
              </select>
            </div>
          </div>

          {/* Staff Resell / Staff In Charge */}
          <div className="bg-stone-50/70 border border-stone-200/80 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-user-tag text-brand-500"></i> Staff Resell / Handled By (បុគ្គលិកលក់ / អ្នកចេញម៉ូតូ)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Staff Name (ឈ្មោះបុគ្គលិក)</label>
                <select
                  value={staffName}
                  onChange={e => {
                    setStaffName(e.target.value);
                    if (e.target.value !== 'custom') setCustomStaff('');
                  }}
                  className={inputCls}
                >
                  <option value="Reception">Reception (ទូទៅ)</option>
                  <option value="Admin">Admin</option>
                  {staff.map(s => {
                    const name = s.fullName || s.username || s.name;
                    return (
                      <option key={s.id || name} value={name}>
                        {name} ({s.role || 'Staff'})
                      </option>
                    );
                  })}
                  <option value="custom">+ Other / Enter Name (បញ្ចូលឈ្មោះផ្សេង...)</option>
                </select>
              </div>
              {staffName === 'custom' && (
                <div>
                  <label className={labelCls}>Enter Staff Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sokha, Chan..."
                    value={customStaff}
                    onChange={e => setCustomStaff(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {/* Additional Details */}
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
              <p className="text-xs text-stone-400">Total Rental Price ({selectedMotors.length} Motor{selectedMotors.length > 1 ? 's' : ''})</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-brand-400">${totalRentalPrice}</span>
                <span className="text-xs text-stone-400">({calculatedDays} days @ ${totalDailyRate.toFixed(2)}/day total)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || selectedMotors.some(m => !m.bikeId)}
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i> Save & Check Out {selectedMotors.length > 1 ? `${selectedMotors.length} Motors` : 'Motor'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ADD NEW CUSTOMER MODAL */}
      {newCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-brand-500"></i> Add New Customer (បង្កើតអតិថិជនថ្មី)
              </h3>
              <button
                type="button"
                onClick={() => setNewCustomerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 hover:text-stone-600 flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Customer Name (ឈ្មោះ) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe / គឹម សុង"
                  value={newCustForm.name}
                  onChange={e => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone / Telegram</label>
                  <input
                    type="text"
                    placeholder="0xx xxx xxx"
                    value={newCustForm.phone}
                    onChange={e => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Passport / National ID</label>
                  <input
                    type="text"
                    placeholder="Passport/ID No."
                    value={newCustForm.passportOrId}
                    onChange={e => setNewCustForm({ ...newCustForm, passportOrId: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Nationality (សញ្ជាតិ)</label>
                <input
                  type="text"
                  placeholder="e.g. Cambodian, French, American..."
                  value={newCustForm.nationality}
                  onChange={e => setNewCustForm({ ...newCustForm, nationality: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Notes (កំណត់សម្គាល់)</label>
                <textarea
                  rows="2"
                  placeholder="Hotel guest, regular customer, etc."
                  value={newCustForm.notes}
                  onChange={e => setNewCustForm({ ...newCustForm, notes: e.target.value })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(false)}
                  className={`${btnSecondary} flex-1`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className={`${btnPrimary} flex-1 flex items-center justify-center gap-1.5`}
                >
                  {savingCustomer ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
