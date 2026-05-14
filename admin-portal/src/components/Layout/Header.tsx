import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/orders': 'Orders',
  '/customers': 'Customers',
  '/inventory': 'Inventory',
  '/invoices': 'Invoices',
  '/collections': 'Collections',
  '/gps': 'GPS Tracking',
  '/reports': 'Reports',
  '/users': 'Staff Management',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const title = pageNames[location.pathname] || 'Dubyx';

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('en-QA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Quick search..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-800/20 focus:border-primary-800 w-56"
          />
        </div>

        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#8D1B3D] rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <div className="w-8 h-8 bg-[#8D1B3D] rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
