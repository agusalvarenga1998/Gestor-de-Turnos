import React, { createContext, useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { getWebSocketClient, closeWebSocketClient } from '../services/websocket.js';

export const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [wsState, setWsState] = useState('CLOSED');
  const wsClientRef = useRef(null);
  const listenerCountRef = useRef(0);

  // Inicializar WebSocket
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let isMounted = true;

    const initializeWebSocket = async () => {
      try {
        const wsClient = getWebSocketClient();
        if (!isMounted) return;

        wsClientRef.current = wsClient;

        // Manejadores de eventos
        const handleConnected = () => {
          if (isMounted) {
            console.log('✓ WebSocket conectado');
            setIsConnected(true);
            setWsState('OPEN');
            setError(null);
          }
        };

        const handleDisconnected = () => {
          if (isMounted) {
            console.log('⚠️ WebSocket desconectado');
            setIsConnected(false);
            setWsState('CLOSED');
          }
        };

        const handleError = (err) => {
          if (isMounted) {
            console.error('❌ Error WebSocket:', err);
            setError(err?.message || 'Error en conexión WebSocket');
          }
        };

        const handleAuthSuccess = () => {
          if (isMounted) {
            console.log('✅ Autenticación WebSocket exitosa');
          }
        };

        // Agregar listeners
        wsClient.on('connected', handleConnected);
        wsClient.on('disconnected', handleDisconnected);
        wsClient.on('error', handleError);
        wsClient.on('auth_success', handleAuthSuccess);

        // Conectar si no está conectado
        if (!wsClient.isConnected()) {
          await wsClient.connect(token);
        } else {
          if (isMounted) {
            setIsConnected(true);
            setWsState(wsClient.getState());
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Error inicializando WebSocket:', err);
          setError(err?.message || 'Error en WebSocket');
        }
      }
    };

    initializeWebSocket();

    return () => {
      isMounted = false;
      if (wsClientRef.current) {
        wsClientRef.current.off('connected');
        wsClientRef.current.off('disconnected');
        wsClientRef.current.off('error');
        wsClientRef.current.off('auth_success');
      }
    };
  }, [token, user]);

  // Limpiar al desmontar el provider
  useEffect(() => {
    return () => {
      if (wsClientRef.current && listenerCountRef.current === 0) {
        // Solo desconectar si no hay listeners activos
        closeWebSocketClient();
      }
    };
  }, []);

  // Suscribirse a cita
  const subscribeAppointment = useCallback((appointmentId, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.subscribeAppointment(appointmentId);

      if (callback) {
        wsClientRef.current.on('appointment_updated', callback);
        listenerCountRef.current++;
      }

      return () => {
        wsClientRef.current.unsubscribeAppointment(appointmentId);
        if (callback) {
          wsClientRef.current.off('appointment_updated', callback);
          listenerCountRef.current--;
        }
      };
    }
  }, []);

  // Desuscribirse de cita
  const unsubscribeAppointment = useCallback((appointmentId) => {
    if (wsClientRef.current) {
      wsClientRef.current.unsubscribeAppointment(appointmentId);
    }
  }, []);

  // Suscribirse a doctor
  const subscribeDoctor = useCallback((doctorId, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.subscribeDoctor(doctorId);

      if (callback) {
        wsClientRef.current.on('doctor_updated', callback);
        listenerCountRef.current++;
      }

      return () => {
        wsClientRef.current.unsubscribeDoctor(doctorId);
        if (callback) {
          wsClientRef.current.off('doctor_updated', callback);
          listenerCountRef.current--;
        }
      };
    }
  }, []);

  // Desuscribirse de doctor
  const unsubscribeDoctor = useCallback((doctorId) => {
    if (wsClientRef.current) {
      wsClientRef.current.unsubscribeDoctor(doctorId);
    }
  }, []);

  // Escuchar evento
  const on = useCallback((event, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.on(event, callback);
      listenerCountRef.current++;

      return () => {
        wsClientRef.current.off(event, callback);
        listenerCountRef.current--;
      };
    }
  }, []);

  // Dejar de escuchar evento
  const off = useCallback((event, callback) => {
    if (wsClientRef.current) {
      wsClientRef.current.off(event, callback);
      listenerCountRef.current--;
    }
  }, []);

  const value = {
    isConnected,
    error,
    wsState,
    subscribeAppointment,
    unsubscribeAppointment,
    subscribeDoctor,
    unsubscribeDoctor,
    on,
    off
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
