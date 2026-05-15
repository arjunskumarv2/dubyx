import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, MapPin, User, GripVertical, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function RouteManagement() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [showCheckIns, setShowCheckIns] = useState(false);
  const [form, setForm] = useState({ name: '', salesmanId: '', stops: [] as { customerId: string; stopOrder: number }[] });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.get('/routes').then(r => r.data),
  });

  const { data: salesmen = [] } = useQuery({
    queryKey: ['users-salesmen'],
    queryFn: () => api.get('/users', { params: { role: 'SALESMAN' } }).then(r => r.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.get('/customers').then(r => r.data),
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkins'],
    queryFn: () => api.get('/checkins').then(r => r.data),
    enabled: showCheckIns,
  });

  const createRoute = useMutation({
    mutationFn: (data: typeof form) => api.post('/routes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route created!'); setShowCreate(false); setForm({ name: '', salesmanId: '', stops: [] }); },
    onError: () => toast.error('Failed to create route'),
  });

  const deleteRoute = useMutation({
    mutationFn: (id: string) => api.delete(`/routes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route deleted'); },
    onError: () => toast.error('Failed to delete route'),
  });

  const addStop = (customerId: string) => {
    if (form.stops.find(s => s.customerId === customerId)) return;
    setForm(f => ({ ...f, stops: [...f.stops, { customerId, stopOrder: f.stops.length + 1 }] }));
  };

  const removeStop = (customerId: string) => {
    setForm(f => ({ ...f, stops: f.stops.filter(s => s.customerId !== customerId).map((s, i) => ({ ...s, stopOrder: i + 1 })) }));
  };

  const getCustomerName = (id: string) => customers.find((c: any) => c.id === id)?.shopName || id;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setShowCheckIns(false)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!showCheckIns ? 'bg-[#8D1B3D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Routes
          </button>
          <button onClick={() => setShowCheckIns(true)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showCheckIns ? 'bg-[#8D1B3D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Camera size={14} /> Check-ins
          </button>
        </div>
        {!showCheckIns && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Create Route
          </button>
        )}
      </div>

      {/* Routes list */}
      {!showCheckIns && (
        <div className="space-y-3">
          {isLoading && <div className="text-center py-12 text-gray-400">Loading...</div>}
          {routes.map((route: any) => (
            <div key={route.id} className="card overflow-hidden">
              <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#8D1B3D]/10 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-[#8D1B3D]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{route.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1"><User size={12} />{route.salesman?.name} • {route.stops?.length || 0} stops</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete this route?')) deleteRoute.mutate(route.id); }}
                    className="text-red-400 hover:text-red-600 p-1.5">
                    <Trash2 size={15} />
                  </button>
                  {expandedRoute === route.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
              {expandedRoute === route.id && route.stops?.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 space-y-2 bg-gray-50/50">
                  {route.stops.map((stop: any) => (
                    <div key={stop.id} className="flex items-center gap-3 text-sm">
                      <GripVertical size={14} className="text-gray-300" />
                      <span className="w-5 h-5 bg-[#8D1B3D] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{stop.stopOrder}</span>
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{stop.customer?.shopName}</span>
                        <span className="text-gray-400 ml-2">{stop.customer?.area}</span>
                      </div>
                      <span className="text-xs text-gray-400">{stop.customer?.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!isLoading && routes.length === 0 && <div className="text-center py-16 text-gray-400">No routes created yet</div>}
        </div>
      )}

      {/* Check-ins list */}
      {showCheckIns && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{['Staff', 'Customer', 'Area', 'Time', 'GPS', 'Selfie'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {checkIns.map((ci: any) => (
                <tr key={ci.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{ci.user?.name}</td>
                  <td className="px-4 py-3">{ci.customer?.shopName}</td>
                  <td className="px-4 py-3 text-gray-500">{ci.customer?.area}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(ci.checkedInAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{ci.latitude?.toFixed(4)}, {ci.longitude?.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    {ci.selfiePath
                      ? <a href={`http://192.168.31.49:5001${ci.selfiePath}`} target="_blank" rel="noreferrer" className="text-[#8D1B3D] hover:underline text-xs flex items-center gap-1"><Camera size={12} />View</a>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {checkIns.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No check-ins yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Route Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
              <h3 className="text-white font-bold text-lg">Create Route</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Al Wakra Morning Route" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Salesman *</label>
                <select value={form.salesmanId} onChange={e => setForm({ ...form, salesmanId: e.target.value })} className="input">
                  <option value="">Select salesman</option>
                  {salesmen.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.area || 'No area'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Customer Stops</label>
                <select onChange={e => { if (e.target.value) addStop(e.target.value); e.target.value = ''; }} className="input" defaultValue="">
                  <option value="">Select customer to add…</option>
                  {customers.filter((c: any) => !form.stops.find(s => s.customerId === c.id)).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.shopName} — {c.area}</option>
                  ))}
                </select>
              </div>
              {form.stops.length > 0 && (
                <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Stops ({form.stops.length})</p>
                  {form.stops.map((s, i) => (
                    <div key={s.customerId} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 bg-[#8D1B3D] text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="flex-1 font-medium">{getCustomerName(s.customerId)}</span>
                      <button onClick={() => removeStop(s.customerId)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createRoute.mutate(form)} disabled={createRoute.isPending || !form.name || !form.salesmanId} className="btn-primary flex-1">
                  {createRoute.isPending ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
