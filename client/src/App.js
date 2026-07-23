import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
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
import PatientHistoryPage from './pages/PatientHistoryPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import MovementsPage from './pages/MovementsPage';
import NotificationsPage from './pages/NotificationsPage';
import WorkingHoursPage from './pages/WorkingHoursPage';
import InsurancePage from './pages/InsurancePage';
import ServicesPage from './pages/ServicesPage';
import OnboardingPage from './pages/OnboardingPage';
import PatientPortalHomePage from './pages/PatientPortalHomePage';
import PatientAppointmentViewPage from './pages/PatientAppointmentViewPage';
import ConfirmAppointmentPage from './pages/ConfirmAppointmentPage';
import NotFoundPage from './pages/NotFoundPage';
import AccountPendingPage from './pages/AccountPendingPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import SuspendedPage from './pages/SuspendedPage';
import InstallAppPage from './pages/InstallAppPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Páginas - Admin
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDoctorsPage from './pages/AdminDoctorsPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';
import AdminPlansPage from './pages/AdminPlansPage';
import AdminTemplateServicesPage from './pages/AdminTemplateServicesPage';
import AdminTemplateInsurancesPage from './pages/AdminTemplateInsurancesPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminSupportTicketsPage from './pages/AdminSupportTicketsPage';
import AdminActivityPage from './pages/AdminActivityPage';

// Páginas - Info / Landing
import LandingPage from './pages/LandingPage';
import WhyTurnoHubPage from './pages/WhyTurnoHubPage';
import HelpCenterPage from './pages/HelpCenterPage';
import SupportPage from './pages/SupportPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';

// Componentes
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import Loading from './components/Loading';
import WhatsAppBubble from './components/WhatsAppBubble';
import ErrorBoundary from './components/ErrorBoundary';

function PageTracker() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const lastTracked = useRef({ path: '', time: 0 });

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'admin') return;

    const currentPath = location.pathname;
    const now = Date.now();

    // Evitar enviar duplicados si navega rápido o recarga la misma ruta (5 seg)
    if (lastTracked.current.path === currentPath && (now - lastTracked.current.time) < 5000) {
      return;
    }

    lastTracked.current = { path: currentPath, time: now };

    const screenMap = {
      '/dashboard': 'Dashboard Principal',
      '/appointments': 'Agenda y Gestión de Turnos',
      '/patients': 'Listado de Clientes / Pacientes',
      '/services': 'Mis Servicios',
      '/reports': 'Estadísticas y Reportes',
      '/movements': 'Caja y Movimientos de Dinero',
      '/insurance': 'Convenios y Obras Sociales',
      '/working-hours': 'Horarios de Atención',
      '/notifications': 'Centro de Notificaciones',
      '/settings': 'Configuración de Perfil',
      '/support': 'Soporte Técnico',
      '/onboarding': 'Guía de Inicio'
    };

    let pageName = screenMap[currentPath];
    if (!pageName) {
      if (currentPath.startsWith('/patients/')) pageName = 'Detalle de Paciente';
      else if (currentPath.startsWith('/admin/')) return;
      else pageName = currentPath;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = process.env.REACT_APP_API_BASE_URL || '';

    axios.post(`${baseUrl}/api/doctor/page-view`, {
      path: currentPath,
      pageName
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {
      // Ignorar errores silenciosamente
    });

  }, [location.pathname, isAuthenticated, user]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const { isAuthenticated, loading, isSubscriptionExpired, user } = useAuth();

  if (loading) {
    return <Loading />;
  }

  // Redirigir al profesional a la configuración si es su primer ingreso o no completó su perfil
  const isProfileIncomplete = isAuthenticated && user && (!user.rubro || !user.specialization || !user.address);
  if (isProfileIncomplete && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  return (
    <>
    <PageTracker />
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Páginas Informativas / Landing */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/why-turnohub" element={<WhyTurnoHubPage />} />
      <Route path="/help-center" element={<HelpCenterPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/install-app" element={<InstallAppPage />} />

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
      <Route
        path="/admin/plans"
        element={
          <ProtectedAdminRoute>
            <AdminPlansPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/template-services"
        element={
          <ProtectedAdminRoute>
            <AdminTemplateServicesPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/template-insurances"
        element={
          <ProtectedAdminRoute>
            <AdminTemplateInsurancesPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedAdminRoute>
            <AdminReportsPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/support-tickets"
        element={
          <ProtectedAdminRoute>
            <AdminSupportTicketsPage />
          </ProtectedAdminRoute>
        }
      />
      <Route
        path="/admin/activity"
        element={
          <ProtectedAdminRoute>
            <AdminActivityPage />
          </ProtectedAdminRoute>
        }
      />

      {/* Rutas protegidas del doctor */}
      {isAuthenticated && (
        <>
          <Route path="/dashboard" element={<DashboardNewPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patient-history/:patientId" element={<PatientHistoryPage />} />
          <Route path="/insurance" element={<InsurancePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/working-hours" element={<WorkingHoursPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/movements" element={<MovementsPage />} />
          <Route path="/doctor/*" element={<DashboardNewPage />} />
        </>
      )}

      {/* Redirecciones por defecto */}
      <Route path="*" element={isAuthenticated ? <NotFoundPage /> : <Navigate to="/" replace />} />
    </Routes>
    
    {/* Overlay de suscripción expirada */}
    {isAuthenticated && isSubscriptionExpired && (
      <SubscriptionExpiredPage />
    )}
    <WhatsAppBubble />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AdminAuthProvider>
          <AuthProvider>
            <WebSocketProvider>
              <AppContent />
            </WebSocketProvider>
          </AuthProvider>
        </AdminAuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
