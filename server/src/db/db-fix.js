import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
});

async function fixDb() {
  try {
    console.log('🚀 Iniciando actualización de base de datos LOCAL...');
    
    // Columnas para doctors
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS booking_fee DECIMAL(10, 2) DEFAULT 0;');
    console.log('✅ Tabla doctors actualizada');

    // Columnas para appointments
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS system_fee DECIMAL(10, 2) DEFAULT 0;');
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT \'pending\';');
    console.log('✅ Tabla appointments actualizada');

    console.log('✨ Base de datos LOCAL lista.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error actualizando base de datos:', err);
    process.exit(1);
  }
}

fixDb();
