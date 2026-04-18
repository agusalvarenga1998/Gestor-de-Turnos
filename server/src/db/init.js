import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const poolConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio_medico',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool(poolConfig);

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('📊 Inicializando base de datos...\n');

    // Tabla de doctores
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        status VARCHAR(50) DEFAULT 'active',
        subscription_status VARCHAR(50) DEFAULT 'trial',
        subscription_expires_at TIMESTAMP,
        trial_ends_at TIMESTAMP,
        approved_at TIMESTAMP,
        license_number VARCHAR(50),
        address TEXT,
        name VARCHAR(255) NOT NULL,
        specialization VARCHAR(255),
        phone VARCHAR(20),
        clinic_name VARCHAR(255),
        clinic_address TEXT,
        profile_image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        google_refresh_token TEXT,
        google_calendar_id TEXT,
        google_calendar_connected BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla doctors creada');

    // Agregar columnas a doctors si no existen (para migraciones)
    await client.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS booking_fee DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS appointment_price DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
    `);
    console.log('✓ Columnas financieras y Google Calendar agregadas a doctors');

    // Tabla de pacientes
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        email VARCHAR(255),
        phone VARCHAR(20),
        name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(10),
        address TEXT,
        medical_history TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla patients creada');

    // Tabla de turnos/citas
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        end_time TIME,
        status VARCHAR(50) DEFAULT 'pending',
        reason_for_visit TEXT,
        notes TEXT,
        delay_minutes INTEGER DEFAULT 0,
        queue_position INTEGER,
        google_event_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, appointment_date, appointment_time)
      );
    `);
    console.log('✓ Tabla appointments creada');

    // Agregar columnas necesarias si no existen
    await client.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS google_event_id TEXT,
      ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS confirmation_token UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS delay_reason TEXT,
      ADD COLUMN IF NOT EXISTS appointment_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS delayed_at TIMESTAMP;
    `);
    console.log('✓ Columnas adicionales agregadas a appointments');

    // Tabla de disponibilidad del doctor
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctor_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, day_of_week, start_time)
      );
    `);
    console.log('✓ Tabla doctor_availability creada');

    // Tabla de vacaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctor_vacation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla doctor_vacation creada');

    // Tabla de notificaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_phone VARCHAR(20) NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_sent BOOLEAN DEFAULT false
      );
    `);
    console.log('✓ Tabla notifications creada');

    // Tabla de obras sociales (asociadas a cada doctor)
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        additional_fee DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, name)
      );
    `);
    console.log('✓ Tabla insurance_companies creada');

    // Tabla intermedia para pacientes y sus obras sociales
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_insurances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE CASCADE,
        policy_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patient_id, insurance_company_id)
      );
    `);
    console.log('✓ Tabla patient_insurances creada');

    // Crear índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notifications(appointment_id);
    `);
    console.log('✓ Índices creados');

    // Tabla de administradores
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla admins creada');

    // Tabla de suscripciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla subscriptions creada');

    console.log('\n✅ Base de datos inicializada correctamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

initDatabase();
