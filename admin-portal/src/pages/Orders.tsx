import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Eye, CheckCircle, XCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const statusColors: Record<string, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  PROCESSING: 'badge-partial',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
};

export default function Orders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', search, status],
    queryFn: () => api.get('/orders', { params: { search, status } }).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const generateInvoice = useMutation({
    mutationFn: (orderId: string) => api.post('/invoices/generate', { orderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice generated!');
      setShowInvoiceModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to generate invoice'),
  });

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="input pl-9" />
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className="input w-40">
            <option value="">All Status</option>
            {['PENDING','CONFIRMED','PROCESSING','DELIVERED','CANCELLED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Order #', 'Customer', 'Salesman', 'Items', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
              ) : orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-[#8D1B3D]">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{order.customer?.shopName}</p>
                    <p className="text-xs text-gray-400">{order.customer?.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{order.salesman?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{order.items?.length} items</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">SAR {order.total?.toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={statusColors[order.status] || 'badge-pending'}>{order.status}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedOrder(order)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="View">
                        <Eye size={14} />
                      </button>
                      {order.status === 'PENDING' && (
                        <button onClick={() => updateStatus.mutate({ id: order.id, status: 'CONFIRMED' })} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Confirm">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {!order.invoice && order.status !== 'CANCELLED' && (
                        <button onClick={() => { setSelectedOrder(order); setShowInvoiceModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Generate Invoice">
                          <FileText size={14} />
                        </button>
                      )}
                      {order.status === 'PENDING' && (
                        <button onClick={() => updateStatus.mutate({ id: order.id, status: 'CANCELLED' })} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Cancel">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && !showInvoiceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Order {selectedOrder.orderNumber}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-white/70 hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400">Customer</p><p className="font-semibold">{selectedOrder.customer?.shopName}</p></div>
                <div><p className="text-gray-400">Status</p><span className={statusColors[selectedOrder.status]}>{selectedOrder.status}</span></div>
                <div><p className="text-gray-400">Salesman</p><p className="font-semibold">{selectedOrder.salesman?.name}</p></div>
                <div><p className="text-gray-400">Date</p><p className="font-semibold">{new Date(selectedOrder.createdAt).toLocaleDateString()}</p></div>
              </div>
              <table className="w-full text-sm border-t pt-4">
                <thead><tr className="text-left text-gray-500"><th>Product</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {selectedOrder.items?.map((item: any) => (
                    <tr key={item.id} className="border-t">
                      <td className="py-2">{item.product?.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">SAR {item.price?.toFixed(2)}</td>
                      <td className="text-right font-medium">SAR {item.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>SAR {selectedOrder.subtotal?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>SAR {selectedOrder.taxAmount?.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-[#8D1B3D]">SAR {selectedOrder.total?.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Confirm Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-2">Generate Invoice</h3>
            <p className="text-gray-500 text-sm mb-6">Generate invoice for order <strong>{selectedOrder.orderNumber}</strong>?<br />Total: <strong className="text-[#8D1B3D]">SAR {selectedOrder.total?.toFixed(2)}</strong></p>
            <div className="flex gap-3">
              <button onClick={() => { setShowInvoiceModal(false); setSelectedOrder(null); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => generateInvoice.mutate(selectedOrder.id)} disabled={generateInvoice.isPending} className="btn-primary flex-1">
                {generateInvoice.isPending ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
