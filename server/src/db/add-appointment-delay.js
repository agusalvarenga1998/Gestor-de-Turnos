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
    console.log('⏱️  Agregando campos de retraso a tabla appointments...\n');

    await client.query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delay_reason VARCHAR(255),
      ADD COLUMN IF NOT EXISTS delayed_at TIMESTAMP;
    `);

    console.log('✓ Campos de retraso agregados correctamente\n');
    console.log('✅ Migración completada exitosamente!');
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
