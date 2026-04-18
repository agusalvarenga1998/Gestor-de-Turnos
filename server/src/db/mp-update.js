import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
});

async function updateDb() {
  try {
    console.log('🚀 Agregando columnas de Mercado Pago a doctors...');
    
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mp_access_token TEXT;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT;');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mp_user_id VARCHAR(100);');
    await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS mp_connected BOOLEAN DEFAULT FALSE;');
    
    console.log('✅ Columnas agregadas correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error actualizando base de datos:', err);
    process.exit(1);
  }
}

updateDb();
