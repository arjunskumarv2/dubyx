import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, RefreshCw, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import type { AxiosResponse } from 'axios';
import api from '../services/api';

interface VanLoadItem {
  id: string;
  productId: string;
  loadedQty: number;
  soldQty: number;
  returnedQty: number;
  product: { id: string; name: string; sku: string; unit: string; sellingPrice: number };
}

interface VanLoad {
  id: string;
  loadNumber: string;
  salesmanId: string;
  salesman: { id: string; name: string; area: string };
  status: 'ACTIVE' | 'RETURNED' | 'CLOSED';
  notes: string | null;
  loadedAt: string;
  returnedAt: string | null;
  items: VanLoadItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPrice: number;
  currentStock: number;
}

interface User {
  id: string;
  name: string;
  area: string;
  role: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  RETURNED: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export default function VanManagement() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const { data: vanLoads = [], isLoading } = useQuery<VanLoad[]>({
    queryKey: ['van-loads', filterStatus],
    queryFn: () => api.get(`/van-loads${filterStatus ? `?status=${filterStatus}` : ''}`).then((r: AxiosResponse<VanLoad[]>) => r.data),
  });

  const { data: salesmen = [] } = useQuery<User[]>({
    queryKey: ['salesmen'],
    queryFn: () => api.get('/users?role=SALESMAN').then((r: AxiosResponse<User[]>) => r.data),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products').then((r: AxiosResponse<Product[]>) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Van Management</h1>
          <p className="text-gray-500 text-sm mt-1">Load products to vans and track field stock</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8D1B3D] text-white rounded-lg hover:bg-[#7a1735] transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Van Load
        </button>
      </div>

      {/* Stats */}
      <VanStats vanLoads={vanLoads} />

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'ACTIVE', 'RETURNED', 'CLOSED'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s ? 'bg-[#8D1B3D] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Van Load List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-[#8D1B3D] border-t-transparent rounded-full" />
        </div>
      ) : vanLoads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Truck size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No van loads found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vanLoads.map(load => (
            <VanLoadCard
              key={load.id}
              load={load}
              expanded={expandedId === load.id}
              onToggle={() => setExpandedId(expandedId === load.id ? null : load.id)}
              onReturnSuccess={() => queryClient.invalidateQueries({ queryKey: ['van-loads'] })}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateVanLoadModal
          salesmen={salesmen}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['van-loads'] });
            queryClient.invalidateQueries({ queryKey: ['products-active'] });
          }}
        />
      )}
    </div>
  );
}

