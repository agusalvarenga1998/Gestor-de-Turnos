import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🛠️ Corrigiendo esquema de la tabla doctors...');
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address TEXT;

      UPDATE doctors SET status = 'active' WHERE status IS NULL;
      UPDATE doctors SET subscription_status = 'trial' WHERE subscription_status IS NULL;
    `);
    console.log('✅ Base de datos actualizada con éxito');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
