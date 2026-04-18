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

async function approveAll() {
  const client = await pool.connect();
  try {
    const res = await client.query("UPDATE doctors SET status = 'approved' WHERE status = 'pending'");
    console.log(`✅ ¡Proceso completado! Se han aprobado ${res.rowCount} médicos.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

approveAll();
