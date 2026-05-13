import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';

// Imports de rutas
import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import patientRoutes from './routes/patients.js';
import doctorRoutes from './routes/doctor.js';
import availabilityRoutes from './routes/availability.js';
import googleCalendarRoutes from './routes/googleCalendar.js';
import insuranceRoutes from './routes/insurance.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import serviceRoutes from './routes/services.js';
import patientRecordRoutes from './routes/patientRecords.js';
import path from 'path';
import { uploadsDir } from './utils/paths.js';
import { query } from './db/config.js';

// Imports de middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Imports de WebSocket
import { setupWebSocket } from './websocket/server.js';

// Imports de Cron
import { initReminderCron } from './cron/reminderCron.js';

const app = express();
const httpServer = createServer(app);

// Seguridad y CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "https:", "wss:", "ws:", "http://localhost:5002", "ws://localhost:5002"],
      "img-src": ["'self'", "data:", "blob:", "https:", "http://localhost:5000"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como mobile apps o curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// Middleware de parseo
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logger
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/google', googleCalendarRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/patient-records', patientRecordRoutes);

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(uploadsDir));

// Configurar WebSocket
const wss = new WebSocketServer({ server: httpServer });
setupWebSocket(wss);

// Manejador de errores (debe ser último)
app.use(errorHandler);

// Rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Variables globales
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Iniciar servidor
httpServer.listen(PORT, HOST, () => {
  // Asegurar que existe la carpeta de subidas
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Carpeta de subidas creada en:', uploadsDir);
  } else {
    console.log('📁 Carpeta de subidas detectada en:', uploadsDir);
  }

  console.log(`\n🚀 Servidor iniciado en http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🔌 WebSocket disponible en ws://${HOST}:${process.env.WS_PORT || 5001}\n`);
  
  // Iniciar tareas programadas
  initReminderCron();

  // Auto-migración: agregar columnas nuevas si no existen
  try {
    await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link TEXT`);
    console.log('✓ Migraciones de is_online y meet_link aplicadas');
  } catch (err) {
    console.error('⚠️ Error en auto-migración:', err.message);
  }
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

export default app;
