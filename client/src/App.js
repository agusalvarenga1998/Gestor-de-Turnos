import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { useAuth } from './hooks/useAuth';

// Páginas - Doctor
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardNewPage from './pages/DashboardNewPage';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientsPage from './pages/PatientsPage';
import SettingsPage from './pages/SettingsPage';
import WorkingHoursPage from './pages/WorkingHoursPage';
import InsurancePage from './pages/InsurancePage';
import ServicesPage from './pages/ServicesPage';
import PatientPortalHomePage from './pages/PatientPortalHomePage';
import PatientAppointmentViewPage from './pages/PatientAppointmentViewPage';
import ConfirmAppointmentPage from './pages/ConfirmAppointmentPage';
import NotFoundPage from './pages/NotFoundPage';
import AccountPendingPage from './pages/AccountPendingPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import SuspendedPage from './pages/SuspendedPage';

// Páginas - Admin
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDoctorsPage from './pages/AdminDoctorsPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';

// Páginas - Info / Landing
import WhyTurnoHubPage from './pages/WhyTurnoHubPage';
import HelpCenterPage from './pages/HelpCenterPage';
import SupportPage from './pages/SupportPage';

// Componentes
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import Loading from './components/Loading';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return (
    <Routes>
      {/* Portal del Cliente (públicas) - siempre disponible */}
      <Route path="/patient" element={<PatientPortalHomePage />} />
      <Route path="/patient/appointment/:appointmentCode" element={<PatientAppointmentViewPage />} />
      <Route path="/appointment/:token" element={<ConfirmAppointmentPage />} />

      {/* Rutas de autenticación (siempre disponibles) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/account-pending" element={<AccountPendingPage />} />
      <Route path="/account-suspended" element={<SuspendedPage />} />
      <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />

      {/* Páginas Informativas */}
      <Route path="/why-turnohub" element={<WhyTurnoHubPage />} />
      <Route path="/help-center" element={<HelpCenterPage />} />
      <Route path="/support" element={<SupportPage />} />

      {/* Rutas del Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedAdminRoute>
            <AdminDashboardPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/doctors"
        element={
          <ProtectedAdminRoute>
            <AdminDoctorsPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/subscriptions"
        element={
          <ProtectedAdminRoute>
            <AdminSubscriptionsPage />
          </ProtectedAdminRoute>
        }
      />

      {/* Rutas protegidas del doctor */}
      {isAuthenticated && (
        <>
          <Route path="/dashboard" element={<DashboardNewPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/insurance" element={<InsurancePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/working-hours" element={<WorkingHoursPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/reports" element={<DashboardNewPage />} />
          <Route path="/doctor/*" element={<DashboardNewPage />} />
        </>
      )}

      {/* Redirecciones por defecto */}
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="*" element={isAuthenticated ? <NotFoundPage /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AdminAuthProvider>
        <AuthProvider>
          <WebSocketProvider>
            <AppContent />
          </WebSocketProvider>
        </AuthProvider>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;
