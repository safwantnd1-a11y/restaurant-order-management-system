import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import WaiterLogin from './pages/WaiterLogin';
import WaiterDashboard from './pages/waiter/Dashboard';
import KitchenDashboard from './pages/kitchen/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import QRMenu from './pages/customer/QRMenu';

// ── Detect if this is a Waiter-only APK build ───────────────────────────────
// Set VITE_APP_MODE=waiter in .env.waiter when building the APK
const IS_WAITER_APP = import.meta.env.VITE_APP_MODE === 'waiter';

interface EBProps { children: React.ReactNode; }
interface EBState { hasError: boolean; }

class ErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  render(): React.ReactNode {
    if (this.state.hasError) return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0a0a0f] text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-xs">The application encountered an unexpected error.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm">Reload App</button>
      </div>
    );
    // @ts-ignore
    const { children } = this.props;
    return children;
  }
}

// ── Protected route ──────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { user } = useAuth();
  const loginPath = IS_WAITER_APP ? '/waiter-login' : '/login';
  if (!user) return <Navigate to={loginPath} />;
  // In waiter-app mode: hard block any non-waiter role
  if (IS_WAITER_APP && user.role !== 'waiter') return <Navigate to="/waiter-login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <ErrorBoundary>{children}</ErrorBoundary>;
};

// ── Role-based home ──────────────────────────────────────────────────────────
const RoleBasedHome = () => {
  const { user } = useAuth();
  if (IS_WAITER_APP) {
    return user?.role === 'waiter' ? <WaiterDashboard /> : <Navigate to="/waiter-login" />;
  }
  switch (user?.role) {
    case 'admin':   return <AdminDashboard />;
    case 'waiter':  return <WaiterDashboard />;
    case 'kitchen': return <KitchenDashboard />;
    default:        return <Navigate to="/login" />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {IS_WAITER_APP ? (
            // ── Waiter-only APK mode ───────────────────────────────────────
            <>
              <Route path="/waiter-login" element={<WaiterLogin />} />
              <Route path="/" element={<ProtectedRoute><RoleBasedHome /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/waiter-login" />} />
            </>
          ) : (
            // ── Full Web App mode (Admin + Kitchen + Waiter) ───────────────
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/waiter-login" element={<WaiterLogin />} />
              <Route path="/" element={<ProtectedRoute><RoleBasedHome /></ProtectedRoute>} />
              <Route path="/waiter" element={<ProtectedRoute roles={['waiter', 'admin']}><WaiterDashboard /></ProtectedRoute>} />
              <Route path="/kitchen" element={<ProtectedRoute roles={['kitchen', 'admin']}><KitchenDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              {/* Public QR self-ordering — no auth required */}
              <Route path="/qr/table/:tableNumber" element={<QRMenu />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
