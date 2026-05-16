import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Key, ToggleLeft, ToggleRight, Calendar, MapPin, Camera, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AxiosResponse } from 'axios';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-[#8D1B3D] text-white',
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  SALESMAN: 'bg-green-100 text-green-700',
};

const defaultForm = { name: '', email: '', password: 'DubYx@2024!', role: 'SALESMAN', phone: '', area: '' };

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string;
  checkInLatitude: number;
  checkInLongitude: number;
  checkInPhoto?: string;
  checkOutAt?: string;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutPhoto?: string;
  totalMinutes?: number;
  user: { id: string; name: string; role: string };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function AttendanceModal({ user, onClose }: { user: any; onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  const { data: records = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', user.id, month, year],
    queryFn: () => api.get('/attendance', { params: { userId: user.id, month, year } }).then((r: AxiosResponse<AttendanceRecord[]>) => r.data),
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const recordByDay: Record<number, AttendanceRecord> = {};
  records.forEach(r => {
    const d = new Date(r.date).getDate();
    recordByDay[d] = r;
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const apiBase = import.meta.env.VITE_API_URL || 'https://dubyx-backend.onrender.com';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#8D1B3D] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">{user.name}</h3>
            <p className="text-white/70 text-sm">Attendance Record</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
              <span className="font-semibold text-gray-800">{monthName}</span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="font-medium py-1">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const rec = recordByDay[day];
                const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
                const isPast = new Date(year, month - 1, day) < new Date(new Date().setHours(0,0,0,0));

                let bg = 'bg-gray-50 text-gray-400';
                if (rec?.checkOutAt) bg = 'bg-green-100 text-green-700 font-semibold cursor-pointer hover:bg-green-200';
                else if (rec) bg = 'bg-yellow-100 text-yellow-700 font-semibold cursor-pointer hover:bg-yellow-200';
                else if (isPast && !isToday) bg = 'bg-red-50 text-red-300';
                if (isToday) bg += ' ring-2 ring-[#8D1B3D]';

                return (
                  <div
                    key={day}
                    onClick={() => rec && setSelected(rec)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${bg}`}
                  >
                    <span>{day}</span>
                    {rec?.checkOutAt && <div className="w-1 h-1 bg-green-500 rounded-full mt-0.5" />}
                    {rec && !rec.checkOutAt && <div className="w-1 h-1 bg-yellow-500 rounded-full mt-0.5" />}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block" /> Full day</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded inline-block" /> Checked in only</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 rounded inline-block" /> Absent</span>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Present', value: records.length, color: 'bg-green-50 text-green-700' },
              { label: 'Full Days', value: records.filter(r => r.checkOutAt).length, color: 'bg-blue-50 text-blue-700' },
              { label: 'Avg Hours', value: records.filter(r => r.totalMinutes).length
                  ? formatDuration(Math.round(records.filter(r => r.totalMinutes).reduce((s, r) => s + (r.totalMinutes || 0), 0) / records.filter(r => r.totalMinutes).length))
                  : '-', color: 'bg-purple-50 text-purple-700' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                <div className="font-bold text-xl">{s.value}</div>
                <div className="text-xs opacity-80">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Selected Day Detail */}
          {selected && (
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">
                  {new Date(selected.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </h4>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Check In */}
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                      <Clock size={14} className="text-green-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">Check In</span>
                  </div>
                  <p className="font-bold text-green-700 text-sm">{formatTime(selected.checkInAt)}</p>
                  {selected.checkInPhoto && (
                    <img src={`${apiBase}${selected.checkInPhoto}`} alt="Check-in" className="w-full h-20 object-cover rounded-lg mt-2" />
                  )}
                  {!selected.checkInPhoto && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Camera size={12} /> No photo
                    </div>
                  )}
                  <a
                    href={mapsUrl(selected.checkInLatitude, selected.checkInLongitude)}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 mt-2 text-xs text-blue-500 hover:underline"
                  >
                    <MapPin size={11} /> View location
                  </a>
                </div>

                {/* Check Out */}
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                      <Clock size={14} className="text-red-500" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">Check Out</span>
                  </div>
                  {selected.checkOutAt ? (
                    <>
                      <p className="font-bold text-red-600 text-sm">{formatTime(selected.checkOutAt)}</p>
                      {selected.checkOutPhoto && (
                        <img src={`${apiBase}${selected.checkOutPhoto}`} alt="Check-out" className="w-full h-20 object-cover rounded-lg mt-2" />
                      )}
                      {!selected.checkOutPhoto && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Camera size={12} /> No photo
                        </div>
                      )}
                      {selected.checkOutLatitude && (
                        <a
                          href={mapsUrl(selected.checkOutLatitude, selected.checkOutLongitude!)}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 mt-2 text-xs text-blue-500 hover:underline"
                        >
                          <MapPin size={11} /> View location
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Not checked out</p>
                  )}
                </div>
              </div>

              {selected.totalMinutes && (
                <div className="mt-3 bg-blue-50 rounded-lg px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-blue-600 font-medium">Total Duration</span>
                  <span className="font-bold text-blue-700">{formatDuration(selected.totalMinutes)}</span>
                </div>
              )}
            </div>
          )}

          {/* Recent Attendance List */}
          {!selected && records.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Recent Records</h4>
              {records.slice(0, 5).map(r => (
                <div key={r.id} onClick={() => setSelected(r)} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[#8D1B3D]/30 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.checkOutAt ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <Calendar size={14} className={r.checkOutAt ? 'text-green-600' : 'text-yellow-600'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(r.checkInAt)} {r.checkOutAt ? `→ ${formatTime(r.checkOutAt)}` : '(no checkout)'}
                    </p>
                  </div>
                  {r.totalMinutes && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {formatDuration(r.totalMinutes)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [attendanceUser, setAttendanceUser] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search } }).then((r: AxiosResponse) => r.data),
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
                    <div className="flex gap-1">
                      <button onClick={() => setAttendanceUser(u)} className="p-1.5 hover:bg-purple-50 rounded text-purple-600" title="View Attendance">
                        <Calendar size={15} />
                      </button>
                      {u.id !== me?.id && u.role !== 'SUPER_ADMIN' && (
                        <>
                          <button onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title={u.isActive ? 'Deactivate' : 'Activate'}>
                            {u.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => resetPwd.mutate(u.id)} className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="Reset Password">
                            <Key size={14} />
                          </button>
                        </>
                      )}
                    </div>
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

      {/* Attendance Modal */}
      {attendanceUser && <AttendanceModal user={attendanceUser} onClose={() => setAttendanceUser(null)} />}
    </div>
  );
}
