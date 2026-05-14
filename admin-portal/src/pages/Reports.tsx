import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';

const COLORS = ['#8D1B3D', '#C9A84C', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];

export default function Reports() {
  const { data: performance = [] } = useQuery({
    queryKey: ['salesman-performance'],
    queryFn: () => api.get('/reports/salesman-performance').then(r => r.data),
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-products'],
    queryFn: () => api.get('/reports/top-products').then(r => r.data),
  });

  const { data: sales } = useQuery({
    queryKey: ['sales-report'],
    queryFn: () => api.get('/reports/sales').then(r => r.data),
  });

  const { data: collections } = useQuery({
    queryKey: ['collections-report'],
    queryFn: () => api.get('/reports/collections').then(r => r.data),
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `QAR ${(sales?.totalRevenue || 0).toFixed(0)}` },
          { label: 'Total Orders', value: sales?.totalOrders || 0 },
          { label: 'Tax Collected', value: `QAR ${(sales?.totalTax || 0).toFixed(0)}` },
          { label: 'Collections', value: `QAR ${(collections?.total || 0).toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Salesman Performance */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Salesman Performance</h3>
          {performance.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={performance} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: any) => `QAR ${Number(v).toFixed(0)}`} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="totalRevenue" fill="#8D1B3D" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>

        {/* Top Products */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {topProducts.slice(0, 10).map((p: any, i: number) => (
                <div key={p.product?.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{p.product?.name}</span>
                      <span className="text-sm font-bold text-gray-900 ml-2">QAR {p.revenue?.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${(p.revenue / topProducts[0]?.revenue) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{p.quantity} sold</span>
                </div>
              ))}
            </div>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>
      </div>

      {/* Collections by Method */}
      {collections?.byMethod && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Collections by Payment Method</h3>
          <div className="flex items-center gap-8">
            <div className="w-48 h-48 flex-shrink-0">
              <PieChart width={192} height={192}>
                <Pie data={Object.entries(collections.byMethod).map(([k, v]) => ({ name: k, value: v }))} cx={96} cy={96} innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                  {Object.keys(collections.byMethod).map((_: string, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `QAR ${Number(v).toFixed(0)}`} />
              </PieChart>
            </div>
            <div className="flex flex-col gap-2">
              {Object.entries(collections.byMethod).map(([method, amount], i) => (
                <div key={method} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 font-medium">{method.replace('_', ' ')}</span>
                  <span className="text-gray-900 font-bold ml-auto">QAR {Number(amount).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Salesman Table */}
      {performance.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Detailed Salesman Report</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Salesman', 'Area', 'Orders', 'Revenue', 'Collections'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {performance.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.area || '-'}</td>
                  <td className="px-4 py-3">{s.totalOrders}</td>
                  <td className="px-4 py-3 font-semibold text-[#8D1B3D]">QAR {s.totalRevenue?.toFixed(0)}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">QAR {s.totalCollections?.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
