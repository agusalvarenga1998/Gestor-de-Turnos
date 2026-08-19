import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSellerAuth } from '../context/SellerAuthContext';
import Loading from './Loading';

const ProtectedSellerRoute = ({ children }) => {
  const { isAuthenticated, loading } = useSellerAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/seller/login" replace />;
  }

  return children;
};

export default ProtectedSellerRoute;
