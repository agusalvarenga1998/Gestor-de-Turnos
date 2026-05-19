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

async function checkLatest() {
  try {
    const latestAppt = await pool.query('SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1');
    console.log('Latest Appointment:', latestAppt.rows[0]);

    if (latestAppt.rows[0]) {
      const doctor = await pool.query('SELECT name FROM doctors WHERE id = $1', [latestAppt.rows[0].doctor_id]);
      console.log('For Doctor:', doctor.rows[0]);
    }

    const latestDoctor = await pool.query('SELECT * FROM doctors ORDER BY created_at DESC LIMIT 1');
    console.log('Latest Doctor Registered:', latestDoctor.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkLatest();
