import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Camera, ChevronLeft, ChevronRight, Search, User } from 'lucide-react';
import type { AxiosResponse } from 'axios';
import api from '../services/api';

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

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Attendance() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [searchUser, setSearchUser] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Uploads are served from this origin (proxied to the API in production)
  const apiBase = '';

  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.get('/users').then((r: AxiosResponse) => r.data),
  });

  const { data: records = [], isLoading, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-all', month, year, selectedUserId],
    queryFn: () => api.get('/attendance', {
      params: { month, year, ...(selectedUserId ? { userId: selectedUserId } : {}) }
    }).then((r: AxiosResponse<AttendanceRecord[]>) => r.data),
  });

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const filteredUsers = users.filter((u: any) =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) &&
    ['SALESMAN', 'MANAGER'].includes(u.role)
  );

  // Summary stats
  const totalPresent = records.length;
  const totalFullDays = records.filter(r => r.checkOutAt).length;
  const avgMins = records.filter(r => r.totalMinutes).length > 0
    ? Math.round(records.filter(r => r.totalMinutes).reduce((s, r) => s + (r.totalMinutes || 0), 0) / records.filter(r => r.totalMinutes).length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff Attendance</h2>
          <p className="text-sm text-gray-500">Track daily check-in and check-out records</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
          <Calendar size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left: Staff filter */}
        <div className="w-full lg:w-56 flex-shrink-0 space-y-2">
          <div className="card p-3">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="Search staff..."
                className="input pl-8 text-sm py-1.5"
              />
            </div>
            <button
              onClick={() => setSelectedUserId('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-all ${!selectedUserId ? 'bg-[#8D1B3D] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              All Staff
            </button>
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {filteredUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id === selectedUserId ? '' : u.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${selectedUserId === u.id ? 'bg-[#8D1B3D]/10 text-[#8D1B3D] font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <div className="w-6 h-6 bg-[#8D1B3D] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{u.name[0]}</span>
                  </div>
                  <span className="truncate">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Main content */}
        <div className="flex-1 space-y-4">
          {/* Month navigation */}
          <div className="card p-4 flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-lg">{MONTHS[month - 1]} {year}</p>
              <p className="text-xs text-gray-400">{totalPresent} attendance records</p>
            </div>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={18} /></button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present Days', value: totalPresent, color: 'bg-green-50 text-green-700 border-green-100', icon: '✓' },
              { label: 'Full Days (In+Out)', value: totalFullDays, color: 'bg-blue-50 text-blue-700 border-blue-100', icon: '⏱' },
              { label: 'Avg Duration', value: avgMins ? fmtDuration(avgMins) : '—', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: '⌀' },
            ].map(s => (
              <div key={s.label} className={`card border p-4 ${s.color}`}>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-xs font-medium opacity-80 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="text-center py-16 text-gray-400">Loading attendance records...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-16">
                <Calendar size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No attendance records for {MONTHS[month - 1]} {year}</p>
                <p className="text-gray-300 text-sm mt-1">Staff need to check in via the mobile app</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Staff', 'Date', 'Check In', 'Check Out', 'Duration', 'Status', 'Location', 'Photos'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-[#8D1B3D] rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">{r.user.name[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-xs">{r.user.name}</p>
                              <p className="text-gray-400 text-xs">{r.user.role.replace('_', ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3">
                          <span className="text-green-700 font-semibold">{fmt(r.checkInAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.checkOutAt
                            ? <span className="text-red-600 font-semibold">{fmt(r.checkOutAt)}</span>
                            : <span className="text-gray-300 text-xs">Not checked out</span>}
                        </td>
                        <td className="px-4 py-3">
                          {r.totalMinutes
                            ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">{fmtDuration(r.totalMinutes)}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {r.checkOutAt
                            ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Complete</span>
                            : <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">In Progress</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <a href={mapsUrl(r.checkInLatitude, r.checkInLongitude)} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                              <MapPin size={11} /> In
                            </a>
                            {r.checkOutLatitude && (
                              <a href={mapsUrl(r.checkOutLatitude, r.checkOutLongitude!)} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-red-400 hover:underline">
                                <MapPin size={11} /> Out
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {r.checkInPhoto && (
                              <button onClick={() => setPhotoModal(`${apiBase}${r.checkInPhoto}`)}
                                className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                                <Camera size={11} /> In
                              </button>
                            )}
                            {r.checkOutPhoto && (
                              <button onClick={() => setPhotoModal(`${apiBase}${r.checkOutPhoto}`)}
                                className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                                <Camera size={11} /> Out
                              </button>
                            )}
                            {!r.checkInPhoto && !r.checkOutPhoto && <span className="text-gray-300 text-xs">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPhotoModal(null)}>
          <div className="relative max-w-sm w-full">
            <button onClick={() => setPhotoModal(null)} className="absolute -top-10 right-0 text-white/80 hover:text-white">
              <span className="text-2xl">×</span>
            </button>
            <img src={photoModal} alt="Check-in photo" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
