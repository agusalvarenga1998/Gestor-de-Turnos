import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function report() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT name, address, latitude, longitude, status FROM doctors");
    console.log('--- REPORTE DE MÉDICOS Y UBICACIONES ---');
    console.table(rows);
  } finally {
    client.release();
    await pool.end();
  }
}
report();
