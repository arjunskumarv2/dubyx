import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import Collections from './pages/Collections';
import GPSTracking from './pages/GPSTracking';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import RouteManagement from './pages/RouteManagement';
import VanManagement from './pages/VanManagement';
import Attendance from './pages/Attendance';

const ProtectedRoute = ({ children, roles }: { children: JSX.Element; roles?: string[] }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="customers" element={<Customers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="collections" element={<Collections />} />
        <Route path="gps" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><GPSTracking /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><Reports /></ProtectedRoute>} />
        <Route path="routes" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><RouteManagement /></ProtectedRoute>} />
        <Route path="vans" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><VanManagement /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><Attendance /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><Users /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
