import { useState, useEffect, useCallback } from 'react';
import { createSocket } from '../../services/socket';
import { StaffService } from '../../services/DatabaseService';

export default function UsersTab({
  auth,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  fetchAll
}) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'receptionist',
    phone: '',
    status: 'active'
  });

  const getHeaders = useCallback(() => {
    return auth?.headers || {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
  }, [auth]);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      // Read from Firebase first, fallback to API
      const fbData = await StaffService.getAll().catch(() => []);
      if (fbData && fbData.length > 0) {
        setStaff(fbData);
      } else {
        const res = await fetch('/api/staff', { headers: getHeaders() });
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Real-time synchronization
  useEffect(() => {
    const socket = createSocket();
    const handleUpdate = () => {
      fetchStaff();
      fetchAll?.();
    };

    socket.on('staff_updated', handleUpdate);

    return () => {
      socket.off('staff_updated', handleUpdate);
      socket.disconnect();
    };
  }, [fetchStaff, fetchAll]);

  const handleOpenAdd = () => {
    setForm({
      username: '',
      password: '',
      fullName: '',
      role: 'receptionist',
      phone: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingStaff({
      id: user.id,
      fullName: user.fullName || '',
      username: user.username || '',
      role: user.role || 'receptionist',
      phone: user.phone || '',
      status: user.status || 'active',
      password: ''
    });
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      alert('Username and password are required.');
      return;
    }

    try {
      // Write to Firebase (shared cloud) first
      await StaffService.create({ ...form, createdAt: Date.now() });
      // Also sync to API (server-side backup, non-blocking)
      fetch('/api/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(form)
      }).catch(e => console.warn('API staff create sync:', e));

      setShowModal(false);
      setForm({ username: '', password: '', fullName: '', role: 'receptionist', phone: '', status: 'active' });
      fetchStaff();
      fetchAll?.();
    } catch (err) {
      alert(err.message || 'Failed to create user account.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff.username.trim()) {
      alert('Username is required.');
      return;
    }

    try {
      // Write to Firebase (shared cloud) first
      await StaffService.update(editingStaff.id, { ...editingStaff, updatedAt: Date.now() });
      // Also sync to API (server-side backup, non-blocking)
      fetch(`/api/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editingStaff)
      }).catch(e => console.warn('API staff update sync:', e));

      setShowEditModal(false);
      setEditingStaff(null);
      fetchStaff();
      fetchAll?.();
    } catch (err) {
      alert(err.message || 'Failed to update user account.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove ${name || 'this staff account'}?`)) return;
    try {
      // Delete from Firebase (shared cloud) first
      await StaffService.delete(id);
      // Also sync to API (server-side backup, non-blocking)
      fetch(`/api/staff/${id}`, { method: 'DELETE', headers: getHeaders() }).catch(e => console.warn('API staff delete sync:', e));

      fetchStaff();
      fetchAll?.();
    } catch (e) {
      alert(e.message || 'Failed to delete staff user.');
    }
  };

  const getRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'receptionist':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'mechanic':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'cleaner':
      case 'housekeeper':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header Card */}
      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-users-gear text-brand-500"></i>
            គ្រប់គ្រងបុគ្គលិក (Staff & User Accounts)
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage system logins, roles, and contacts for receptionists, mechanics, cleaners, and managers.
          </p>
        </div>

        <button onClick={handleOpenAdd} className={`${btnPrimary} flex items-center justify-center gap-1.5 shrink-0`}>
          <i className="fa-solid fa-user-plus"></i> Add Staff User
        </button>
      </div>

      {/* Users Table Card */}
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
                  <td className="p-4">
                    <div className="font-bold text-stone-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-brand-100">
                        {(u.fullName || u.username || 'U').charAt(0)}
                      </div>
                      <span>{u.fullName || u.username}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-stone-500">{u.username}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider border ${getRoleBadge(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600 font-mono">{u.phone || '—'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      u.status === 'inactive'
                        ? 'bg-stone-100 text-stone-600'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'inactive' ? 'bg-stone-400' : 'bg-emerald-500'}`}></span>
                      {u.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-600 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 rounded-lg transition font-medium flex items-center gap-1"
                        title="Edit User"
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                        <span className="hidden sm:inline text-[11px]">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id, u.fullName || u.username)}
                        className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-lg transition font-medium flex items-center gap-1"
                        title="Remove User"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                        <span className="hidden sm:inline text-[11px]">Delete</span>
                      </button>
                    </div>
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

              {loading && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-stone-400">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Loading staff list...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-brand-500"></i>
                Add New Staff Account
              </h4>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sok Kimsreng"
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
                    placeholder="e.g. sokkimsreng"
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
                    placeholder="••••••••"
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
                    <option value="admin">Admin</option>
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

              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
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

      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i>
                Edit Staff Account
              </h4>
              <button onClick={() => { setShowEditModal(false); setEditingStaff(null); }} className="text-stone-400 hover:text-stone-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sok Kimsreng"
                  value={editingStaff.fullName}
                  onChange={e => setEditingStaff({ ...editingStaff, fullName: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editingStaff.username}
                    onChange={e => setEditingStaff({ ...editingStaff, username: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>New Password <span className="text-stone-400 font-normal">(Optional)</span></label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep"
                    value={editingStaff.password}
                    onChange={e => setEditingStaff({ ...editingStaff, password: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role</label>
                  <select
                    value={editingStaff.role}
                    onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value })}
                    className={inputCls}
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="manager">Manager</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="cleaner">Housekeeper</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    placeholder="0xx xxx xxx"
                    value={editingStaff.phone}
                    onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={editingStaff.status}
                  onChange={e => setEditingStaff({ ...editingStaff, status: e.target.value })}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingStaff(null); }}
                  className={`${btnSecondary} flex-1`}
                >
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  Update Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
