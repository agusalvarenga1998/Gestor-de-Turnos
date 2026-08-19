import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

export const SellerAuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export const SellerAuthProvider = ({ children }) => {
  const [seller, setSeller] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sellerToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isDemoMode, setIsDemoMode] = useState(localStorage.getItem('isDemoMode') === 'true');
  const [demoDoctorName, setDemoDoctorName] = useState(localStorage.getItem('demoDoctorName') || '');

  // Verificar sesión de vendedor al montar
  useEffect(() => {
    const verifySellerToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/seller/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.success) {
            setSeller(response.data.seller);
          } else {
            localStorage.removeItem('sellerToken');
            setToken(null);
          }
        } catch (err) {
          console.error('Error al verificar sesión de vendedor:', err);
          localStorage.removeItem('sellerToken');
          setToken(null);
        }
      }
      setLoading(false);
    };

    verifySellerToken();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/seller/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { token: newSellerToken, seller: sellerData } = response.data;
        localStorage.setItem('sellerToken', newSellerToken);
        setToken(newSellerToken);
        setSeller(sellerData);
        return { success: true };
      } else {
        setError(response.data.error || 'Error al iniciar sesión');
        return { success: false, error: response.data.error };
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Error al iniciar sesión como vendedor';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('sellerToken');
    localStorage.removeItem('isDemoMode');
    localStorage.removeItem('demoDoctorName');
    setToken(null);
    setSeller(null);
    setIsDemoMode(false);
    setDemoDoctorName('');
  };

  // Iniciar Modo Demo para un profesional
  const startDemoMode = async (doctorId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/seller/impersonate/${doctorId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { token: doctorDemoToken, doctor } = response.data;

        // Guardar token de sesión de doctor y flags de demo
        localStorage.setItem('token', doctorDemoToken);
        localStorage.setItem('isDemoMode', 'true');
        localStorage.setItem('demoDoctorName', doctor.name);

        setIsDemoMode(true);
        setDemoDoctorName(doctor.name);

        // Recargar aplicación a /dashboard para refrescar el AuthContext
        window.location.href = '/dashboard';
        return { success: true };
      }
    } catch (err) {
      console.error('Error al iniciar modo demo:', err);
      return {
        success: false,
        error: err.response?.data?.error || 'No se pudo iniciar el modo demo'
      };
    }
  };

  // Salir de Modo Demo y volver al panel de vendedor
  const exitDemoMode = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isDemoMode');
    localStorage.removeItem('demoDoctorName');

    setIsDemoMode(false);
    setDemoDoctorName('');

    window.location.href = '/seller/dashboard';
  };

  const value = {
    seller,
    token,
    loading,
    error,
    isAuthenticated: !!seller && !!token,
    isDemoMode,
    demoDoctorName,
    login,
    logout,
    startDemoMode,
    exitDemoMode,
    setError
  };

  return (
    <SellerAuthContext.Provider value={value}>
      {children}
    </SellerAuthContext.Provider>
  );
};

export const useSellerAuth = () => useContext(SellerAuthContext);
