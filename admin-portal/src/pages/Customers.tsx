import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Phone, MapPin, CreditCard, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const defaultForm = { shopName: '', ownerName: '', phone: '', email: '', address: '', area: '', route: '', creditLimit: 0, taxNumber: '', notes: '' };

export default function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selected, setSelected] = useState<any>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search, area],
    queryFn: () => api.get('/customers', { params: { search, area } }).then(r => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['customer-detail', selected?.id],
    queryFn: () => api.get(`/customers/${selected?.id}`).then(r => r.data),
    enabled: !!selected,
  });

  const createCustomer = useMutation({
    mutationFn: (data: typeof form) => api.post('/customers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer added!'); setShowModal(false); setForm(defaultForm); },
    onError: () => toast.error('Failed to add customer'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="input pl-9" />
          </div>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="Filter by area" className="input w-40" />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Loading...</div>
        ) : customers.map((c: any) => (
          <div key={c.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(c)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{c.shopName}</h3>
                <p className="text-sm text-gray-500">{c.ownerName}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Phone size={13} className="text-[#8D1B3D]" />{c.phone}</div>
              <div className="flex items-center gap-2"><MapPin size={13} className="text-[#8D1B3D]" />{c.area}{c.route ? ` — ${c.route}` : ''}</div>
              <div className="flex items-center gap-2"><CreditCard size={13} className="text-[#8D1B3D]" />Credit: QAR {c.creditLimit?.toFixed(0)}</div>
            </div>
          </div>
        ))}
        {!isLoading && customers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">No customers found</div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
              <h3 className="text-white font-bold text-lg">Add New Customer</h3>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Shop Name *', key: 'shopName', type: 'text' },
                { label: 'Owner Name *', key: 'ownerName', type: 'text' },
                { label: 'Phone *', key: 'phone', type: 'tel' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Address *', key: 'address', type: 'text' },
                { label: 'Area *', key: 'area', type: 'text' },
                { label: 'Route', key: 'route', type: 'text' },
                { label: 'Credit Limit (QAR)', key: 'creditLimit', type: 'number' },
                { label: 'Tax/VAT Number', key: 'taxNumber', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    className="input"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createCustomer.mutate(form)} disabled={createCustomer.isPending} className="btn-primary flex-1">
                  {createCustomer.isPending ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
              <h3 className="text-white font-bold text-lg">{selected.shopName}</h3>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400">Owner</p><p className="font-semibold">{selected.ownerName}</p></div>
                <div><p className="text-gray-400">Phone</p><p className="font-semibold">{selected.phone}</p></div>
                <div><p className="text-gray-400">Area</p><p className="font-semibold">{selected.area}</p></div>
                <div><p className="text-gray-400">Route</p><p className="font-semibold">{selected.route || '-'}</p></div>
                <div><p className="text-gray-400">Credit Limit</p><p className="font-semibold">QAR {selected.creditLimit}</p></div>
                <div><p className="text-gray-400">Tax Number</p><p className="font-semibold">{selected.taxNumber || '-'}</p></div>
              </div>

              {detail?.orders?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recent Orders</h4>
                  <div className="space-y-2">
                    {detail.orders.slice(0, 5).map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                        <span className="font-mono text-[#8D1B3D]">{o.orderNumber}</span>
                        <span className="text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</span>
                        <span className="font-semibold">QAR {o.total?.toFixed(2)}</span>
                        <span className={`badge-${o.status.toLowerCase()}`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
