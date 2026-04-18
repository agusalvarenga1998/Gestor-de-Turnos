import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AdminAuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { token, admin: adminData } = response.data;
        localStorage.setItem('adminToken', token);
        setToken(token);
        setAdmin(adminData);
        return { success: true };
      } else {
        setError(response.data.error || 'Error al iniciar sesión');
        return { success: false, error: response.data.error };
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Error al iniciar sesión';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setAdmin(null);
  };

  const value = {
    admin,
    token,
    loading,
    error,
    isAuthenticated: !!admin && !!token,
    login,
    logout,
    setError
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
