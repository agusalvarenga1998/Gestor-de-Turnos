import { verifyAndDecodeToken } from '../middleware/auth.js';

// Almacenar clientes conectados y sus suscripciones
const connectedClients = new Map(); // id -> { ws, user, subscriptions }
const appointmentSubscriptions = new Map(); // appointmentId -> Set de clientIds
const doctorClients = new Map(); // doctorId -> Set de clientIds

let wssInstance = null;

export const setupWebSocket = (wss) => {
  wssInstance = wss;
  console.log('🔌 Configurando WebSocket...');

  wss.on('connection', (ws) => {
    let clientId = null;
    let userId = null;
    let userRole = null;
    const subscriptions = new Set();

    console.log(`✓ Nueva conexión WebSocket. Clientes conectados: ${wss.clients.size}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'auth':
            handleAuth(ws, message, connectedClients, doctorClients, (id, role, uid) => {
              clientId = id;
              userRole = role;
              userId = uid;
            });
            break;

          case 'subscribe_appointment':
            handleSubscribeAppointment(clientId, message, appointmentSubscriptions, subscriptions, ws);
            break;

          case 'unsubscribe_appointment':
            handleUnsubscribeAppointment(clientId, message, appointmentSubscriptions, subscriptions);
            break;

          case 'subscribe_doctor':
            handleSubscribeDoctor(clientId, message, doctorClients, subscriptions, ws);
            break;

          case 'unsubscribe_doctor':
            handleUnsubscribeDoctor(clientId, message, doctorClients, subscriptions);
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Tipo de mensaje no reconocido'
            }));
        }
      } catch (error) {
        console.error('❌ Error procesando WebSocket mensaje:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error procesando mensaje'
        }));
      }
    });

    ws.on('close', () => {
      console.log(`✓ Cliente desconectado: ${clientId}`);

      // Limpiar suscripciones
      if (clientId) {
        connectedClients.delete(clientId);

        for (const appointmentId of subscriptions) {
          if (appointmentSubscriptions.has(appointmentId)) {
            appointmentSubscriptions.get(appointmentId).delete(clientId);
          }
        }

        for (const [doctorId, clients] of doctorClients.entries()) {
          if (clients.has(clientId)) {
            clients.delete(clientId);
            if (clients.size === 0) {
              doctorClients.delete(doctorId);
            }
          }
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('pong', () => {
      // Respuesta a ping del servidor
    });
  });

  // Heartbeat para mantener conexiones vivas
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log('✅ WebSocket servidor configurado correctamente');
};

// Manejadores de eventos
const handleAuth = (ws, message, connectedClients, doctorClients, setClientInfo) => {
  const { token } = message;

  if (!token) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Token requerido'
    }));
    return;
  }

  const decoded = verifyAndDecodeToken(token);

  if (!decoded) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Token inválido o expirado'
    }));
    return;
  }

  const clientId = `${decoded.id}-${Date.now()}`;

  const client = {
    id: clientId,
    userId: decoded.id,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
    ws: ws,
    subscriptions: new Set(),
    connectedAt: new Date()
  };

  connectedClients.set(clientId, client);
  setClientInfo(clientId, decoded.role, decoded.id);

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.send(JSON.stringify({
    type: 'auth_success',
    clientId: clientId,
    userId: decoded.id,
    role: decoded.role,
    message: `Autenticado como ${decoded.name}`
  }));

  console.log(`✓ Cliente autenticado: ${decoded.email} (${decoded.role})`);
  console.log(`  Clientes totales conectados: ${connectedClients.size}`);
};

const handleSubscribeAppointment = (clientId, message, appointmentSubscriptions, subscriptions, ws) => {
  const { appointmentId } = message;

  if (!clientId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Debes autenticarte primero'
    }));
    return;
  }

  if (!appointmentId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'appointmentId requerido'
    }));
    return;
  }

  if (!appointmentSubscriptions.has(appointmentId)) {
    appointmentSubscriptions.set(appointmentId, new Set());
  }

  appointmentSubscriptions.get(appointmentId).add(clientId);
  subscriptions.add(appointmentId);

  ws.send(JSON.stringify({
    type: 'subscribed',
    appointmentId: appointmentId,
    message: `Suscrito a actualizaciones de cita ${appointmentId}`
  }));

  console.log(`✓ Cliente ${clientId} suscrito a cita ${appointmentId}`);
};

const handleUnsubscribeAppointment = (clientId, message, appointmentSubscriptions, subscriptions) => {
  const { appointmentId } = message;

  if (appointmentSubscriptions.has(appointmentId)) {
    appointmentSubscriptions.get(appointmentId).delete(clientId);
    subscriptions.delete(appointmentId);

    if (appointmentSubscriptions.get(appointmentId).size === 0) {
      appointmentSubscriptions.delete(appointmentId);
    }
  }

  console.log(`✓ Cliente ${clientId} desuscrito de cita ${appointmentId}`);
};

const handleSubscribeDoctor = (clientId, message, doctorClients, subscriptions, ws) => {
  const { doctorId } = message;

  if (!clientId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Debes autenticarte primero'
    }));
    return;
  }

  if (!doctorId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'doctorId requerido'
    }));
    return;
  }

  if (!doctorClients.has(doctorId)) {
    doctorClients.set(doctorId, new Set());
  }

  doctorClients.get(doctorId).add(clientId);
  subscriptions.add(`doctor:${doctorId}`);

  ws.send(JSON.stringify({
    type: 'subscribed',
    doctorId: doctorId,
    message: `Suscrito a actualizaciones del doctor ${doctorId}`
  }));

  console.log(`✓ Cliente ${clientId} suscrito al doctor ${doctorId}`);
};

const handleUnsubscribeDoctor = (clientId, message, doctorClients, subscriptions) => {
  const { doctorId } = message;

  if (doctorClients.has(doctorId)) {
    doctorClients.get(doctorId).delete(clientId);
    subscriptions.delete(`doctor:${doctorId}`);

    if (doctorClients.get(doctorId).size === 0) {
      doctorClients.delete(doctorId);
    }
  }

  console.log(`✓ Cliente ${clientId} desuscrito del doctor ${doctorId}`);
};

// Funciones para emitir eventos desde el servidor
export const notifyAppointmentUpdate = (wss, appointmentId, update) => {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'appointment_updated',
    appointmentId: appointmentId,
    update: update,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(message);
    }
  });

  console.log(`📤 Actualización de cita ${appointmentId} enviada a clientes`);
};

export const notifyDoctorUpdate = (wss, doctorId, update) => {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'doctor_updated',
    doctorId: doctorId,
    update: update,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });

  console.log(`📤 Actualización del doctor ${doctorId} enviada a clientes`);
};

export const broadcastToAll = (wss, message) => {
  if (!wss) return;

  const data = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
};

export const getConnectedClientsCount = () => {
  return connectedClients.size;
};

export const getConnectionStats = () => {
  return {
    totalClients: connectedClients.size,
    appointmentSubscriptions: appointmentSubscriptions.size,
    doctorSubscriptions: doctorClients.size,
    clients: Array.from(connectedClients.values()).map(c => ({
      clientId: c.id,
      user: c.name,
      role: c.role,
      subscriptions: c.subscriptions.size,
      connectedFor: new Date() - c.connectedAt
    }))
  };
};

export const notifyDoctor = (doctorId, data) => {
  if (!wssInstance) return;
  
  const message = JSON.stringify({
    type: 'new_appointment',
    doctorId,
    ...data,
    timestamp: new Date().toISOString()
  });

  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
  
  console.log(`📤 Notificación de nueva cita enviada al doctor ${doctorId}`);
};
