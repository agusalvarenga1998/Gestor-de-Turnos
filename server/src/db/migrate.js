import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Ejecutando migraciones...\n');

    // Agregar columnas a doctors
    console.log('➕ Agregando columnas a tabla doctors...');
    await client.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
    `);
    console.log('✓ Columnas de Google Calendar agregadas a doctors\n');

    // Agregar columna a appointments
    console.log('➕ Agregando columna google_event_id a tabla appointments...');
    await client.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS google_event_id TEXT;
    `);
    console.log('✓ Columna google_event_id agregada a appointments\n');

    console.log('✅ Todas las migraciones completadas exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
