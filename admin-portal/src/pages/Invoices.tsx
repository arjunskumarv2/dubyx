import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, Eye, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const statusColors: Record<string, string> = {
  PENDING: 'badge-pending', PARTIAL: 'badge-partial', PAID: 'badge-paid', OVERDUE: 'badge-overdue',
};

export default function Invoices() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'CASH', reference: '', notes: '' });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', search, paymentStatus],
    queryFn: () => api.get('/invoices', { params: { search, paymentStatus } }).then(r => r.data),
  });

  const recordPayment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof payForm }) => api.post(`/invoices/${id}/payment`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded!');
      setShowPayModal(false);
      setSelectedInvoice(null);
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const downloadPDF = async (invoice: any) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="input pl-9" />
        </div>
        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="input w-44">
          <option value="">All Status</option>
          {['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Invoice #', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No invoices found</td></tr>
              ) : invoices.map((inv: any) => {
                const balance = inv.total - inv.paidAmount;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-[#8D1B3D]">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{inv.customer?.shopName}</p>
                      <p className="text-xs text-gray-400">{inv.customer?.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">QAR {inv.total?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-600">QAR {inv.paidAmount?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium text-orange-600">QAR {balance?.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={statusColors[inv.paymentStatus]}>{inv.paymentStatus}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedInvoice(inv)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Eye size={14} /></button>
                        <button onClick={() => downloadPDF(inv)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Download size={14} /></button>
                        {inv.paymentStatus !== 'PAID' && (
                          <button onClick={() => { setSelectedInvoice(inv); setShowPayModal(true); setPayForm({ amount: balance, method: 'CASH', reference: '', notes: '' }); }} className="p-1.5 hover:bg-green-50 rounded text-green-600"><DollarSign size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="bg-[#8D1B3D] px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-bold">Record Payment</h3>
              <button onClick={() => { setShowPayModal(false); setSelectedInvoice(null); }} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-mono font-medium">{selectedInvoice.invoiceNumber}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Balance Due</span><span className="font-bold text-[#8D1B3D]">QAR {(selectedInvoice.total - selectedInvoice.paidAmount)?.toFixed(2)}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (QAR)</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} className="input" max={selectedInvoice.total - selectedInvoice.paidAmount} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} className="input">
                  {['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input type="text" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} className="input" placeholder="Cheque no, transfer ref..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowPayModal(false); setSelectedInvoice(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => recordPayment.mutate({ id: selectedInvoice.id, data: payForm })} disabled={recordPayment.isPending} className="btn-primary flex-1">
                  {recordPayment.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
