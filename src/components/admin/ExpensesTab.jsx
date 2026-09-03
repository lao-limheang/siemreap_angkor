import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { ExpenseService } from '../../services/DatabaseService';
import PaginationControls from '../common/PaginationControls';

export default function ExpensesTab({
  auth,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  today
}) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const { showModal: showAlertModal, showConfirm } = useModal();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({
    title: '',
    category: 'Utilities',
    amount: '',
    date: today(),
    notes: ''
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const fbItems = await ExpenseService.getAll();
      if (Array.isArray(fbItems) && fbItems.length > 0) {
        setExpenses(fbItems);
      } else {
        const res = await fetch('/api/expenses', { headers: auth.headers });
        const data = await res.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Expenses fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) {
      showAlertModal('warning', 'Missing Fields', 'Please fill in title and amount.');
      return;
    }

    try {
      const expensePayload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        createdAt: Date.now()
      };

      // 1. Sync to Firestore
      await ExpenseService.create(expensePayload).catch(() => {});

      // 2. Sync to local API
      await fetch('/api/expenses', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify(expensePayload)
      }).catch(() => {});

      setShowFormModal(false);
      setForm({
        title: '',
        category: 'Utilities',
        amount: '',
        date: today(),
        notes: ''
      });
      fetchExpenses();
    } catch (err) {
      showAlertModal('error', 'Error', err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('Delete Expense', 'Are you sure you want to delete this expense record?', 'Delete', 'danger')) return;
    try {
      await ExpenseService.delete(id).catch(() => {});
      await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers: auth.headers }).catch(() => {});
      fetchExpenses();
    } catch (e) {
      showAlertModal('error', 'Error', e.message);
    }
  };

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    return expenses.filter(e => {
      const matchSearch = !q || (e.title || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [expenses, search, categoryFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalAmount = filtered.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-receipt text-brand-500"></i>
            ចំណាយប្រតិបត្តិការ (Business Expenses)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Track utilities, shop supplies, spare parts, cleaning materials, and operational costs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-stone-400">Total Expenses</p>
            <p className="text-xl font-extrabold text-rose-600">${totalAmount.toFixed(2)}</p>
          </div>
          <button onClick={() => setShowFormModal(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
            <i className="fa-solid fa-plus"></i> Add Expense
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row items-center justify-between gap-3`}>
        <div className="flex flex-1 w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search expense or notes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className={`${inputCls} pl-9 text-xs`}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className={`${inputCls} w-auto text-xs`}
          >
            <option value="all">All Categories</option>
            <option value="Utilities">Utilities</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Supplies">Supplies</option>
            <option value="Rent">Rent</option>
            <option value="Salaries">Salaries</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Title / Expense</th>
                <th className="p-4">Category</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Date</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {paginated.map(ex => (
                <tr key={ex.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">{ex.title}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md font-semibold text-[11px]">
                      {ex.category}
                    </span>
                  </td>
                  <td className="p-4 font-extrabold text-rose-600">${parseFloat(ex.amount || 0).toFixed(2)}</td>
                  <td className="p-4 text-stone-600">{ex.date}</td>
                  <td className="p-4 text-stone-500 max-w-xs">{ex.notes || '—'}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(ex.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-stone-400">
                    No business expenses recorded yet.
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

      {/* Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h4 className="font-bold text-stone-900">Add Business Expense</h4>
              <button onClick={() => setShowFormModal(false)} className="text-stone-400 hover:text-stone-600">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Title / Item <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill / Motor Oil Batch"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className={inputCls}
                  >
                    <option>Utilities (Water/Electricity/Wi-Fi)</option>
                    <option>Motor Parts & Tires</option>
                    <option>Cleaning Supplies</option>
                    <option>Staff Salary / Food</option>
                    <option>Property Rent</option>
                    <option>Marketing & Printing</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount ($) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowFormModal(false)} className={`${btnSecondary} flex-1`}>
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
