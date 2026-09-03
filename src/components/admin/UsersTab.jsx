import { useState, useEffect, useCallback } from 'react';

export default function UsersTab({
  auth,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  btnDanger
}) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'receptionist',
    phone: ''
  });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff', { headers: auth.headers });
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      alert('Username and password are required.');
      return;
    }

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ username: '', password: '', fullName: '', role: 'receptionist', phone: '' });
        fetchStaff();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to create user account.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this staff user?')) return;
    try {
      await fetch(`/api/staff/${id}`, { method: 'DELETE', headers: auth.headers });
      fetchStaff();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={`${cardCls} p-5 flex items-center justify-between`}>
        <div>
          <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-users-gear text-brand-500"></i>
            គ្រប់គ្រងបុគ្គលិក (Staff & User Accounts)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Create system logins for receptionists, mechanics, and managers.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
          <i className="fa-solid fa-user-plus"></i> Add Staff User
        </button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-200">
                <th className="p-4">Name</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {staff.map(u => (
                <tr key={u.id} className="hover:bg-stone-50/80 transition">
                  <td className="p-4 font-bold text-stone-900">{u.fullName || u.username}</td>
                  <td className="p-4 font-mono text-stone-500">{u.username}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md font-bold text-[10px] uppercase tracking-wider">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600">{u.phone || '—'}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                      {u.status || 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                      title="Remove"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))}

              {staff.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-stone-400">
                    No custom staff users added. Default admin account is active.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h4 className="font-bold text-stone-900">Add New Staff Account</h4>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sokha Chan"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className={inputCls}
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="manager">Manager</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="cleaner">Housekeeper</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    placeholder="0xx xxx xxx"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className={`${btnSecondary} flex-1`}>
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