function VanStats({ vanLoads }: { vanLoads: VanLoad[] }) {
  const active = vanLoads.filter(v => v.status === 'ACTIVE').length;
  const totalItemsOut = vanLoads
    .filter(v => v.status === 'ACTIVE')
    .reduce((s, v) => s + v.items.reduce((si, i) => si + i.loadedQty - i.soldQty - i.returnedQty, 0), 0);
  const totalSold = vanLoads.reduce((s, v) => s + v.items.reduce((si, i) => si + i.soldQty, 0), 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Active Vans', value: active, color: 'text-green-600' },
        { label: 'Items in Field', value: totalItemsOut, color: 'text-blue-600' },
        { label: 'Total Units Sold', value: totalSold, color: 'text-purple-600' },
      ].map(stat => (
        <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function VanLoadCard({ load, expanded, onToggle, onReturnSuccess }: {
  load: VanLoad;
  expanded: boolean;
  onToggle: () => void;
  onReturnSuccess: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});

  const totalLoaded = load.items.reduce((s, i) => s + i.loadedQty, 0);
  const totalSold = load.items.reduce((s, i) => s + i.soldQty, 0);
  const totalAvailable = load.items.reduce((s, i) => s + i.loadedQty - i.soldQty - i.returnedQty, 0);

  const handleReturn = async () => {
    setProcessing(true);
    try {
      const returnItems = load.items.map(item => ({
        productId: item.productId,
        quantity: returnQtys[item.productId] ?? (item.loadedQty - item.soldQty - item.returnedQty),
      })).filter(r => r.quantity > 0);

      await api.post(`/van-loads/${load.id}/return`, { returnItems });
      onReturnSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="w-10 h-10 bg-[#8D1B3D]/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Truck size={18} className="text-[#8D1B3D]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{load.loadNumber}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[load.status]}`}>
              {load.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {load.salesman.name} · {new Date(load.loadedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-center">
          <div><p className="text-gray-400 text-xs">Loaded</p><p className="font-semibold text-gray-700">{totalLoaded}</p></div>
          <div><p className="text-gray-400 text-xs">Sold</p><p className="font-semibold text-green-600">{totalSold}</p></div>
          <div><p className="text-gray-400 text-xs">Remaining</p><p className="font-semibold text-blue-600">{totalAvailable}</p></div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium text-center">Loaded</th>
                  <th className="pb-2 font-medium text-center">Sold</th>
                  <th className="pb-2 font-medium text-center">Returned</th>
                  <th className="pb-2 font-medium text-center text-blue-600">Available</th>
                  {load.status === 'ACTIVE' && <th className="pb-2 font-medium text-center">Return Qty</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {load.items.map(item => {
                  const available = item.loadedQty - item.soldQty - item.returnedQty;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <p className="font-medium text-gray-900">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.product.sku} · {item.product.unit}</p>
                      </td>
                      <td className="py-2.5 text-center text-gray-700">{item.loadedQty}</td>
                      <td className="py-2.5 text-center text-green-600 font-medium">{item.soldQty}</td>
                      <td className="py-2.5 text-center text-gray-500">{item.returnedQty}</td>
                      <td className="py-2.5 text-center text-blue-600 font-semibold">{available}</td>
                      {load.status === 'ACTIVE' && (
                        <td className="py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={available}
                            value={returnQtys[item.productId] ?? available}
                            onChange={e => setReturnQtys(prev => ({ ...prev, [item.productId]: parseInt(e.target.value) || 0 }))}
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {load.status === 'ACTIVE' && (
            <div className="flex justify-end">
              <button
                onClick={handleReturn}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw size={15} className={processing ? 'animate-spin' : ''} />
                {processing ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateVanLoadModal({ salesmen, products, onClose, onSuccess }: {
  salesmen: User[];
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [salesmanId, setSalesmanId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const filteredProducts = products.filter(p =>
    p.currentStock > 0 &&
    !selectedItems.find(si => si.productId === p.id) &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const addItem = (product: Product) => {
    setSelectedItems(prev => [...prev, { productId: product.id, quantity: 1 }]);
    setProductSearch('');
  };

  const removeItem = (productId: string) => {
    setSelectedItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateQty = (productId: string, qty: number) => {
    setSelectedItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const handleSubmit = async () => {
    if (!salesmanId) return alert('Please select a salesman');
    if (selectedItems.length === 0) return alert('Add at least one product');

    setSubmitting(true);
    try {
      await api.post('/van-loads', { salesmanId, items: selectedItems, notes });
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create van load');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Van Load</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Salesman */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Salesman *</label>
            <select
              value={salesmanId}
              onChange={e => setSalesmanId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent"
            >
              <option value="">Select salesman...</option>
              {salesmen.filter(u => u.role === 'SALESMAN').map(u => (
                <option key={u.id} value={u.id}>{u.name} {u.area ? `(${u.area})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Product search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent"
            />
            {productSearch && filteredProducts.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto shadow-sm">
                {filteredProducts.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-gray-400 text-xs">Stock: {p.currentStock} {p.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected items */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected Products ({selectedItems.length})</p>
              {selectedItems.map(item => {
                const product = products.find(p => p.id === item.productId)!;
                return (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">Max: {product.currentStock} {product.unit}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={product.currentStock}
                      value={item.quantity}
                      onChange={e => updateQty(item.productId, Math.min(parseInt(e.target.value) || 1, product.currentStock))}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm"
                    />
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8D1B3D] focus:border-transparent resize-none"
              placeholder="Any notes about this van load..."
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#8D1B3D] text-white rounded-lg text-sm font-medium hover:bg-[#7a1735] disabled:opacity-50"
          >
            <Check size={16} />
            {submitting ? 'Creating...' : 'Create Van Load'}
          </button>
        </div>
      </div>
    </div>
  );
}
