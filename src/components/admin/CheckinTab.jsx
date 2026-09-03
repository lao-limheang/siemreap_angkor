import { useState, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { syncRentalReturnToOldSystem } from '../../services/DatabaseService';
import PaginationControls from '../common/PaginationControls';

export default function CheckinTab({
  rentals,
  bikes,
  auth,
  fetchAll,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  statusBadge,
  today,
  currency
}) {
  const [search, setSearch] = useState('');
  const [selectedRental, setSelectedRental] = useState(null);
  const [returnKm, setReturnKm] = useState('');
  const [returnFuel, setReturnFuel] = useState('Full');
  const [lateFee, setLateFee] = useState('0');
  const [damageFee, setDamageFee] = useState('0');
  const [processing, setProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { showModal } = useModal();

  // Active rentals
  const activeList = rentals.filter(r => r.status === 'active' || r.status === 'rented');

  const filtered = activeList.filter(r => {
    const q = search.toLowerCase();
    return (
      (r.guestName || '').toLowerCase().includes(q) ||
      (r.bikeName || '').toLowerCase().includes(q) ||
      (r.plateNumber || '').toLowerCase().includes(q)
    );
  });

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const openReturnModal = (r) => {
    setSelectedRental(r);
    setReturnKm('');
    setReturnFuel('Full');
    setLateFee('0');
    setDamageFee('0');
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRental) return;

    setProcessing(true);
    try {
      const payload = {
        returnDate: today(),
        returnKm: Number(returnKm) || 0,
        returnFuel,
        lateFee: parseFloat(lateFee) || 0,
        damageFee: parseFloat(damageFee) || 0
      };

      const res = await fetch(`/api/rentals/${selectedRental.id}/return`, {
        method: 'PATCH',
        headers: auth.headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Realtime sync return to chafe-2026 (Live old system)
        syncRentalReturnToOldSystem(
          selectedRental.id,
          selectedRental.bikeId || selectedRental.motoId,
          payload
        ).catch(console.error);

        setSelectedRental(null);
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        showModal('error', 'Check-in Error', data.error || 'Server error');
      }
    } catch (err) {
      showModal('error', 'Error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Table Card */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-key text-brand-500"></i>
              ចូលម៉ូតូវិញ (Active Rentals / Check-In)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Inspect returned motorbikes, compute late or damage fees, refund deposits, and restore fleet status.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search guest or bike..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`${inputCls} pl-9 py-2 text-xs`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Customer</th>
                <th className="p-4">Motorbike</th>
                <th className="p-4">Checkout Date</th>
                <th className="p-4">Due Return Date</th>
                <th className="p-4">Deposit</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(r => {
                const isOverdue = new Date(r.endDate) < new Date(today());
                return (
                  <tr key={r.id} className="hover:bg-stone-50/80 transition">
                    <td className="p-4 font-bold text-stone-900">
                      <div>{r.guestName}</div>
                      {r.guestPhone && <div className="text-[11px] text-stone-400 font-normal">{r.guestPhone}</div>}
                    </td>
                    <td className="p-4 font-semibold">
                      <div>{r.bikeName}</div>
                      <div className="text-[11px] font-mono text-stone-500">{r.plateNumber || 'No Plate'}</div>
                    </td>
                    <td className="p-4 text-stone-600">{r.startDate}</td>
                    <td className="p-4">
                      <span className={isOverdue ? "text-rose-600 font-bold flex items-center gap-1" : "text-stone-600"}>
                        {isOverdue && <i className="fa-solid fa-triangle-exclamation"></i>}
                        {r.endDate}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-amber-700">${parseFloat(r.deposit || 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isOverdue ? 'Overdue' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openReturnModal(r)}
                        className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 ml-auto"
                      >
                        <i className="fa-solid fa-right-to-bracket"></i> Receive Motor
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    <i className="fa-solid fa-motorcycle text-4xl mb-2 opacity-30 block"></i>
                    No active motorbike rentals found.
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

      {/* Return Modal */}
      {selectedRental && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
              <div>
                <h4 className="font-display font-bold text-lg text-stone-900">
                  <i className="fa-solid fa-check text-brand-500 mr-2"></i> Receive Motor (ទទួលម៉ូតូ)
                </h4>
                <p className="text-xs text-stone-500">
                  {selectedRental.bikeName} — Customer: {selectedRental.guestName}
                </p>
              </div>
              <button
                onClick={() => setSelectedRental(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 hover:text-stone-600 flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4 text-xs">
              <div className="p-3.5 bg-stone-50 rounded-xl space-y-1.5 text-stone-600">
                <div className="flex justify-between"><span>Start Date:</span><span className="font-bold">{selectedRental.startDate}</span></div>
                <div className="flex justify-between"><span>Due Date:</span><span className="font-bold">{selectedRental.endDate}</span></div>
                <div className="flex justify-between"><span>Deposit Held:</span><span className="font-bold text-amber-700">${parseFloat(selectedRental.deposit || 0).toFixed(2)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Return Fuel Level</label>
                  <select
                    value={returnFuel}
                    onChange={e => setReturnFuel(e.target.value)}
                    className={inputCls}
                  >
                    <option>Full</option>
                    <option>3/4</option>
                    <option>1/2</option>
                    <option>1/4</option>
                    <option>Empty</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Final KM (Odometer)</label>
                  <input
                    type="number"
                    placeholder="e.g. 12680"
                    value={returnKm}
                    onChange={e => setReturnKm(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Late Fine ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={lateFee}
                    onChange={e => setLateFee(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Damage Fee ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={damageFee}
                    onChange={e => setDamageFee(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRental(null)}
                  className={`${btnSecondary} flex-1`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`${btnPrimary} flex-1 flex items-center justify-center gap-1.5`}
                >
                  {processing ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
