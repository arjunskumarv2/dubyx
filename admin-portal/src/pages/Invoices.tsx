import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, Eye, DollarSign, FileCode2, Undo2, QrCode, ShieldCheck } from 'lucide-react';
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
  const [noteInvoice, setNoteInvoice] = useState<any>(null);
  const [noteForm, setNoteForm] = useState({ amount: 0, reason: '', kind: 'CREDIT_NOTE' });

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

  // ZATCA: an issued tax invoice can never be edited or deleted — corrections
  // are raised as a credit or debit note that references the original.
  const createNote = useMutation({
    mutationFn: (data: any) => api.post('/invoices/credit-note', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Note issued');
      setNoteInvoice(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to issue note'),
  });

  const downloadXML = async (invoice: any) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}/xml`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download XML');
    }
  };

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
                {['Invoice #', 'Type', 'Customer', 'Total', 'Paid', 'Balance', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No invoices found</td></tr>
              ) : invoices.map((inv: any) => {
                const balance = inv.total - inv.paidAmount;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-[#8D1B3D]">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {inv.invoiceKind !== 'INVOICE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700">
                          {inv.invoiceKind === 'CREDIT_NOTE' ? 'CREDIT NOTE' : 'DEBIT NOTE'}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${inv.invoiceType === 'SIMPLIFIED' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'}`}>
                          {inv.invoiceType === 'SIMPLIFIED' ? 'SIMPLIFIED' : 'STANDARD'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{inv.customer?.shopName}</p>
                      <p className="text-xs text-gray-400">{inv.customer?.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">SAR {inv.total?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-600">SAR {inv.paidAmount?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium text-orange-600">SAR {balance?.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={statusColors[inv.paymentStatus]}>{inv.paymentStatus}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedInvoice(inv)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Eye size={14} /></button>
                        <button onClick={() => downloadPDF(inv)} title="Download tax invoice PDF" className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Download size={14} /></button>
                        <button onClick={() => downloadXML(inv)} title="Download ZATCA UBL 2.1 XML" className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600"><FileCode2 size={14} /></button>
                        {inv.invoiceKind === 'INVOICE' && (
                          <button
                            onClick={() => { setNoteInvoice(inv); setNoteForm({ amount: inv.total, reason: '', kind: 'CREDIT_NOTE' }); }}
                            title="Issue credit / debit note"
                            className="p-1.5 hover:bg-purple-50 rounded text-purple-600"
                          ><Undo2 size={14} /></button>
                        )}
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

      {/* ZATCA detail panel */}
      {selectedInvoice && !showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1F6F4A] px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-white/70 text-xs">
                  {selectedInvoice.invoiceKind === 'CREDIT_NOTE' ? 'Credit Note — إشعار دائن'
                    : selectedInvoice.invoiceKind === 'DEBIT_NOTE' ? 'Debit Note — إشعار مدين'
                    : selectedInvoice.invoiceType === 'SIMPLIFIED' ? 'Simplified Tax Invoice — فاتورة ضريبية مبسطة'
                    : 'Tax Invoice — فاتورة ضريبية'}
                </p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-gray-400 text-xs">Customer</p><p className="font-medium">{selectedInvoice.customer?.shopName}</p></div>
                <div><p className="text-gray-400 text-xs">Buyer VAT No.</p><p className="font-mono">{selectedInvoice.customer?.vatNumber || '—'}</p></div>
                <div><p className="text-gray-400 text-xs">Total excl. VAT</p><p>SAR {selectedInvoice.subtotal?.toFixed(2)}</p></div>
                <div><p className="text-gray-400 text-xs">VAT</p><p>SAR {selectedInvoice.taxAmount?.toFixed(2)}</p></div>
                <div><p className="text-gray-400 text-xs">Total incl. VAT</p><p className="font-bold text-[#1F6F4A]">SAR {selectedInvoice.total?.toFixed(2)}</p></div>
                <div><p className="text-gray-400 text-xs">Status</p><p><span className={statusColors[selectedInvoice.paymentStatus]}>{selectedInvoice.paymentStatus}</span></p></div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="flex items-center gap-2 font-semibold text-gray-700 text-xs uppercase"><ShieldCheck size={13} /> ZATCA e-invoice</p>
                <div className="flex justify-between"><span className="text-gray-500">UUID</span><span className="font-mono text-[11px]">{selectedInvoice.uuid || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Invoice hash</span><span className="font-mono text-[11px] truncate max-w-[220px]">{selectedInvoice.invoiceHash || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Previous hash (PIH)</span><span className="font-mono text-[11px] truncate max-w-[220px]">{selectedInvoice.previousHash || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Clearance status</span><span className="font-medium">{selectedInvoice.zatcaStatus || 'NOT_SUBMITTED'}</span></div>
                {selectedInvoice.qrCode && (
                  <div>
                    <p className="text-gray-500 flex items-center gap-1 mb-1"><QrCode size={12} /> QR payload (Base64 TLV)</p>
                    <p className="font-mono text-[10px] break-all bg-white rounded p-2 border border-gray-100">{selectedInvoice.qrCode}</p>
                  </div>
                )}
              </div>

              {selectedInvoice.noteReason && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-purple-500">Reason for issue</p>
                  <p className="text-purple-900">{selectedInvoice.noteReason}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => downloadPDF(selectedInvoice)} className="btn-secondary flex-1 flex items-center justify-center gap-2"><Download size={14} /> PDF</button>
                <button onClick={() => downloadXML(selectedInvoice)} className="btn-secondary flex-1 flex items-center justify-center gap-2"><FileCode2 size={14} /> XML</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit / debit note */}
      {noteInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="bg-purple-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-bold">Issue Note — {noteInvoice.invoiceNumber}</h3>
              <button onClick={() => setNoteInvoice(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                A tax invoice cannot be edited or deleted once issued. Corrections are made with a credit note (reduces the amount) or a debit note (increases it), referencing the original invoice.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select value={noteForm.kind} onChange={e => setNoteForm({ ...noteForm, kind: e.target.value })} className="input">
                  <option value="CREDIT_NOTE">Credit Note — إشعار دائن</option>
                  <option value="DEBIT_NOTE">Debit Note — إشعار مدين</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount incl. VAT (SAR)</label>
                <input type="number" value={noteForm.amount} max={noteInvoice.total}
                  onChange={e => setNoteForm({ ...noteForm, amount: Number(e.target.value) })} className="input" />
                <p className="text-xs text-gray-400 mt-1">Original invoice total: SAR {noteInvoice.total?.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for issue *</label>
                <input value={noteForm.reason} onChange={e => setNoteForm({ ...noteForm, reason: e.target.value })}
                  className="input" placeholder="e.g. Damaged goods returned by customer" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setNoteInvoice(null)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => createNote.mutate({ invoiceId: noteInvoice.id, amount: noteForm.amount, reason: noteForm.reason, kind: noteForm.kind })}
                  disabled={createNote.isPending || !noteForm.reason}
                  className="btn-primary flex-1"
                >
                  {createNote.isPending ? 'Issuing...' : 'Issue Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div className="flex justify-between mt-1"><span className="text-gray-500">Balance Due</span><span className="font-bold text-[#8D1B3D]">SAR {(selectedInvoice.total - selectedInvoice.paidAmount)?.toFixed(2)}</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (SAR)</label>
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
