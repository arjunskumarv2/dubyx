import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Plus, X, Check, Pencil, Trash2, UserCheck, UserX,
  PackageSearch, CheckCircle2, XCircle, Package, RefreshCw,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AxiosResponse } from 'axios';
import api from '../services/api';

/* ─── Types ─── */
interface Staff { id: string; name: string; area: string; role: string }
interface Product { id: string; name: string; sku: string; unit: string; sellingPrice: number; currentStock: number }

interface VanLoadItem {
  id: string; productId: string; loadedQty: number; soldQty: number; returnedQty: number;
  product: { id: string; name: string; sku: string; unit: string; sellingPrice: number };
}
interface VanLoad {
  id: string; loadNumber: string; vehicleId: string | null; salesmanId: string;
  salesman: { id: string; name: string; area: string };
  vehicle: { id: string; vehicleNumber: string; make: string | null; model: string | null } | null;
  status: 'ACTIVE' | 'RETURNED' | 'CLOSED'; notes: string | null;
  loadedAt: string; returnedAt: string | null; items: VanLoadItem[];
}
interface Vehicle {
  id: string; vehicleNumber: string; make: string | null; model: string | null;
  color: string | null; notes: string | null; isActive: boolean;
  assignedToId: string | null; assignedAt: string | null;
  assignedTo: Staff | null;
  vanLoads: VanLoad[];
}
interface StockRequestItem {
  id: string; productId: string; requestedQty: number;
  product: { id: string; name: string; sku: string; unit: string; currentStock: number };
}
interface StockRequest {
  id: string; requestNumber: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  notes: string | null; vanLoadId: string | null; createdAt: string;
  requestedBy: { id: string; name: string; area: string };
  items: StockRequestItem[];
}

