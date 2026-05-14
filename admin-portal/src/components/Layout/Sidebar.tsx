import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, Package, FileText,
  DollarSign, MapPin, BarChart3, Settings, UserCog, LogOut
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/collections', label: 'Collections', icon: DollarSign },
];

const adminNavItems = [
  { path: '/gps', label: 'GPS Tracking', icon: MapPin, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { path: '/users', label: 'Staff', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const canAccess = (roles?: string[]) => !roles || roles.includes(user?.role || '');

  return (
    <aside className="w-64 bg-[#8D1B3D] flex flex-col shadow-xl">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#C9A84C] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">D</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Dubyx</h1>
            <p className="text-white/50 text-xs">Sales Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {adminNavItems.filter(item => canAccess(item.roles)).length > 0 && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-white/30 text-xs font-semibold uppercase tracking-wider mb-1">Management</p>
            {adminNavItems.filter(item => canAccess(item.roles)).map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-[#C9A84C] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/50 text-xs truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button onClick={logout} className="text-white/50 hover:text-white transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
