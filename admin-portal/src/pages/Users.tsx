import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Key, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-[#8D1B3D] text-white',
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  SALESMAN: 'bg-green-100 text-green-700',
};

const defaultForm = { name: '', email: '', password: 'DubYx@2024!', role: 'SALESMAN', phone: '', area: '' };

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search } }).then(r => r.data),
  });

  const createUser = useMutation({
    mutationFn: (data: typeof form) => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Staff member added!'); setShowModal(false); setForm(defaultForm); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add user'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update'),
  });

  const resetPwd = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`, { newPassword: 'DubYx@2024!' }),
    onSuccess: () => toast.success('Password reset to DubYx@2024!'),
    onError: () => toast.error('Failed to reset password'),
  });

  const availableRoles = me?.role === 'SUPER_ADMIN'
    ? ['ADMIN', 'MANAGER', 'SALESMAN']
    : ['MANAGER', 'SALESMAN'];

  return (
    <div className="space-y-5">
      <div className="flex gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="input pl-9" />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Name', 'Email', 'Role', 'Phone', 'Area', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#8D1B3D] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{u.name[0].toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[u.role]}`}>{u.role.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{u.area || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id && u.role !== 'SUPER_ADMIN' && (
                      <div className="flex gap-1">
                        <button onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => resetPwd.mutate(u.id)} className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="Reset Password">
                          <Key size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Add Staff Member</h3>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Full Name *', key: 'name', type: 'text' },
                { label: 'Email *', key: 'email', type: 'email' },
                { label: 'Phone', key: 'phone', type: 'tel' },
                { label: 'Area', key: 'area', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input">
                  {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                Default password: <strong>DubYx@2024!</strong> — staff should change on first login.
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createUser.mutate(form)} disabled={createUser.isPending} className="btn-primary flex-1">
                  {createUser.isPending ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
