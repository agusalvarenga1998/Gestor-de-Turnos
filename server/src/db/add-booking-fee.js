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
    console.log('🔄 Iniciando migración para pagos y reservas...');

    // 1. Añadir costo de reserva a la tabla de doctores
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS booking_fee DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('✓ Columna booking_fee añadida a doctors');

    // 2. Añadir campos de pago a la tabla de turnos
    await client.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS system_fee DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS mp_preference_id VARCHAR(255);
    `);
    console.log('✓ Columnas de pago añadidas a appointments');

    console.log('✅ Migración completada con éxito');
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
