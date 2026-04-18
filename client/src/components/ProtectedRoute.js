import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Loading from './Loading';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, isPending, isSubscriptionExpired, user } = useAuth();

  if (loading) {
    return <Loading />;
  }

  // Si el usuario está pendiente de aprobación
  if (user && isPending) {
    return <Navigate to="/account-pending" replace />;
  }

  // Si la cuenta está suspendida
  if (user && user.status === 'suspended') {
    return <Navigate to="/account-suspended" replace />;
  }

  // Si la suscripción está expirada
  if (user && isSubscriptionExpired) {
    return <Navigate to="/subscription-expired" replace />;
  }

  // Si no está autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
