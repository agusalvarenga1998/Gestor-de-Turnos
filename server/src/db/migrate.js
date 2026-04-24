import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Usamos el DATABASE_URL de Render si existe, sino usamos las variables individuales
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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
