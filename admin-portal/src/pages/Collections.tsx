import { useQuery } from '@tanstack/react-query';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

const methodColors: Record<string, string> = { CASH: 'bg-green-100 text-green-700', BANK_TRANSFER: 'bg-blue-100 text-blue-700', CHEQUE: 'bg-purple-100 text-purple-700', CREDIT_CARD: 'bg-indigo-100 text-indigo-700' };

export default function Collections() {
  const { data: todayData } = useQuery({
    queryKey: ['collections-today'],
    queryFn: () => api.get('/collections/today').then(r => r.data),
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['collections-pending'],
    queryFn: () => api.get('/collections/pending').then(r => r.data),
  });

  const { data: allCollections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get('/collections').then(r => r.data),
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-500 rounded-xl flex items-center justify-center"><CheckCircle size={20} className="text-white" /></div>
            <div>
              <p className="text-sm text-gray-500">Today's Collections</p>
              <p className="text-2xl font-bold text-gray-900">QAR {(todayData?.total || 0).toFixed(0)}</p>
              <p className="text-xs text-gray-400">{todayData?.count || 0} transactions</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center"><Clock size={20} className="text-white" /></div>
            <div>
              <p className="text-sm text-gray-500">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">QAR {pending.reduce((s: number, p: any) => s + p.balance, 0).toFixed(0)}</p>
              <p className="text-xs text-gray-400">{pending.length} invoices</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#8D1B3D] rounded-xl flex items-center justify-center"><DollarSign size={20} className="text-white" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="text-2xl font-bold text-gray-900">QAR {allCollections.reduce((s: number, c: any) => s + c.amount, 0).toFixed(0)}</p>
              <p className="text-xs text-gray-400">All time</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Collections */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500" />
            <h3 className="font-semibold text-gray-900">Pending Invoices</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {pending.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No pending collections</div>
            ) : pending.map((inv: any) => (
              <div key={inv.id} className="px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{inv.customer?.shopName}</p>
                    <p className="text-xs text-gray-400">{inv.invoiceNumber} &bull; {inv.customer?.area}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#8D1B3D]">QAR {inv.balance?.toFixed(2)}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.paymentStatus === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{inv.paymentStatus}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Collections */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Collections</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {allCollections.slice(0, 20).map((c: any) => (
              <div key={c.id} className="px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{c.customer?.shopName}</p>
                    <p className="text-xs text-gray-400">by {c.collectedBy?.name} &bull; {new Date(c.collectedAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">QAR {c.amount?.toFixed(2)}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${methodColors[c.method] || 'bg-gray-100 text-gray-600'}`}>{c.method?.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
