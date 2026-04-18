import { useEffect, useCallback, useRef, useState } from 'react';
import { getWebSocketClient } from '../services/websocket.js';
import { useAuth } from './useAuth.js';

export const useWebSocket = () => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsClientRef = useRef(null);

  // Inicializar conexión WebSocket
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const initializeWebSocket = async () => {
      try {
        const wsClient = getWebSocketClient();

        // Escuchar eventos de conexión
        wsClient.on('connected', () => {
          console.log('✓ WebSocket conectado desde hook');
          setIsConnected(true);
          setError(null);
        });

        wsClient.on('disconnected', () => {
          console.log('⚠️ WebSocket desconectado');
          setIsConnected(false);
        });

        wsClient.on('auth_success', () => {
          console.log('✅ Autenticación WebSocket exitosa');
        });

        wsClient.on('auth_error', (message) => {
          console.error('❌ Error autenticación WebSocket:', message);
          setError(message.message);
        });

        wsClient.on('error', (err) => {
          console.error('❌ Error WebSocket:', err);
          setError(err.message || 'Error en WebSocket');
        });

        wsClientRef.current = wsClient;

        // Conectar si no está conectado
        if (!wsClient.isConnected()) {
          await wsClient.connect(token);
        }
      } catch (err) {
        console.error('❌ Error inicializando WebSocket:', err);
        setError(err.message || 'Error conectando WebSocket');
      }
    };

    initializeWebSocket();

    // Limpiar al desmontar
    return () => {
      // Mantener la conexión abierta para otros componentes
      // No desconectar aquí
    };
  }, [token, user]);

  // Suscribirse a una cita
  const subscribeAppointment = useCallback((appointmentId) => {
    if (wsClientRef.current && wsClientRef.current.isConnected()) {
      return wsClientRef.current.subscribeAppointment(appointmentId);
    }
    return false;
  }, []);

  // Desuscribirse de una cita
  const unsubscribeAppointment = useCallback((appointmentId) => {
    if (wsClientRef.current && wsClientRef.current.isConnected()) {
      return wsClientRef.current.unsubscribeAppointment(appointmentId);
    }
    return false;
  }, []);

  // Suscribirse a doctor
  const subscribeDoctor = useCallback((doctorId) => {
    if (wsClientRef.current && wsClientRef.current.isConnected()) {
      return wsClientRef.current.subscribeDoctor(doctorId);
    }
    return false;
  }, []);

  // Desuscribirse de doctor
  const unsubscribeDoctor = useCallback((doctorId) => {
    if (wsClientRef.current && wsClientRef.current.isConnected()) {
      return wsClientRef.current.unsubscribeDoctor(doctorId);
    }
    return false;
  }, []);

  // Escuchar evento
  const on = useCallback((event, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.on(event, callback);
    }
  }, []);

  // Dejar de escuchar evento
  const off = useCallback((event, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.off(event, callback);
    }
  }, []);

  return {
    isConnected,
    error,
    subscribeAppointment,
    unsubscribeAppointment,
    subscribeDoctor,
    unsubscribeDoctor,
    on,
    off
  };
};