/* ─── Main Page ─── */
export default function VanManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'fleet' | 'loads' | 'requests'>('fleet');
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [loadVehicle, setLoadVehicle] = useState<Vehicle | null>(null);
  const [assignVehicle, setAssignVehicle] = useState<Vehicle | null>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [editLoad, setEditLoad] = useState<VanLoad | null>(null);

  const { data: vehicles = [], isLoading: vLoading } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles').then((r: AxiosResponse<Vehicle[]>) => r.data),
  });
  const { data: vanLoads = [], isLoading: lLoading } = useQuery<VanLoad[]>({
    queryKey: ['van-loads'],
    queryFn: () => api.get('/van-loads').then((r: AxiosResponse<VanLoad[]>) => r.data),
  });
  const { data: stockRequests = [], isLoading: rLoading } = useQuery<StockRequest[]>({
    queryKey: ['stock-requests'],
    queryFn: () => api.get('/stock-requests').then((r: AxiosResponse<StockRequest[]>) => r.data),
  });
  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ['staff-all'],
    queryFn: () => api.get('/users').then((r: AxiosResponse<Staff[]>) => r.data),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products').then((r: AxiosResponse<Product[]>) => r.data),
  });

  const pendingCount = stockRequests.filter(r => r.status === 'PENDING').length;
  const activeVehicles = vehicles.filter(v => v.isActive);
  const assignedCount = vehicles.filter(v => v.assignedToId).length;

  const acceptRequest = useMutation({
    mutationFn: (id: string) => api.post(`/stock-requests/${id}/accept`, {}),
    onSuccess: () => { toast.success('Accepted — van load created!'); qc.invalidateQueries({ queryKey: ['stock-requests'] }); qc.invalidateQueries({ queryKey: ['van-loads'] }); qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['products-active'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });
  const rejectRequest = useMutation({
    mutationFn: (id: string) => api.post(`/stock-requests/${id}/reject`, {}),
    onSuccess: () => { toast.success('Rejected'); qc.invalidateQueries({ queryKey: ['stock-requests'] }); },
    onError: () => toast.error('Failed to reject'),
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Van Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{activeVehicles.length} vehicles · {assignedCount} assigned</p>
        </div>
        {tab === 'fleet' && (
          <button onClick={() => setShowCreateVehicle(true)} className="flex items-center gap-2 px-4 py-2 bg-[#8D1B3D] text-white rounded-lg hover:bg-[#7a1735] text-sm font-medium">
            <Plus size={16} /> Add Vehicle
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'fleet' as const, label: 'Fleet', icon: Truck, badge: 0 },
          { key: 'loads' as const, label: 'Load History', icon: Package, badge: 0 },
          { key: 'requests' as const, label: 'Stock Requests', icon: PackageSearch, badge: pendingCount },
        ]).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-[#8D1B3D] text-[#8D1B3D]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
            {badge ? (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Fleet tab ── */}
      {tab === 'fleet' && (
        vLoading ? <Spinner /> : (
          vehicles.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Truck size={44} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No vehicles yet</p>
              <p className="text-gray-400 text-sm mt-1">Add your first vehicle to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {vehicles.map(v => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onEdit={() => setEditVehicle(v)}
                  onAssign={() => setAssignVehicle(v)}
                  onLoad={() => setLoadVehicle(v)}
                  onDeleteSuccess={() => qc.invalidateQueries({ queryKey: ['vehicles'] })}
                />
              ))}
            </div>
          )
        )
      )}

      {/* ── Load History tab ── */}
      {tab === 'loads' && (
        lLoading ? <Spinner /> : (
          vanLoads.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Package size={44} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No loads recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vanLoads.map(load => (
                <LoadCard
                  key={load.id}
                  load={load}
                  expanded={expandedLoadId === load.id}
                  onToggle={() => setExpandedLoadId(expandedLoadId === load.id ? null : load.id)}
                  onEdit={() => setEditLoad(load)}
                  onReturnSuccess={() => { qc.invalidateQueries({ queryKey: ['van-loads'] }); qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['products-active'] }); }}
                />
              ))}
            </div>
          )
        )
      )}

      {/* ── Stock Requests tab ── */}
      {tab === 'requests' && (
        rLoading ? <Spinner /> : (
          stockRequests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <PackageSearch size={44} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No stock requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stockRequests.map(req => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{req.requestNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reqBadge[req.status]}`}>{req.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-700">{req.requestedBy.name}</span>
                        {req.requestedBy.area ? ` · ${req.requestedBy.area}` : ''}
                        <span className="ml-2 text-xs">· {new Date(req.createdAt).toLocaleString()}</span>
                      </p>
                      {req.notes && <p className="text-xs text-gray-400 mt-1 italic">"{req.notes}"</p>}
                    </div>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => { if (confirm(`Accept and create van load for ${req.requestedBy.name}?`)) acceptRequest.mutate(req.id); }}
                          disabled={acceptRequest.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} /> Accept
                        </button>
                        <button
                          onClick={() => rejectRequest.mutate(req.id)}
                          disabled={rejectRequest.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    )}
                    {req.status === 'ACCEPTED' && <span className="text-xs text-green-600 font-medium flex-shrink-0">Van load created</span>}
                  </div>
                  <div className="border-t border-gray-50 pt-3 space-y-1.5">
                    {req.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 text-sm">
                        <span className="flex-1 text-gray-800">{item.product.name}</span>
                        <span className="text-xs text-gray-400">Stock: {item.product.currentStock} {item.product.unit}</span>
                        <span className="font-semibold text-[#8D1B3D]">Req: {item.requestedQty} {item.product.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )
      )}

      {/* Modals */}
      {showCreateVehicle && (
        <VehicleFormModal
          title="Add Vehicle"
          onClose={() => setShowCreateVehicle(false)}
          onSuccess={() => { setShowCreateVehicle(false); qc.invalidateQueries({ queryKey: ['vehicles'] }); }}
        />
      )}
      {editVehicle && (
        <VehicleFormModal
          title="Edit Vehicle"
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSuccess={() => { setEditVehicle(null); qc.invalidateQueries({ queryKey: ['vehicles'] }); }}
        />
      )}
      {assignVehicle && (
        <AssignModal
          vehicle={assignVehicle}
          staff={staff}
          onClose={() => setAssignVehicle(null)}
          onSuccess={() => { setAssignVehicle(null); qc.invalidateQueries({ queryKey: ['vehicles'] }); }}
        />
      )}
      {editLoad && (
        <EditLoadModal
          load={editLoad}
          products={products}
          onClose={() => setEditLoad(null)}
          onSuccess={() => { setEditLoad(null); qc.invalidateQueries({ queryKey: ['van-loads'] }); qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['products-active'] }); }}
        />
      )}
      {loadVehicle && (
        <LoadStockModal
          vehicle={loadVehicle}
          products={products}
          onClose={() => setLoadVehicle(null)}
          onSuccess={() => { setLoadVehicle(null); qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['van-loads'] }); qc.invalidateQueries({ queryKey: ['products-active'] }); }}
        />
      )}
    </div>
  );
}

/* ─── Helpers ─── */
const reqBadge: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};
const loadBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  RETURNED: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};
const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin w-8 h-8 border-4 border-[#8D1B3D] border-t-transparent rounded-full" />
  </div>
);

/* ─── Vehicle Card ─── */
function VehicleCard({ vehicle, onEdit, onAssign, onLoad, onDeleteSuccess }: {
  vehicle: Vehicle; onEdit: () => void; onAssign: () => void; onLoad: () => void; onDeleteSuccess: () => void;
}) {
  const activeLoad = vehicle.vanLoads[0];
  const hasLoad = !!activeLoad;

  const handleDelete = async () => {
    if (!confirm(`Delete vehicle ${vehicle.vehicleNumber}?`)) return;
    try {
      await api.delete(`/vehicles/${vehicle.id}`);
      onDeleteSuccess();
      toast.success('Vehicle deleted');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="bg-[#8D1B3D] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Truck size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-wide">{vehicle.vehicleNumber}</p>
            {(vehicle.make || vehicle.model) && (
              <p className="text-white/70 text-xs">{[vehicle.make, vehicle.model].filter(Boolean).join(' ')}{vehicle.color ? ` · ${vehicle.color}` : ''}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><Pencil size={13} /></button>
          <button onClick={handleDelete} className="p-1.5 text-white/60 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Assigned staff */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {vehicle.assignedTo ? (
              <>
                <div className="w-9 h-9 bg-[#8D1B3D]/10 rounded-full flex items-center justify-center">
                  <span className="text-[#8D1B3D] font-bold text-sm">{vehicle.assignedTo.name[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{vehicle.assignedTo.name}</p>
                  {vehicle.assignedTo.area && <p className="text-xs text-gray-400">{vehicle.assignedTo.area}</p>}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <UserX size={18} />
                <span className="text-sm">Unassigned</span>
              </div>
            )}
          </div>
          <button
            onClick={onAssign}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <UserCheck size={13} />
            {vehicle.assignedTo ? 'Reassign' : 'Assign'}
          </button>
        </div>

        {/* Current load status */}
        {hasLoad ? (
          <div className="bg-green-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Active Load</span>
              <span className="text-xs text-green-600 font-mono">{activeLoad.loadNumber}</span>
            </div>
            <div className="flex gap-3 text-xs text-green-700">
              <span>Loaded: {activeLoad.items.reduce((s, i) => s + i.loadedQty, 0)}</span>
              <span>·</span>
              <span>Sold: {activeLoad.items.reduce((s, i) => s + i.soldQty, 0)}</span>
              <span>·</span>
              <span>Remaining: {activeLoad.items.reduce((s, i) => s + i.loadedQty - i.soldQty - i.returnedQty, 0)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-3 text-center text-sm text-gray-400">No active load</div>
        )}

        {/* Actions */}
        {!hasLoad && vehicle.assignedTo && (
          <button
            onClick={onLoad}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#8D1B3D] text-white rounded-lg text-sm font-medium hover:bg-[#7a1735] transition-colors"
          >
            <Package size={14} /> Load Stock
          </button>
        )}
        {!hasLoad && !vehicle.assignedTo && (
          <p className="text-center text-xs text-gray-400">Assign a staff member to load stock</p>
        )}
      </div>
    </div>
  );
}

/* ─── Load Card (history) ─── */
function LoadCard({ load, expanded, onToggle, onEdit, onReturnSuccess }: {
  load: VanLoad; expanded: boolean; onToggle: () => void; onEdit: () => void; onReturnSuccess: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const totalLoaded = load.items.reduce((s, i) => s + i.loadedQty, 0);
  const totalSold = load.items.reduce((s, i) => s + i.soldQty, 0);
  const totalAvail = load.items.reduce((s, i) => s + i.loadedQty - i.soldQty - i.returnedQty, 0);

  const handleReturn = async () => {
    setProcessing(true);
    try {
      const returnItems = load.items.map(item => ({
        productId: item.productId,
        quantity: returnQtys[item.productId] ?? (item.loadedQty - item.soldQty - item.returnedQty),
      })).filter(r => r.quantity > 0);
      await api.post(`/van-loads/${load.id}/return`, { returnItems });
      onReturnSuccess();
      toast.success('Return processed');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="w-9 h-9 bg-[#8D1B3D]/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Truck size={16} className="text-[#8D1B3D]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{load.loadNumber}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${loadBadge[load.status]}`}>{load.status}</span>
            {load.vehicle && <span className="text-xs text-gray-400 font-mono">{load.vehicle.vehicleNumber}</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{load.salesman.name} · {new Date(load.loadedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-5 text-sm text-center">
          <div><p className="text-xs text-gray-400">Loaded</p><p className="font-semibold text-gray-700">{totalLoaded}</p></div>
          <div><p className="text-xs text-gray-400">Sold</p><p className="font-semibold text-green-600">{totalSold}</p></div>
          <div><p className="text-xs text-gray-400">Remaining</p><p className="font-semibold text-blue-600">{totalAvail}</p></div>
        </div>
        {load.status === 'ACTIVE' && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Add stock to this load"
          >
            <Pencil size={14} />
          </button>
        )}
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-center">Loaded</th>
                <th className="pb-2 text-center">Sold</th>
                <th className="pb-2 text-center">Returned</th>
                <th className="pb-2 text-center text-blue-600">Available</th>
                {load.status === 'ACTIVE' && <th className="pb-2 text-center">Return Qty</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {load.items.map(item => {
                const avail = item.loadedQty - item.soldQty - item.returnedQty;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-2.5">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-xs text-gray-400">{item.product.sku} · {item.product.unit}</p>
                    </td>
                    <td className="py-2.5 text-center text-gray-700">{item.loadedQty}</td>
                    <td className="py-2.5 text-center text-green-600 font-medium">{item.soldQty}</td>
                    <td className="py-2.5 text-center text-gray-500">{item.returnedQty}</td>
                    <td className="py-2.5 text-center text-blue-600 font-semibold">{avail}</td>
                    {load.status === 'ACTIVE' && (
                      <td className="py-2.5 text-center">
                        <input type="number" min={0} max={avail} value={returnQtys[item.productId] ?? avail}
                          onChange={e => setReturnQtys(p => ({ ...p, [item.productId]: parseInt(e.target.value) || 0 }))}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {load.status === 'ACTIVE' && (
            <div className="flex justify-end">
              <button onClick={handleReturn} disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
                {processing ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Vehicle Form Modal ─── */
function VehicleFormModal({ title, vehicle, onClose, onSuccess }: {
  title: string; vehicle?: Vehicle; onClose: () => void; onSuccess: () => void;
}) {
  const [vehicleNumber, setVehicleNumber] = useState(vehicle?.vehicleNumber || '');
  const [make, setMake] = useState(vehicle?.make || '');
  const [model, setModel] = useState(vehicle?.model || '');
  const [color, setColor] = useState(vehicle?.color || '');
  const [notes, setNotes] = useState(vehicle?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!vehicleNumber.trim()) return toast.error('Vehicle number is required');
    setSaving(true);
    try {
      if (vehicle) {
        await api.put(`/vehicles/${vehicle.id}`, { make, model, color, notes });
      } else {
        await api.post('/vehicles', { vehicleNumber, make, model, color, notes });
      }
      onSuccess();
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number / Plate *</label>
            <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
              disabled={!!vehicle} placeholder="e.g. QA-1234"
              className="input uppercase disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          {[
            { label: 'Make', value: make, set: setMake, placeholder: 'e.g. Toyota' },
            { label: 'Model', value: model, set: setModel, placeholder: 'e.g. Hiace' },
            { label: 'Color', value: color, set: setColor, placeholder: 'e.g. White' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} className="input" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Assign Modal ─── */
function AssignModal({ vehicle, staff, onClose, onSuccess }: {
  vehicle: Vehicle; staff: Staff[]; onClose: () => void; onSuccess: () => void;
}) {
  const [staffId, setStaffId] = useState(vehicle.assignedToId || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/vehicles/${vehicle.id}/assign`, { staffId: staffId || null });
      onSuccess();
      toast.success(staffId ? 'Vehicle assigned!' : 'Vehicle unassigned');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Assign {vehicle.vehicleNumber}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Staff</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className="input">
              <option value="">— Unassign —</option>
              {staff.filter(s => s.role === 'SALESMAN').map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.area ? ` (${s.area})` : ''}</option>
              ))}
            </select>
          </div>
          {staffId && staffId !== vehicle.assignedToId && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              This staff member will be unassigned from any other vehicle they currently drive.
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : <><UserCheck size={15} className="inline mr-1.5" />Confirm</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Load Stock Modal ─── */
function LoadStockModal({ vehicle, products, onClose, onSuccess }: {
  vehicle: Vehicle; products: Product[]; onClose: () => void; onSuccess: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = products.filter(p =>
    p.currentStock > 0 &&
    !selectedItems.find(si => si.productId === p.id) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addItem = (p: Product) => { setSelectedItems(prev => [...prev, { productId: p.id, quantity: 1 }]); setSearch(''); };
  const removeItem = (id: string) => setSelectedItems(prev => prev.filter(i => i.productId !== id));
  const updateQty = (id: string, qty: number) => setSelectedItems(prev => prev.map(i => i.productId === id ? { ...i, quantity: qty } : i));

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return toast.error('Add at least one product');
    setSubmitting(true);
    try {
      await api.post('/van-loads', { vehicleId: vehicle.id, items: selectedItems, notes });
      onSuccess();
      toast.success('Van load created!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create load');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Load Stock — {vehicle.vehicleNumber}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Driver: {vehicle.assignedTo?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent" />
            {search && filteredProducts.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto shadow-sm">
                {filteredProducts.slice(0, 10).map(p => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-gray-400 text-xs">Stock: {p.currentStock} {p.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected ({selectedItems.length})</p>
              {selectedItems.map(item => {
                const p = products.find(pr => pr.id === item.productId)!;
                return (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">Max: {p.currentStock} {p.unit}</p>
                    </div>
                    <input type="number" min={1} max={p.currentStock} value={item.quantity}
                      onChange={e => updateQty(item.productId, Math.min(parseInt(e.target.value) || 1, p.currentStock))}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm" />
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#8D1B3D] text-white rounded-lg text-sm font-medium hover:bg-[#7a1735] disabled:opacity-50">
            <Check size={16} />
            {submitting ? 'Loading...' : 'Create Van Load'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Load Modal (top-up existing stock) ─── */
function EditLoadModal({ load, products, onClose, onSuccess }: {
  load: VanLoad; products: Product[]; onClose: () => void; onSuccess: () => void;
}) {
  const [addItems, setAddItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState(load.notes || '');
  const [saving, setSaving] = useState(false);

  const filteredProducts = products.filter(p =>
    p.currentStock > 0 &&
    !addItems.find(i => i.productId === p.id) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addItem = (p: Product) => { setAddItems(prev => [...prev, { productId: p.id, quantity: 1 }]); setSearch(''); };
  const removeItem = (id: string) => setAddItems(prev => prev.filter(i => i.productId !== id));
  const updateQty = (id: string, qty: number) => setAddItems(prev => prev.map(i => i.productId === id ? { ...i, quantity: qty } : i));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/van-loads/${load.id}`, { notes, addItems });
      onSuccess();
      toast.success('Load updated!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update load');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Stock — {load.loadNumber}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{load.vehicle?.vehicleNumber} · {load.salesman.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Current items summary */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Current Stock in Van</p>
            <div className="space-y-1.5">
              {load.items.map(item => {
                const avail = item.loadedQty - item.soldQty - item.returnedQty;
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium text-gray-800">{item.product.name}</span>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Loaded: {item.loadedQty}</span>
                      <span>Sold: {item.soldQty}</span>
                      <span className="font-semibold text-[#8D1B3D]">Available: {avail} {item.product.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search to add/top-up */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add / Top-up Products</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent" />
            {search && filteredProducts.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto shadow-sm">
                {filteredProducts.slice(0, 10).map(p => {
                  const inLoad = load.items.find(i => i.productId === p.id);
                  return (
                    <button key={p.id} onClick={() => addItem(p)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left">
                      <div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {inLoad && <span className="ml-2 text-xs text-blue-500">(top-up · {inLoad.loadedQty - inLoad.soldQty - inLoad.returnedQty} left)</span>}
                      </div>
                      <span className="text-gray-400 text-xs">Warehouse: {p.currentStock} {p.unit}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {addItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Adding ({addItems.length})</p>
              {addItems.map(item => {
                const p = products.find(pr => pr.id === item.productId)!;
                const inLoad = load.items.find(i => i.productId === item.productId);
                return (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {inLoad ? `${inLoad.loadedQty - inLoad.soldQty - inLoad.returnedQty} left in van · ` : ''}
                        Warehouse: {p.currentStock} {p.unit}
                      </p>
                    </div>
                    <input type="number" min={1} max={p.currentStock} value={item.quantity}
                      onChange={e => updateQty(item.productId, Math.min(parseInt(e.target.value) || 1, p.currentStock))}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm" />
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent resize-none" />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || (addItems.length === 0 && notes === (load.notes || ''))}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#8D1B3D] text-white rounded-lg text-sm font-medium hover:bg-[#7a1735] disabled:opacity-50">
            <Check size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
