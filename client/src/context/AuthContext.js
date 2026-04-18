import React, { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await authAPI.verify(token);
          if (response.success) {
            setUser(response.doctor);
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        } catch (err) {
          console.error('Error verificando token:', err);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      if (response.success) {
        const { token, doctor } = response;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(doctor);
        return { success: true };
      } else {
        setError(response.message);
        return { success: false, error: response.message };
      }
    } catch (err) {
      const errorData = err.response?.data;
      const message = errorData?.message || 'Error al iniciar sesión';

      // Manejar errores especiales
      if (errorData?.pending) {
        setError(message);
        return { success: false, error: message, pending: true };
      }

      if (errorData?.subscriptionExpired) {
        setError(message);
        return { success: false, error: message, subscriptionExpired: true };
      }

      if (errorData?.suspended) {
        setError(message);
        return { success: false, error: message, suspended: true };
      }

      if (errorData?.rejected) {
        setError(message);
        return { success: false, error: message };
      }

      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(data);
      if (response.success) {
        // Si la respuesta es pending, no hay token
        if (response.pending) {
          return { success: true, pending: true, message: response.message };
        }
        // Caso normal con token (después cuando MercadoPago esté implementado)
        const { token, doctor } = response;
        localStorage.setItem('token', token);
        setToken(token);
        setUser(doctor);
        return { success: true };
      } else {
        setError(response.message);
        return { success: false, error: response.message };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error al registrar';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authAPI.logout(token);
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const loginWithGoogle = async (jwtToken) => {
    try {
      setLoading(true);
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
      // El useEffect de verificación de token se encargará de cargar los datos del usuario
      return { success: true };
    } catch (err) {
      console.error('Error en loginWithGoogle:', err);
      return { success: false, error: 'Error al procesar login con Google' };
    }
  };

  // Computed values
  const isPending = user?.status === 'pending';
  const isSubscriptionExpired = user?.subscription_status === 'expired';

  const refreshUser = async () => {
    if (token) {
      try {
        const response = await authAPI.verify(token);
        if (response.success) {
          setUser(response.doctor);
        }
      } catch (err) {
        console.error('Error refrescando usuario:', err);
      }
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user && !!token && !isPending && !isSubscriptionExpired,
    isPending,
    isSubscriptionExpired,
    login,
    register,
    logout,
    loginWithGoogle,
    refreshUser,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
