import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT,
});

async function checkRecent() {
  try {
    const recent = await pool.query('SELECT id, doctor_id, patient_id, status, created_at FROM appointments WHERE created_at > NOW() - INTERVAL \'1 hour\'');
    console.log('Recent Appointments (last hour):', recent.rows);

    const allAppts = await pool.query('SELECT COUNT(*) FROM appointments');
    console.log('Total Appointments in DB:', allAppts.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRecent();
