class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isManualClose = false;
    this.heartbeatInterval = null;
  }

  // Conectar al servidor WebSocket
  connect(token) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✓ WebSocket conectado');
          this.reconnectAttempts = 0;

          // Enviar autenticación
          this.send({
            type: 'auth',
            token: token
          });

          // Heartbeat cada 30 segundos
          this.startHeartbeat();

          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error procesando mensaje WebSocket:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('⚠️ WebSocket desconectado');
          this.stopHeartbeat();

          if (!this.isManualClose) {
            this.reconnect(token);
          }

          this.emit('disconnected');
        };
      } catch (error) {
        console.error('❌ Error conectando WebSocket:', error);
        reject(error);
      }
    });
  }

  // Reconectar automáticamente
  reconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ No se pudo reconectar después de varios intentos');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Intentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect(token).catch(error => {
        console.error('❌ Error en reconexión:', error);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Iniciar heartbeat
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  // Detener heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Enviar mensaje
  send(message) {
    if (this.isConnected()) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket no está conectado');
      return false;
    }
  }

  // Suscribirse a cita
  subscribeAppointment(appointmentId) {
    return this.send({
      type: 'subscribe_appointment',
      appointmentId: appointmentId
    });
  }

  // Desuscribirse de cita
  unsubscribeAppointment(appointmentId) {
    return this.send({
      type: 'unsubscribe_appointment',
      appointmentId: appointmentId
    });
  }

  // Suscribirse a doctor
  subscribeDoctor(doctorId) {
    return this.send({
      type: 'subscribe_doctor',
      doctorId: doctorId
    });
  }

  // Desuscribirse de doctor
  unsubscribeDoctor(doctorId) {
    return this.send({
      type: 'unsubscribe_doctor',
      doctorId: doctorId
    });
  }

  // Manejar mensajes recibidos
  handleMessage(message) {
    const { type } = message;

    switch (type) {
      case 'auth_success':
        console.log('✅ Autenticación exitosa');
        this.emit('auth_success', message);
        break;

      case 'auth_error':
        console.error('❌ Error de autenticación:', message.message);
        this.emit('auth_error', message);
        this.disconnect();
        break;

      case 'subscribed':
        console.log('✓ Suscripción exitosa:', message);
        this.emit('subscribed', message);
        break;

      case 'appointment_updated':
        console.log('📤 Cita actualizada:', message.appointmentId);
        this.emit('appointment_updated', message);
        break;

      case 'doctor_updated':
        console.log('📤 Doctor actualizado:', message.doctorId);
        this.emit('doctor_updated', message);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        console.error('❌ Error del servidor:', message.message);
        this.emit('error', message);
        break;

      default:
        console.log('? Mensaje desconocido:', type);
        this.emit('message', message);
    }
  }

  // Escuchar eventos
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Dejar de escuchar eventos
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emitir evento
  emit(event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en listener para ${event}:`, error);
        }
      });
    }
  }

  // Verificar si está conectado
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Desconectar
  disconnect() {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('✓ WebSocket desconectado manualmente');
  }

  // Obtener estado
  getState() {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case 0:
        return 'CONNECTING';
      case 1:
        return 'OPEN';
      case 2:
        return 'CLOSING';
      case 3:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Instancia singleton
let wsClient = null;

export const getWebSocketClient = (url) => {
  if (!wsClient) {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    let defaultUrl;

    if (apiBaseUrl) {
      // Si tenemos URL de API, convertir https a wss o http a ws
      defaultUrl = apiBaseUrl.replace(/^http/, 'ws');
    } else if (typeof window !== 'undefined') {
      // Fallback a la URL actual si no hay env (local)
      defaultUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    } else {
      defaultUrl = 'ws://localhost:5002';
    }
    
    wsClient = new WebSocketClient(url || defaultUrl);
  }
  return wsClient;
};

export const closeWebSocketClient = () => {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
};

export default WebSocketClient;
