import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, CalendarDays, User, Truck, Pencil, ChevronDown, ChevronUp,
  AlertTriangle, MapPin, Clock, Play, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AxiosResponse } from 'axios';
import api from '../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type PlanDay = { dayOfWeek: number; routeId: string; startTime?: string; notes?: string };
type PlanForm = {
  name: string;
  salesmanId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  notes: string;
  days: PlanDay[];
};

const emptyForm: PlanForm = { name: '', salesmanId: '', vehicleId: '', startDate: '', endDate: '', notes: '', days: [] };

const EMERGENCY_REASONS = [
  'Emergency stock delivery — stock not available at shop',
  'Urgent customer request',
  'Urgent payment collection',
  'Vehicle breakdown / route change',
  'Other',
];

const today = () => new Date().toISOString().slice(0, 10);

export default function JourneyPlans() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'plans' | 'board'>('plans');
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [boardDate, setBoardDate] = useState(today());
  const [showEmergency, setShowEmergency] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['journey-plans'],
    queryFn: () => api.get('/journey-plans').then((r: AxiosResponse) => r.data),
  });
  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.get('/routes').then((r: AxiosResponse) => r.data),
  });
  const { data: salesmen = [] } = useQuery({
    queryKey: ['users-salesmen'],
    queryFn: () => api.get('/users', { params: { role: 'SALESMAN' } }).then((r: AxiosResponse) => r.data),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles').then((r: AxiosResponse) => r.data),
  });
  const { data: board } = useQuery({
    queryKey: ['journey-board', boardDate],
    queryFn: () => api.get('/journeys/board', { params: { date: boardDate } }).then((r: AxiosResponse) => r.data),
    enabled: tab === 'board',
  });

  const savePlan = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: PlanForm }) =>
      id ? api.put(`/journey-plans/${id}`, data) : api.post('/journey-plans', data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['journey-plans'] });
      qc.invalidateQueries({ queryKey: ['journey-board'] });
      toast.success(vars.id ? 'Journey plan updated' : 'Journey plan created');
      setShowCreate(false); setEditPlan(null); setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save plan'),
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => api.delete(`/journey-plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journey-plans'] }); toast.success('Plan deactivated'); },
    onError: () => toast.error('Failed to delete plan'),
  });

  const createEmergency = useMutation({
    mutationFn: (data: any) => api.post('/journeys/emergency', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journey-board'] });
      toast.success('Emergency journey created');
      setShowEmergency(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create emergency journey'),
  });

  const routesBySalesman = useMemo(() => {
    if (!form.salesmanId) return routes as any[];
    const own = (routes as any[]).filter(r => (r.salesman?.id || r.salesmanId) === form.salesmanId);
    return own.length > 0 ? own : (routes as any[]);
  }, [routes, form.salesmanId]);

  const openCreate = () => { setForm(emptyForm); setShowCreate(true); };
  const openEdit = (plan: any) => {
    setForm({
      name: plan.name,
      salesmanId: plan.salesman?.id || plan.salesmanId || '',
      vehicleId: plan.vehicle?.id || plan.vehicleId || '',
      startDate: plan.startDate ? plan.startDate.slice(0, 10) : '',
      endDate: plan.endDate ? plan.endDate.slice(0, 10) : '',
      notes: plan.notes || '',
      days: (plan.days || []).map((d: any) => ({
        dayOfWeek: d.dayOfWeek, routeId: d.route?.id || d.routeId, startTime: d.startTime || '', notes: d.notes || '',
      })),
    });
    setEditPlan(plan);
  };

  const statusChip = (status: string) => {
    const map: Record<string, string> = {
      IN_PROGRESS: 'bg-blue-50 text-blue-600',
      COMPLETED: 'bg-green-50 text-green-600',
      NOT_STARTED: 'bg-amber-50 text-amber-600',
      NO_PLAN: 'bg-gray-100 text-gray-500',
      PENDING: 'bg-amber-50 text-amber-600',
      CANCELLED: 'bg-red-50 text-red-500',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-500'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab('plans')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'plans' ? 'bg-[#8D1B3D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Weekly Plans
          </button>
          <button onClick={() => setTab('board')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'board' ? 'bg-[#8D1B3D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Daily Journeys
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEmergency(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
            <AlertTriangle size={15} /> Emergency Journey
          </button>
          {tab === 'plans' && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Create Plan
            </button>
          )}
        </div>
      </div>

      {/* Weekly plans */}
      {tab === 'plans' && (
        <div className="space-y-3">
          {isLoading && <div className="text-center py-12 text-gray-400">Loading...</div>}
          {(plans as any[]).map(plan => (
            <div key={plan.id} className="card overflow-hidden">
              <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#8D1B3D]/10 rounded-lg flex items-center justify-center">
                    <CalendarDays size={16} className="text-[#8D1B3D]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-3">
                      <span className="flex items-center gap-1"><User size={12} />{plan.salesman?.name}</span>
                      {plan.vehicle && <span className="flex items-center gap-1"><Truck size={12} />{plan.vehicle.vehicleNumber}</span>}
                      <span>{plan.days?.length || 0} days / week</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex gap-1">
                    {DAY_SHORT.map((d, i) => {
                      const on = (plan.days || []).some((pd: any) => pd.dayOfWeek === i);
                      return (
                        <span key={d} className={`w-9 text-center text-[10px] font-semibold py-1 rounded ${on ? 'bg-[#8D1B3D] text-white' : 'bg-gray-100 text-gray-400'}`}>{d}</span>
                      );
                    })}
                  </div>
                  <button onClick={e => { e.stopPropagation(); openEdit(plan); }} className="text-blue-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg" title="Edit plan">
                    <Pencil size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); if (confirm('Deactivate this journey plan?')) deletePlan.mutate(plan.id); }} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg" title="Delete plan">
                    <Trash2 size={14} />
                  </button>
                  {expanded === plan.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expanded === plan.id && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 space-y-2">
                  {DAYS.map((day, i) => {
                    const pd = (plan.days || []).find((d: any) => d.dayOfWeek === i);
                    return (
                      <div key={day} className="flex items-center gap-3 text-sm py-1">
                        <span className="w-24 font-medium text-gray-600">{day}</span>
                        {pd ? (
                          <>
                            <span className="flex items-center gap-1 font-medium text-gray-800"><MapPin size={12} className="text-[#8D1B3D]" />{pd.route?.name}</span>
                            <span className="text-gray-400">{pd.route?.stops?.length || 0} stops</span>
                            {pd.startTime && <span className="text-gray-400 flex items-center gap-1"><Clock size={11} />{pd.startTime}</span>}
                          </>
                        ) : (
                          <span className="text-gray-300">Off</span>
                        )}
                      </div>
                    );
                  })}
                  {plan.notes && <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">{plan.notes}</p>}
                </div>
              )}
            </div>
          ))}
          {!isLoading && (plans as any[]).length === 0 && (
            <div className="text-center py-16 text-gray-400">
              No journey plans yet — create one to schedule a van route for each weekday.
            </div>
          )}
        </div>
      )}

      {/* Daily board */}
      {tab === 'board' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="date" value={boardDate} onChange={e => setBoardDate(e.target.value)} className="input w-48" />
            {board && <span className="text-sm text-gray-500">{board.dayName}</span>}
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Staff', 'Planned Route', 'Status', 'Journeys', 'Progress'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(board?.board || []).map((row: any) => {
                  const stops = row.journeys.flatMap((j: any) => j.stops || []);
                  const visited = stops.filter((s: any) => s.status === 'VISITED').length;
                  return (
                    <tr key={row.salesman.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 font-medium">{row.salesman.name}<div className="text-xs text-gray-400">{row.salesman.area || '—'}</div></td>
                      <td className="px-4 py-3">
                        {row.plannedRoute
                          ? <><span className="font-medium text-gray-800">{row.plannedRoute.name}</span><div className="text-xs text-gray-400">{row.plannedRoute.stops} stops{row.planDay?.startTime ? ` • ${row.planDay.startTime}` : ''}</div></>
                          : <span className="text-gray-300">No plan for {board?.dayName}</span>}
                      </td>
                      <td className="px-4 py-3">{statusChip(row.status)}</td>
                      <td className="px-4 py-3 space-y-1">
                        {row.journeys.length === 0 && <span className="text-gray-300">—</span>}
                        {row.journeys.map((j: any) => (
                          <div key={j.id} className="flex items-center gap-2 text-xs">
                            {j.type === 'EMERGENCY'
                              ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">EMERGENCY</span>
                              : <span className="px-1.5 py-0.5 rounded bg-[#8D1B3D]/10 text-[#8D1B3D] font-semibold">PLANNED</span>}
                            <span className="text-gray-600">{j.journeyNumber}</span>
                            {j.status === 'IN_PROGRESS' ? <Play size={11} className="text-blue-500" /> : j.status === 'COMPLETED' ? <CheckCircle2 size={11} className="text-green-500" /> : null}
                            {j.reason && <span className="text-gray-400 truncate max-w-[220px]">{j.reason}</span>}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{stops.length > 0 ? `${visited}/${stops.length} visited` : '—'}</td>
                    </tr>
                  );
                })}
                {(board?.board || []).length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-400">No staff found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editPlan) && (
        <PlanFormModal
          title={editPlan ? `Edit: ${editPlan.name}` : 'Create Journey Plan'}
          form={form}
          setForm={setForm}
          salesmen={salesmen as any[]}
          vehicles={vehicles as any[]}
          routes={routesBySalesman}
          saving={savePlan.isPending}
          onSave={() => savePlan.mutate(editPlan ? { id: editPlan.id, data: form } : { data: form })}
          onClose={() => { setShowCreate(false); setEditPlan(null); setForm(emptyForm); }}
        />
      )}
      {showEmergency && (
        <EmergencyModal
          salesmen={salesmen as any[]}
          routes={routes as any[]}
          date={boardDate}
          saving={createEmergency.isPending}
          onSubmit={data => createEmergency.mutate(data)}
          onClose={() => setShowEmergency(false)}
        />
      )}
    </div>
  );
}

/* ── Modals live at module scope so typing in them never remounts the inputs ── */

function PlanFormModal({ title, form, setForm, salesmen, vehicles, routes, saving, onSave, onClose }: {
  title: string;
  form: PlanForm;
  setForm: React.Dispatch<React.SetStateAction<PlanForm>>;
  salesmen: any[];
  vehicles: any[];
  routes: any[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const dayOf = (dayOfWeek: number) => form.days.find(d => d.dayOfWeek === dayOfWeek);

  const setDayRoute = (dayOfWeek: number, routeId: string) => {
    setForm(f => {
      const days = f.days.filter(d => d.dayOfWeek !== dayOfWeek);
      if (!routeId) return { ...f, days };
      const prev = f.days.find(d => d.dayOfWeek === dayOfWeek);
      return { ...f, days: [...days, { dayOfWeek, routeId, startTime: prev?.startTime || '', notes: prev?.notes || '' }] };
    });
  };
  const setDayTime = (dayOfWeek: number, startTime: string) =>
    setForm(f => ({ ...f, days: f.days.map(d => (d.dayOfWeek === dayOfWeek ? { ...d, startTime } : d)) }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="e.g. Van 1 — Weekly Journey" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salesman *</label>
              <select value={form.salesmanId} onChange={e => setForm(f => ({ ...f, salesmanId: e.target.value }))} className="input">
                <option value="">Select salesman</option>
                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name} ({s.area || 'No area'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Van / Vehicle</label>
              <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} className="input">
                <option value="">Use staff's assigned van</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}{v.make ? ` — ${v.make}` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Schedule *</label>
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              {DAYS.map((day, i) => {
                const assigned = dayOf(i);
                return (
                  <div key={day} className="flex items-center gap-2">
                    <span className={`w-24 text-sm font-medium ${assigned ? 'text-gray-900' : 'text-gray-400'}`}>{day}</span>
                    <select value={assigned?.routeId || ''} onChange={e => setDayRoute(i, e.target.value)} className="input flex-1 py-1.5 text-sm">
                      <option value="">Off / no route</option>
                      {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.stops?.length || 0} stops)</option>)}
                    </select>
                    <input
                      type="time"
                      value={assigned?.startTime || ''}
                      onChange={e => setDayTime(i, e.target.value)}
                      disabled={!assigned}
                      className="input w-28 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave a day empty if the van does not go out that day.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" rows={2} placeholder="Optional instructions for the staff" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={onSave} disabled={saving || !form.name || !form.salesmanId || form.days.length === 0} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Journey Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmergencyModal({ salesmen, routes, date, saving, onSubmit, onClose }: {
  salesmen: any[];
  routes: any[];
  date: string;
  saving: boolean;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [salesmanId, setSalesmanId] = useState('');
  const [reason, setReason] = useState(EMERGENCY_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [routeId, setRouteId] = useState('');
  const [notes, setNotes] = useState('');
  const finalReason = reason === 'Other' ? customReason : reason;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-[#B45309] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><AlertTriangle size={18} /> Emergency Journey</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Send a staff member out without a plan — urgent stock drop, customer call-out, or an off-schedule trip.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff *</label>
            <select value={salesmanId} onChange={e => setSalesmanId(e.target.value)} className="input">
              <option value="">Select staff</option>
              {salesmen.map(s => <option key={s.id} value={s.id}>{s.name} ({s.area || 'No area'})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input">
              {EMERGENCY_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <input value={customReason} onChange={e => setCustomReason(e.target.value)} className="input mt-2" placeholder="Describe the reason" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route (optional)</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} className="input">
              <option value="">No route — staff picks shops in the app</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.stops?.length || 0} stops)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => onSubmit({ salesmanId, reason: finalReason, routeId: routeId || undefined, notes, date })}
              disabled={saving || !salesmanId || !finalReason}
              className="btn-primary flex-1"
            >
              {saving ? 'Creating...' : 'Create Journey'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
