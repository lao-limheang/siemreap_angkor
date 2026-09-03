import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { MaintenanceService, MotoService } from '../../services/DatabaseService';
import PaginationControls from '../common/PaginationControls';

export default function MaintenanceTab({
  bikes,
  auth,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  today
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { showModal: showAlertModal, showConfirm } = useModal();
  const [form, setForm] = useState({
    bikeId: '',
    logType: 'Oil Change',
    description: '',
    cost: '15',
    performedBy: 'Local Mechanic',
    logDate: today(),
    nextServiceDate: ''
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const fbLogs = await MaintenanceService.getAll();
      if (Array.isArray(fbLogs) && fbLogs.length > 0) {
        setLogs(fbLogs);
      } else {
        const res = await fetch('/api/maintenance', { headers: auth.headers });
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Maintenance fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bikeId) {
      showAlertModal('warning', 'Select Motorcycle', 'Please select a motorcycle.');
      return;
    }

    try {
      // Find bike details
      const selectedBike = (bikes || []).find(b => String(b.id) === String(form.bikeId));
      const logPayload = {
        ...form,
        bikeName: selectedBike?.name || `Bike #${form.bikeId}`,
        plateNumber: selectedBike?.plateNumber || '',
        createdAt: Date.now()
      };

      // 1. Sync directly to Firebase Firestore
      await MaintenanceService.create(logPayload).catch(() => {});

      // 2. Sync to local backend API
      await fetch('/api/maintenance', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify(logPayload)
      }).catch(() => {});

      // 3. Update bike status to maintenance
      if (form.bikeId) {
        await MotoService.update(form.bikeId, { status: 'maintenance' }).catch(() => {});
      }

      setShowFormModal(false);
      setForm({
        bikeId: '',
        logType: 'Oil Change',
        description: '',
        cost: '15',
        performedBy: 'Local Mechanic',
        logDate: today(),
        nextServiceDate: ''
      });
      fetchLogs();
    } catch (err) {
      showAlertModal('error', 'Error', err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('Delete Record', 'Are you sure you want to delete this maintenance record?', 'Delete', 'danger')) return;
    try {
      await MaintenanceService.delete(id).catch(() => {});
      await fetch(`/api/maintenance/${id}`, { method: 'DELETE', headers: auth.headers }).catch(() => {});
      fetchLogs();
    } catch (e) {
      showAlertModal('error', 'Error', e.message);
    }
  };

  const totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-wrench text-brand-500"></i>
            ជួសជុល & ថែទាំម៉ូតូ (Fleet Maintenance)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Log oil changes, brake pads, tire replacements, and periodic checkups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-stone-400">Total Spent</p>
            <p className="text-base font-extrabold text-stone-900">${totalCost.toFixed(2)}</p>
          </div>
          <button onClick={() => setShowFormModal(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
            <i className="fa-solid fa-plus"></i> Add Service Log
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Motorbike</th>
                <th className="p-4">Service Type</th>
                <th className="p-4">Description</th>
                <th className="p-4">Cost</th>
                <th className="p-4">Date</th>
                <th className="p-4">Mechanic</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(l => (
                <tr key={l.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">
                    <div>{l.bikeName || `Bike #${l.bikeId}`}</div>
                    <div className="text-[11px] font-mono text-stone-500">{l.plateNumber || ''}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-md font-bold text-[11px]">
                      {l.logType}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600 max-w-xs">{l.description || 'Routine maintenance'}</td>
                  <td className="p-4 font-bold text-rose-600">${parseFloat(l.cost || 0).toFixed(2)}</td>
                  <td className="p-4 text-stone-600">{l.logDate}</td>
                  <td className="p-4 text-stone-500">{l.performedBy}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))}

              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-stone-400">
                    No maintenance records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          totalItems={logs.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Add Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h4 className="font-bold text-stone-900">New Service Record</h4>
              <button onClick={() => setShowFormModal(false)} className="text-stone-400 hover:text-stone-600">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Motorcycle <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.bikeId}
                  onChange={e => setForm({ ...form, bikeId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">-- Choose motorbike --</option>
                  {bikes.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.plateNumber || 'No Plate'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Service Type</label>
                  <select
                    value={form.logType}
                    onChange={e => setForm({ ...form, logType: e.target.value })}
                    className={inputCls}
                  >
                    <option>Oil Change</option>
                    <option>Brake Pads</option>
                    <option>Tire Replacement</option>
                    <option>Battery Replacement</option>
                    <option>Chain & Sprocket</option>
                    <option>Major Engine Service</option>
                    <option>General Inspection</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cost ($)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={form.cost}
                    onChange={e => setForm({ ...form, cost: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    required
                    value={form.logDate}
                    onChange={e => setForm({ ...form, logDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mechanic</label>
                  <input
                    type="text"
                    value={form.performedBy}
                    onChange={e => setForm({ ...form, performedBy: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description / Notes</label>
                <textarea
                  rows="2"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowFormModal(false)} className={`${btnSecondary} flex-1`}>
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
