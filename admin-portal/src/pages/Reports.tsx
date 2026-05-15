import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Package, DollarSign, BarChart3, Clock, Users } from 'lucide-react';
import api from '../services/api';

const COLORS = ['#8D1B3D', '#C9A84C', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];

const fmt = (n: number) => `QAR ${n.toFixed(0)}`;
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

type Tab = 'sales' | 'stock' | 'product' | 'balance' | 'aging';

export default function Reports() {
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const params = { from, to };

  const { data: performance = [] } = useQuery({
    queryKey: ['salesman-performance', from, to],
    queryFn: () => api.get('/reports/salesman-performance', { params }).then(r => r.data),
    enabled: tab === 'sales',
  });

  const { data: sales } = useQuery({
    queryKey: ['sales-report', from, to],
    queryFn: () => api.get('/reports/sales', { params }).then(r => r.data),
    enabled: tab === 'sales',
  });

  const { data: collections } = useQuery({
    queryKey: ['collections-report', from, to],
    queryFn: () => api.get('/reports/collections', { params }).then(r => r.data),
    enabled: tab === 'sales',
  });

  const { data: stock } = useQuery({
    queryKey: ['stock-report'],
    queryFn: () => api.get('/reports/stock').then(r => r.data),
    enabled: tab === 'stock',
  });

  const { data: productWise } = useQuery({
    queryKey: ['product-wise-report', from, to],
    queryFn: () => api.get('/reports/product-wise', { params }).then(r => r.data),
    enabled: tab === 'product',
  });

  const { data: balance } = useQuery({
    queryKey: ['balance-report', from, to],
    queryFn: () => api.get('/reports/balance', { params }).then(r => r.data),
    enabled: tab === 'balance',
  });

  const { data: aging } = useQuery({
    queryKey: ['aging-report'],
    queryFn: () => api.get('/reports/aging').then(r => r.data),
    enabled: tab === 'aging',
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'sales', label: 'Sales Performance', icon: TrendingUp },
    { key: 'stock', label: 'Stock Report', icon: Package },
    { key: 'product', label: 'Product Wise', icon: BarChart3 },
    { key: 'balance', label: 'Balance', icon: DollarSign },
    { key: 'aging', label: 'Aging', icon: Clock },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar + date range */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-[#8D1B3D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        {tab !== 'stock' && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input py-1.5 w-36 text-sm" />
            <span className="text-gray-400">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input py-1.5 w-36 text-sm" />
          </div>
        )}
      </div>

      {/* ── SALES PERFORMANCE TAB ── */}
      {tab === 'sales' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(sales?.totalRevenue || 0) },
              { label: 'Total Orders', value: sales?.totalOrders || 0 },
              { label: 'Tax Collected', value: fmt(sales?.totalTax || 0) },
              { label: 'Collections', value: fmt(collections?.total || 0) },
            ].map(({ label, value }) => (
              <div key={label} className="card p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Users size={15} />Salesman Performance</h3>
              {performance.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={performance} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="totalRevenue" fill="#8D1B3D" radius={[0, 4, 4, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>}
            </div>

            {collections?.byMethod && Object.keys(collections.byMethod).length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Collections by Method</h3>
                <div className="flex items-center gap-6">
                  <PieChart width={160} height={160}>
                    <Pie data={Object.entries(collections.byMethod).map(([k, v]) => ({ name: k, value: v }))} cx={80} cy={80} innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value">
                      {Object.keys(collections.byMethod).map((_: string, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  </PieChart>
                  <div className="flex flex-col gap-2">
                    {Object.entries(collections.byMethod).map(([method, amount], i) => (
                      <div key={method} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600">{method.replace('_', ' ')}</span>
                        <span className="font-bold ml-auto">{fmt(Number(amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {performance.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">Detailed Salesman Report</div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Salesman', 'Area', 'Orders', 'Revenue', 'Collections'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {performance.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.area || '-'}</td>
                      <td className="px-4 py-3">{s.totalOrders}</td>
                      <td className="px-4 py-3 font-semibold text-[#8D1B3D]">{fmt(s.totalRevenue)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{fmt(s.totalCollections)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── STOCK REPORT TAB ── */}
      {tab === 'stock' && stock && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Products', value: stock.totalItems },
              { label: 'Cost Value', value: fmt(stock.totalCostValue) },
              { label: 'Selling Value', value: fmt(stock.totalSellingValue) },
              { label: 'Low Stock Items', value: stock.lowStockCount },
            ].map(({ label, value }) => (
              <div key={label} className="card p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">Inventory by Category</div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">{['Category', 'Products', 'Total Stock', 'Cost Value', 'Selling Value'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {(stock.byCategory || []).map((c: any) => (
                  <tr key={c.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.products}</td>
                    <td className="px-4 py-3">{c.totalStock}</td>
                    <td className="px-4 py-3 text-[#8D1B3D] font-semibold">{fmt(c.costValue)}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{fmt(c.sellingValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">All Products</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Product', 'SKU', 'Category', 'Stock', 'Min', 'Cost', 'Selling', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(stock.products || []).map((p: any) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.currentStock === 0 ? 'bg-red-50/40' : p.currentStock <= p.minStock ? 'bg-yellow-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="px-4 py-3 text-gray-500">{p.category?.name}</td>
                      <td className="px-4 py-3 font-bold">{p.currentStock} <span className="text-gray-400 font-normal text-xs">{p.unit}</span></td>
                      <td className="px-4 py-3 text-gray-400">{p.minStock}</td>
                      <td className="px-4 py-3">QAR {p.costPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3">QAR {p.sellingPrice?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.currentStock === 0 ? 'bg-red-100 text-red-700' : p.currentStock <= p.minStock ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {p.currentStock === 0 ? 'Out of Stock' : p.currentStock <= p.minStock ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT WISE TAB ── */}
      {tab === 'product' && (
        <div className="space-y-5">
          {productWise && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Revenue', value: fmt(productWise.totalRevenue || 0) },
                { label: 'Total Qty Sold', value: productWise.totalQuantity || 0 },
                { label: 'Total Profit', value: fmt(productWise.totalProfit || 0) },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">Product-wise Sales</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['#', 'Product', 'SKU', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Orders'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(productWise?.products || []).map((p: any, i: number) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs font-bold">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3">{p.quantity} <span className="text-gray-400 text-xs">{p.unit}</span></td>
                      <td className="px-4 py-3 font-semibold text-[#8D1B3D]">{fmt(p.revenue)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(p.costValue)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{fmt(p.revenue - p.costValue)}</td>
                      <td className="px-4 py-3 text-gray-500">{p.orders}</td>
                    </tr>
                  ))}
                  {!productWise?.products?.length && (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400">No sales data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BALANCE TAB ── */}
      {tab === 'balance' && balance && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Opening Balance', value: fmt(balance.openingBalance), color: 'text-gray-900' },
              { label: 'Sales (Period)', value: fmt(balance.totalSales), color: 'text-[#8D1B3D]' },
              { label: 'Collected (Period)', value: fmt(balance.totalCollected), color: 'text-green-600' },
              { label: 'Closing Balance', value: fmt(balance.closingBalance), color: balance.closingBalance > 0 ? 'text-orange-600' : 'text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">Outstanding Invoices</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Invoice #', 'Customer', 'Area', 'Total', 'Paid', 'Outstanding', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(balance.pendingInvoices || []).map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium">{inv.customer}</td>
                      <td className="px-4 py-3 text-gray-500">{inv.area}</td>
                      <td className="px-4 py-3">{fmt(inv.total)}</td>
                      <td className="px-4 py-3 text-green-600">{fmt(inv.paidAmount)}</td>
                      <td className="px-4 py-3 font-bold text-[#8D1B3D]">{fmt(inv.outstanding)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : inv.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!balance.pendingInvoices?.length && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">No outstanding invoices</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Aging Report */}
      {tab === 'aging' && aging && (
        <div className="space-y-5">
          {/* Summary buckets */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Current', key: 'current', color: 'text-green-600', bg: 'bg-green-50' },
              { label: '1–30 Days', key: 'days30', color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: '31–60 Days', key: 'days60', color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: '61–90 Days', key: 'days90', color: 'text-red-500', bg: 'bg-red-50' },
              { label: '90+ Days', key: 'over90', color: 'text-red-700', bg: 'bg-red-100' },
            ].map(({ label, key, color, bg }) => (
              <div key={key} className={`card p-4 ${bg}`}>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{fmt(aging.totals[key])}</p>
                <p className="text-xs text-gray-400 mt-0.5">{aging.buckets[key]?.length || 0} invoices</p>
              </div>
            ))}
          </div>

          <div className="card p-4 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Total Outstanding</span>
            <span className="text-2xl font-bold text-[#8D1B3D]">{fmt(aging.grandTotal)}</span>
          </div>

          {/* Aging table per bucket */}
          {[
            { label: 'Current (Not Yet Due)', key: 'current', headerColor: 'bg-green-50' },
            { label: 'Overdue 1–30 Days', key: 'days30', headerColor: 'bg-yellow-50' },
            { label: 'Overdue 31–60 Days', key: 'days60', headerColor: 'bg-orange-50' },
            { label: 'Overdue 61–90 Days', key: 'days90', headerColor: 'bg-red-50' },
            { label: 'Overdue 90+ Days', key: 'over90', headerColor: 'bg-red-100' },
          ].filter(({ key }) => aging.buckets[key]?.length > 0).map(({ label, key, headerColor }) => (
            <div key={key} className="card overflow-hidden">
              <div className={`px-5 py-3 ${headerColor}`}>
                <h3 className="font-semibold text-gray-800 text-sm">{label} — {aging.buckets[key].length} invoices</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b">
                    {['Invoice #', 'Customer', 'Area', 'Due Date', 'Days Overdue', 'Total', 'Balance', 'Status'].map(h =>
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    )}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {aging.buckets[key].map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-[#8D1B3D]">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 font-medium">{inv.customer?.shopName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.customer?.area || '—'}</td>
                        <td className="px-4 py-3 text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-xs ${inv.daysOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : 'Not due'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{fmt(inv.total)}</td>
                        <td className="px-4 py-3 font-bold text-[#8D1B3D]">{fmt(inv.balance)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.paymentStatus === 'OVERDUE' ? 'bg-red-100 text-red-700' : inv.paymentStatus === 'PARTIAL' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {inv.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
