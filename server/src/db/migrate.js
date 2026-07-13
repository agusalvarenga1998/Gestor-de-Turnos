import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Usamos el DATABASE_URL de Render si existe, sino usamos las variables individuales
const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio_medico',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool(poolConfig);

async function migrate() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔄 Ejecutando migraciones maestras para Google Calendar...\n');

    // 1. Tabla Doctors: Asegurar todas las columnas de Google
    console.log('➕ Verificando columnas en tabla doctors...');
    await client.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS google_access_token TEXT,
      ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
    `);
    console.log('✓ Tabla doctors actualizada.\n');

    // 2. Tabla Appointments: Asegurar google_event_id
    console.log('➕ Verificando columnas en tabla appointments...');
    await client.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS google_event_id TEXT;
    `);
    console.log('✓ Tabla appointments actualizada.\n');

    // 3. Hacer password_hash nullable (por si no lo estaba)
    console.log('🔧 Ajustando restricciones...');
    await client.query(`
      ALTER TABLE doctors ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log('✓ password_hash ahora es opcional.\n');

    // 4. Tabla Doctors: Columnas de planes y deudas
    console.log('➕ Verificando columnas de planes en tabla doctors...');
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 3.00,
      ADD COLUMN IF NOT EXISTS accumulated_debt DECIMAL(10, 2) DEFAULT 0;
    `);

    // 5. Tabla Appointments: Columna de cobro de comisión
    console.log('➕ Verificando columna fee_charged en tabla appointments...');
    await client.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS fee_charged BOOLEAN DEFAULT false;
    `);

    // 6. Tabla Coberturas por Servicio
    console.log('➕ Verificando tabla insurance_service_coverage...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_service_coverage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        coverage_type VARCHAR(20) NOT NULL DEFAULT 'fixed_amount',
        coverage_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(insurance_company_id, service_id)
      );
    `);

    // 7. Tabla Services: Columna code
    console.log('➕ Verificando columna code en tabla services...');
    await client.query(`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS code VARCHAR(50);
    `);

    // 8. Control de planes y restricciones por profesional
    console.log('➕ Verificando campos de control de planes...');
    // A. Agregar columnas a pricing_plans
    await client.query(`
      ALTER TABLE pricing_plans
      ADD COLUMN IF NOT EXISTS allow_google_calendar BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS allow_mercadopago BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS allow_telemedicine BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS allow_reminders BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS allow_insurance BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS allow_patient_booking BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS max_appointments_monthly INTEGER DEFAULT NULL;
    `);

    // B. Agregar pricing_plan_id a doctors
    await client.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES pricing_plans(id) ON DELETE SET NULL;
    `);

    // C. Migrar asociaciones existentes de planes a los doctores actuales
    const planCommissionResult = await client.query("SELECT id FROM pricing_plans WHERE key = 'commission' LIMIT 1");
    const planMonthlyResult = await client.query("SELECT id FROM pricing_plans WHERE key = 'monthly' LIMIT 1");

    const commissionPlanId = planCommissionResult.rows[0]?.id;
    const monthlyPlanId = planMonthlyResult.rows[0]?.id;

    if (commissionPlanId) {
      await client.query(`
        UPDATE doctors 
        SET pricing_plan_id = $1 
        WHERE pricing_plan_id IS NULL AND plan_type = 'commission';
      `, [commissionPlanId]);
    }

    if (monthlyPlanId) {
      await client.query(`
        UPDATE doctors 
        SET pricing_plan_id = $1 
        WHERE pricing_plan_id IS NULL AND (plan_type = 'monthly' OR plan_type IS NULL);
      `, [monthlyPlanId]);
    }
    console.log('✓ Campos de control de planes verificados y migración de datos completada.\n');

    // 9. Unicidad de email insensible a mayúsculas
    console.log('➕ Asegurando unicidad de email insensible a mayúsculas en doctors...');
    await client.query(`
      ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_email_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_email_lower ON doctors (LOWER(email));
    `);
    console.log('✓ Índice único insensible a mayúsculas configurado.\n');

    // 10. Rubro/Categoría de Doctor
    console.log('➕ Asegurando columna rubro en doctors...');
    await client.query(`
      ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rubro VARCHAR(255);
    `);
    console.log('✓ Columna rubro configurada.\n');

    // 11. Cambiar longitud de columna appointment_code en appointments
    console.log('➕ Modificando longitud de columna appointment_code en appointments...');
    await client.query(`
      ALTER TABLE appointments ALTER COLUMN appointment_code TYPE VARCHAR(50);
    `);
    console.log('✓ Longitud de columna appointment_code modificada.\n');

    // 12. Tabla de Servicios Base (Plantillas)
    console.log('➕ Asegurando tabla admin_template_services...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_template_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        specialization VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        duration_minutes INTEGER NOT NULL,
        booking_fee DECIMAL(10,2) DEFAULT 0,
        code VARCHAR(100),
        is_online BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla admin_template_services configurada.\n');

    // 13. Tabla de Convenios Base (Obras Sociales Plantilla)
    console.log('➕ Asegurando tabla admin_template_insurances...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_template_insurances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        acronym VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla admin_template_insurances configurada.\n');

    // 14. Tabla de Planes de Convenios Base
    console.log('➕ Asegurando tabla admin_template_insurance_plans...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_template_insurance_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        insurance_template_id UUID NOT NULL REFERENCES admin_template_insurances(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        coverage_type VARCHAR(20) DEFAULT 'percentage',
        coverage_value DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(insurance_template_id, name)
      );
    `);
    // 15. Tabla de Suscripciones Push para Médicos
    console.log('➕ Asegurando tabla doctor_push_subscriptions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctor_push_subscriptions (
        id SERIAL PRIMARY KEY,
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla doctor_push_subscriptions configurada.\n');

    // 16. Columna doctor_push_sent en appointments
    console.log('➕ Asegurando columna doctor_push_sent en appointments...');
    await client.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_push_sent BOOLEAN DEFAULT false;
    `);
    console.log('✓ Columna doctor_push_sent configurada.\n');

    console.log('✅ Base de datos sincronizada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error crítico en migración:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
