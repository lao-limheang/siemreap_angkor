import React, { useState, useMemo } from 'react';
import { OccupancyService, RoomService, InvoiceService } from '../../services/DatabaseService';

export default function RoomCheckoutModal({
  isOpen,
  onClose,
  occupancy,
  relatedOccupancies = [],
  rooms = [],
  settings = {},
  auth,
  currency = (v) => `$${Number(v || 0).toFixed(2)}`,
  onCheckoutSuccess,
  onCheckoutSuccessAndPrint
}) {
  if (!isOpen || !occupancy) return null;

  const pricingTax = settings.pricing_tax || {};
  const exchangeRate = Number(pricingTax.exchangeRate) || 4000;

  const todayStr = new Date().toISOString().split('T')[0];
  const allStays = relatedOccupancies && relatedOccupancies.length > 0 ? relatedOccupancies : [occupancy];
  const isMultiRoom = allStays.length > 1;

  const [checkoutAllRooms, setCheckoutAllRooms] = useState(isMultiRoom);
  const [nextRoomStatus, setNextRoomStatus] = useState('cleaning');
  const [paymentMethod, setPaymentMethod] = useState('aba'); // cash | aba | card
  const [extraServicesFee, setExtraServicesFee] = useState(0);
  const [extrasNote, setExtrasNote] = useState('');
  const [damageLateFee, setDamageLateFee] = useState(0);
  const [damageNote, setDamageNote] = useState('');
  const [discount, setDiscount] = useState(0);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine active stays to check out
  const targetStays = checkoutAllRooms ? allStays : [occupancy];

  // Calculate nights
  const checkInDate = occupancy.checkInDate || todayStr;
  const actualCheckOut = todayStr;
  let nights = 1;
  if (checkInDate && actualCheckOut) {
    const d1 = new Date(checkInDate);
    const d2 = new Date(actualCheckOut);
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0) nights = diff;
  }

  // Calculate room charges
  const roomLineItems = useMemo(() => {
    return targetStays.map(stay => {
      const roomObj = rooms.find(r =>
        (stay.roomId && String(r.id) === String(stay.roomId)) ||
        (stay.roomName && (r.name === stay.roomName || `Room ${r.name}` === stay.roomName || r.name === String(stay.roomName).replace(/^Room\s*#?/i, '')))
      ) || {};
      const rate = Number(stay.price || roomObj.price || roomObj.rate || 25);
      const total = rate * nights;
      return {
        id: stay.id,
        roomId: stay.roomId || roomObj.id,
        roomName: stay.roomName || roomObj.name || (roomObj.id ? `Room ${roomObj.id}` : `Room #${stay.roomId}`),
        floor: roomObj.floor || '1',
        bedType: roomObj.bedType || `${stay.bedCount || roomObj.bedCount || 1} Bed`,
        rate,
        nights,
        total
      };
    });
  }, [targetStays, rooms, nights]);

  const roomChargesSubtotal = roomLineItems.reduce((sum, item) => sum + item.total, 0);
  const totalExtras = Number(extraServicesFee || 0);
  const totalDamageLate = Number(damageLateFee || 0);
  const totalDiscount = Number(discount || 0);

  const grandTotal = Math.max(0, roomChargesSubtotal + totalExtras + totalDamageLate - totalDiscount);
  const grandTotalKhr = grandTotal * exchangeRate;

  const handleConfirmCheckout = async (andPrint = false) => {
    setIsSubmitting(true);
    try {
      const body = {
        nextRoomStatus,
        checkoutRelated: checkoutAllRooms && isMultiRoom,
        relatedOccupancyIds: targetStays.map(s => s.id),
        paymentMethod,
        notes: checkoutNotes,
        extraServicesFee,
        extrasNote,
        damageLateFee,
        discount,
        totalAmount: grandTotal
      };

      // Write to Firebase (shared cloud) first
      if (occupancy.id) {
        await OccupancyService.update(occupancy.id, {
          ...body,
          status: 'checked_out',
          checkOutActual: actualCheckOut,
          updatedAt: Date.now()
        }).catch(e => console.warn('Firebase checkout update:', e));
      }

      // Also mark all related stays as checked_out
      if (Array.isArray(targetStays) && targetStays.length > 0) {
        for (const s of targetStays) {
          if (s.id && String(s.id) !== String(occupancy.id)) {
            await OccupancyService.update(s.id, {
              status: 'checked_out',
              checkOutActual: actualCheckOut,
              updatedAt: Date.now()
            }).catch(() => {});
          }
        }
      }

      // Also update Room status in Firebase
      targetStays.forEach(s => {
        const matchedRoom = rooms.find(r => 
          (s.roomId && String(r.id) === String(s.roomId)) ||
          (s.roomName && (r.name === s.roomName || `Room ${r.name}` === s.roomName || r.name === String(s.roomName).replace(/^Room\s*#?/i, '')))
        );
        if (matchedRoom?.id) {
          RoomService.update(matchedRoom.id, { status: nextRoomStatus }).catch(() => {});
        } else if (s.roomId) {
          RoomService.update(s.roomId, { status: nextRoomStatus }).catch(() => {});
        }
      });

      // Also sync to SQLite API (server-side backup, non-blocking)
      fetch(`/api/room-occupancy/${occupancy.id}/checkout`, {
        method: 'PATCH',
        ...auth,
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(body)
      }).catch(err => console.warn('SQLite checkout sync notice:', err));

      // Prepare consolidated folio data for printing
      const customItems = [
        ...roomLineItems.map(item => ({
          description: `Room ${item.roomName} (${item.bedType})`,
          subtitle: `Floor ${item.floor} • ${item.nights} night(s) @ $${item.rate}/night`,
          qty: item.nights,
          rate: item.rate,
          total: item.total
        }))
      ];

      if (totalExtras > 0) {
        customItems.push({
          description: extrasNote ? `Extra Services: ${extrasNote}` : 'Additional Hotel / Minibar Services',
          subtitle: 'Guest requested services',
          qty: 1,
          rate: totalExtras,
          total: totalExtras
        });
      }

      if (totalDamageLate > 0) {
        customItems.push({
          description: damageNote ? `Damage / Late Fee: ${damageNote}` : 'Late Check-out / Inspection Fee',
          subtitle: 'Incidental charge',
          qty: 1,
          rate: totalDamageLate,
          total: totalDamageLate
        });
      }

      const consolidatedInvoiceData = {
        ...occupancy,
        checkInDate,
        checkOutDate: actualCheckOut,
        customItems,
        discount: totalDiscount,
        totalAmount: grandTotal,
        paymentMethod,
        paymentStatus: 'paid',
        invoiceNumber: `INV-CO-${occupancy.id}-${todayStr.replace(/-/g, '')}`,
        roomNames: targetStays.map(s => s.roomName || s.roomId).join(', ')
      };

      // Save to Firebase Invoices collection for real-time tracking
      InvoiceService.create({
        ...consolidatedInvoiceData,
        type: 'room',
        invoiceType: 'room',
        createdAt: Date.now()
      }).catch(err => console.warn('Invoice save notice:', err));

      if (andPrint && onCheckoutSuccessAndPrint) {
        onCheckoutSuccessAndPrint(consolidatedInvoiceData, targetStays);
      } else if (onCheckoutSuccess) {
        onCheckoutSuccess(consolidatedInvoiceData);
      }

      onClose();
    } catch (err) {
      alert(`Check-out failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-xs overflow-y-auto anim-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col modal-pop cursor-default"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center text-base">
              <i className="fa-solid fa-receipt"></i>
            </span>
            <div>
              <h3 className="font-bold text-sm text-white">
                Guest Check-out & Settlement (ការទូទាត់ និងចាកចេញ)
              </h3>
              <p className="text-[11px] text-stone-300">
                Verify stay records, calculate balance, and set room turnover status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] text-xs text-stone-800 font-sans">
          {/* Guest Meta Bar */}
          <div className="p-4 bg-stone-50 border border-stone-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 uppercase shadow-2xs">
                {(occupancy.guestName || 'G').slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-stone-900">{occupancy.guestName}</h4>
                  <span className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 font-bold text-[10px]">
                    {occupancy.guestNationality || 'Guest'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-stone-500 mt-0.5 text-[11px]">
                  <span>📞 {occupancy.guestPhone || 'No Phone'}</span>
                  {occupancy.passportOrId && <span>🪪 ID: <strong>{occupancy.passportOrId}</strong></span>}
                </div>
              </div>
            </div>

            {isMultiRoom && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs">
                <i className="fa-solid fa-hotel"></i>
                <span>{allStays.length} Rooms Occupied</span>
              </span>
            )}
          </div>

          {/* Stay & Room Line Items */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between font-bold text-stone-700 text-[11px]">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-door-open text-brand-600"></i>
                <span>Occupied Room(s) & Duration</span>
              </span>
              <span className="font-mono text-brand-700">
                Duration: {nights} Night(s) ({checkInDate} ➔ {actualCheckOut})
              </span>
            </div>

            <div className="divide-y divide-stone-100 bg-white">
              {roomLineItems.map(item => (
                <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-stone-50/50">
                  <div>
                    <span className="font-bold text-stone-900 text-xs">Room {item.roomName}</span>
                    <span className="text-[11px] text-stone-500 ml-2">
                      (Floor {item.floor} • {item.bedType})
                    </span>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      Rate: ${item.rate}/night × {item.nights} night(s)
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-stone-900 text-xs">
                    {currency(item.total)}
                  </div>
                </div>
              ))}
            </div>

            {isMultiRoom && (
              <div className="p-3 bg-indigo-50/50 border-t border-indigo-100 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900">
                  <input
                    type="checkbox"
                    checked={checkoutAllRooms}
                    onChange={e => setCheckoutAllRooms(e.target.checked)}
                    className="rounded border-indigo-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Check out all {allStays.length} rooms together (ចេញបន្ទប់ទាំងអស់ក្នុងពេលតែមួយ)</span>
                </label>
                <span className="text-[11px] text-indigo-700 font-mono">
                  {targetStays.length} of {allStays.length} selected
                </span>
              </div>
            )}
          </div>

          {/* Charges, Adjustments & Discounts */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              Settlement Charges & Adjustments (USD)
            </span>

            {/* Extra Services */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <label className="text-stone-600 font-medium">Extra Services / Minibar:</label>
              <input
                type="text"
                placeholder="Description (e.g. Laundry, Drinks)"
                value={extrasNote}
                onChange={e => setExtrasNote(e.target.value)}
                className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-brand-500"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraServicesFee}
                  onChange={e => setExtraServicesFee(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-800 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Damage / Late Fee */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <label className="text-stone-600 font-medium">Damage / Late Fee:</label>
              <input
                type="text"
                placeholder="Reason (e.g. Keycard replacement, late return)"
                value={damageNote}
                onChange={e => setDamageNote(e.target.value)}
                className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-brand-500"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={damageLateFee}
                  onChange={e => setDamageLateFee(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-amber-700 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <label className="text-stone-600 font-medium">Special Discount:</label>
              <span className="text-[11px] text-stone-400 italic">Deducted from balance</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">-$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold text-rose-600 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Total Balance Calculation Box */}
            <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Due to Collect</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black text-brand-700 font-mono">{currency(grandTotal)}</span>
                  <span className="text-xs text-stone-500 font-mono font-bold">
                    ≈ {grandTotalKhr.toLocaleString()} ៛ ({exchangeRate.toLocaleString()}៛/$)
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'cash', label: 'Cash (សាច់ប្រាក់)', icon: 'fa-money-bill' },
                  { id: 'aba', label: 'ABA KHQR', icon: 'fa-qrcode' },
                  { id: 'card', label: 'Credit Card', icon: 'fa-credit-card' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs border ${
                      paymentMethod === m.id
                        ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <i className={`fa-solid ${m.icon} text-[11px]`}></i>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Next Room Turnover Status */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/70 rounded-2xl">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-2">
              Room Status After Check-out (ស្ថានភាពបន្ទប់បន្ទាប់ពីភ្ញៀវចាកចេញ)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'cleaning', label: 'Cleaning (កំពុងសម្អាត)', icon: 'fa-broom', desc: 'Needs housekeeping' },
                { id: 'vacant', label: 'Vacant (ទំនេរភ្លាមៗ)', icon: 'fa-circle-check', desc: 'Ready for new guests' },
                { id: 'maintenance', label: 'Maintenance (ជួសជុល)', icon: 'fa-wrench', desc: 'Repairs or service needed' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNextRoomStatus(opt.id)}
                  className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    nextRoomStatus === opt.id
                      ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-400'
                      : 'bg-white/60 hover:bg-white border-stone-200 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                    <i className={`fa-solid ${opt.icon} text-amber-600`}></i>
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel (បោះបង់)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirmCheckout(false)}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>{isSubmitting ? 'Checking Out...' : 'Complete Check-out'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirmCheckout(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              title="Check out and immediately open printable invoice / POS folio"
            >
              <i className="fa-solid fa-print"></i>
              <span>{isSubmitting ? 'Processing...' : 'Check Out & Print Invoice (A4 / POS)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
