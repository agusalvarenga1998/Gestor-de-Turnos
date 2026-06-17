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
import mercadopagoRoutes from './routes/mercadopago.js';
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
  'https://turnohub.com.ar',
  'https://www.turnohub.com.ar',
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
    if (
      allowedOrigins.indexOf(origin) !== -1 || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin.includes('turnohub.com.ar')
    ) {
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

// Ruta raíz para evitar errores 404 cuando Google o navegadores acceden al subdominio de la API
app.get('/', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.json({
    message: 'TurnoHub API Server is running',
    status: 'active'
  });
});

// Ruta robots.txt para indicar a todos los buscadores que no rastreen la API
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /');
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
app.use('/api/mercadopago', mercadopagoRoutes);

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
httpServer.listen(PORT, HOST, async () => {
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
    
    // Crear tabla de planes comerciales si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS pricing_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price VARCHAR(50) NOT NULL,
        price_period VARCHAR(50),
        features TEXT[] DEFAULT '{}',
        is_popular BOOLEAN DEFAULT false,
        is_enabled BOOLEAN DEFAULT true,
        allow_google_calendar BOOLEAN DEFAULT TRUE,
        allow_mercadopago BOOLEAN DEFAULT TRUE,
        allow_telemedicine BOOLEAN DEFAULT TRUE,
        allow_reminders BOOLEAN DEFAULT TRUE,
        allow_insurance BOOLEAN DEFAULT TRUE,
        max_patients INTEGER DEFAULT NULL,
        max_appointments_monthly INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Poblar planes por defecto si no existen
    await query(`
      INSERT INTO pricing_plans (key, name, description, price, price_period, features, is_popular, is_enabled, allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance)
      VALUES 
      ('commission', 'Plan Comisión', 'Ideal para quienes recién comienzan', '3%', 'por turno efectivo', ARRAY['Todas las funcionalidades', 'Pacientes ilimitados', 'Soporte estándar', 'Pagas solo si trabajas'], false, true, true, true, true, true, true),
      ('monthly', 'Plan Mensual', 'Para profesionales establecidos', 'Consultar', 'mes fijo', ARRAY['Funcionalidades avanzadas', 'Soporte prioritario 24/7', 'Integraciones personalizadas', 'Sin cobros por comisión'], true, true, true, true, true, true, true)
      ON CONFLICT (key) DO NOTHING
    `);

    // Asegurar que doctors tenga la relación pricing_plan_id
    await query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES pricing_plans(id) ON DELETE SET NULL
    `);

    // Crear tabla de planes de obras sociales si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS insurance_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        coverage_type VARCHAR(20) NOT NULL DEFAULT 'fixed_amount',
        coverage_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(insurance_company_id, name)
      )
    `);

    // Añadir columna de plan de obra social a citas
    await query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS insurance_plan_id UUID REFERENCES insurance_plans(id)
    `);

    // Añadir columna mp_refresh_token a doctors si no existe
    await query(`
      ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT
    `);

    // Añadir columnas de domicilio, tipo de documento y obra social a pacientes
    await query(`
      ALTER TABLE patients 
        ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'DNI',
        ADD COLUMN IF NOT EXISTS locality VARCHAR(255),
        ADD COLUMN IF NOT EXISTS province VARCHAR(255),
        ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS insurance_plan_id UUID REFERENCES insurance_plans(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100)
    `);

    console.log('✓ Migraciones de is_online, meet_link, pricing_plans, insurance_plans, mp_refresh_token y patients aplicadas');
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
