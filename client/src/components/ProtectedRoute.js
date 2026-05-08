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

  // Nota: La suscripción expirada se maneja ahora como un overlay en App.js
  // para permitir que la app se vea de fondo.

  // Si no está autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
