import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, AlertTriangle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const defaultProduct = { name: '', sku: '', categoryId: '', sellingPrice: 0, costPrice: 0, taxRate: 5, unit: 'PCS', currentStock: 0, minStock: 10, barcode: '', description: '' };

export default function Inventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [form, setForm] = useState(defaultProduct);
  const [adjustForm, setAdjustForm] = useState({ type: 'IN', quantity: 0, reason: '' });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => api.get('/products', { params: { search } }).then(r => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
  });

  const createProduct = useMutation({
    mutationFn: (data: typeof form) => api.post('/products', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product created!'); setShowAdd(false); setForm(defaultProduct); },
    onError: () => toast.error('Failed to create product'),
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof adjustForm }) => api.post(`/products/${id}/adjust-stock`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Stock adjusted!'); setShowAdjust(false); setSelectedProduct(null); },
    onError: () => toast.error('Failed to adjust stock'),
  });

  return (
    <div className="space-y-5">
      <div className="flex gap-3 justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input pl-9" />
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Product', 'SKU', 'Category', 'Price', 'Cost', 'Tax', 'Stock', 'Min Stock', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : products.map((p: any) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.currentStock <= p.minStock ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.currentStock <= p.minStock && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category?.name}</td>
                  <td className="px-4 py-3 font-semibold">QAR {p.sellingPrice?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">QAR {p.costPrice?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.taxRate}%</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${p.currentStock <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>{p.currentStock}</span>
                    <span className="text-gray-400 text-xs ml-1">{p.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.minStock}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelectedProduct(p); setAdjustForm({ type: 'IN', quantity: 0, reason: '' }); setShowAdjust(true); }} className="text-xs bg-[#8D1B3D] text-white px-2 py-1 rounded hover:bg-[#7a1836]">
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
              <h3 className="text-white font-bold text-lg">Add Product</h3>
              <button onClick={() => setShowAdd(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="input" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="input">
                    <option value="">Select Category</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (QAR)</label>
                  <input type="number" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (QAR)</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <input type="number" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input">
                    {['PCS', 'KG', 'LTR', 'BOX', 'CASE', 'BAG', 'CTN'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                  <input type="number" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Alert</label>
                  <input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} className="input" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createProduct.mutate(form)} disabled={createProduct.isPending} className="btn-primary flex-1">
                  {createProduct.isPending ? 'Saving...' : 'Add Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-bold">Adjust Stock</h3>
              <button onClick={() => { setShowAdjust(false); setSelectedProduct(null); }} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">Current Stock: <strong className="text-[#8D1B3D]">{selectedProduct.currentStock} {selectedProduct.unit}</strong></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })} className="input">
                  {['IN', 'OUT', 'DAMAGED', 'EXPIRED', 'ADJUSTED'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })} className="input" min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="input" placeholder="Optional reason..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAdjust(false); setSelectedProduct(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => adjustStock.mutate({ id: selectedProduct.id, data: adjustForm })} disabled={adjustStock.isPending} className="btn-primary flex-1">
                  {adjustStock.isPending ? 'Saving...' : 'Adjust'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
