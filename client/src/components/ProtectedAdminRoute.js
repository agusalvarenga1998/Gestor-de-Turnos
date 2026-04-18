import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import Loading from './Loading';

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
