import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Package, ShoppingCart, DollarSign, TrendingUp, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import api from '../services/api';

interface Stats {
  totalCustomers: number;
  totalProducts: number;
  todayOrders: number;
  monthOrders: number;
  todayCollections: number;
  monthCollections: number;
  pendingAmount: number;
  pendingInvoicesCount: number;
  lowStockProducts: number;
  activeSalesmen: number;
}

const StatCard = ({ icon: Icon, title, value, subtitle, color }: { icon: any; title: string; value: string | number; subtitle?: string; color: string }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

const chartData = [
  { day: 'Mon', orders: 12, collections: 3200 },
  { day: 'Tue', orders: 19, collections: 5100 },
  { day: 'Wed', orders: 15, collections: 4200 },
  { day: 'Thu', orders: 22, collections: 6800 },
  { day: 'Fri', orders: 28, collections: 8200 },
  { day: 'Sat', orders: 18, collections: 5400 },
  { day: 'Sun', orders: 8, collections: 2100 },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-[#8D1B3D] border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} title="Today's Orders" value={stats?.todayOrders || 0} subtitle={`${stats?.monthOrders || 0} this month`} color="bg-[#8D1B3D]" />
        <StatCard icon={DollarSign} title="Today's Collections" value={`QAR ${(stats?.todayCollections || 0).toFixed(0)}`} subtitle={`QAR ${(stats?.monthCollections || 0).toFixed(0)} this month`} color="bg-[#C9A84C]" />
        <StatCard icon={Clock} title="Pending Amount" value={`QAR ${(stats?.pendingAmount || 0).toFixed(0)}`} subtitle={`${stats?.pendingInvoicesCount || 0} invoices`} color="bg-orange-500" />
        <StatCard icon={UserCheck} title="Active Salesmen" value={stats?.activeSalesmen || 0} subtitle="Field executives" color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} title="Customers" value={stats?.totalCustomers || 0} subtitle="Active shops" color="bg-blue-500" />
        <StatCard icon={Package} title="Products" value={stats?.totalProducts || 0} subtitle="In catalogue" color="bg-purple-500" />
        <StatCard icon={AlertTriangle} title="Low Stock" value={stats?.lowStockProducts || 0} subtitle="Products need restock" color="bg-red-500" />
        <StatCard icon={TrendingUp} title="Month Orders" value={stats?.monthOrders || 0} subtitle="This month" color="bg-indigo-500" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Weekly Orders</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 13 }} />
              <Bar dataKey="orders" fill="#8D1B3D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Weekly Collections (QAR)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 13 }} />
              <Line type="monotone" dataKey="collections" stroke="#C9A84C" strokeWidth={2.5} dot={{ fill: '#C9A84C', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Order', href: '/orders', color: 'bg-[#8D1B3D]' },
            { label: 'Add Customer', href: '/customers', color: 'bg-[#C9A84C]' },
            { label: 'View Invoices', href: '/invoices', color: 'bg-blue-600' },
            { label: 'GPS Tracking', href: '/gps', color: 'bg-emerald-600' },
          ].map(({ label, href, color }) => (
            <a key={label} href={href} className={`${color} text-white rounded-xl py-4 text-center font-semibold text-sm hover:opacity-90 transition-opacity`}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
