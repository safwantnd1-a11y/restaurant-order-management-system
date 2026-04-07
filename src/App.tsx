import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import WaiterDashboard from './pages/waiter/Dashboard';
import KitchenDashboard from './pages/kitchen/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';

import BillerDashboard from './pages/biller/Dashboard';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading ROMS…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return <>{children}</>;
};

const RoleBasedHome = () => {
  const { user } = useAuth();
  
  switch (user?.role) {
    case 'admin': return <AdminDashboard />;
    case 'waiter': return <WaiterDashboard />;
    case 'kitchen': return <KitchenDashboard />;
    case 'biller': return <BillerDashboard />;
    default: return <Navigate to="/login" />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <RoleBasedHome />
              </ProtectedRoute>
            } 
          />
          {/* Explicit routes for direct access if needed */}
          <Route 
            path="/waiter" 
            element={
              <ProtectedRoute roles={['waiter', 'admin']}>
                <WaiterDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/kitchen" 
            element={
              <ProtectedRoute roles={['kitchen', 'admin']}>
                <KitchenDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/biller" 
            element={
              <ProtectedRoute roles={['biller', 'admin']}>
                <BillerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
