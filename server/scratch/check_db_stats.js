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

async function checkData() {
  try {
    const doctors = await pool.query('SELECT id, name, email FROM doctors');
    console.log('Doctors:', doctors.rows);

    const appointments = await pool.query('SELECT id, doctor_id, patient_id, status, appointment_date FROM appointments LIMIT 5');
    console.log('Appointments (sample):', appointments.rows);

    const counts = await pool.query('SELECT doctor_id, status, COUNT(*) FROM appointments GROUP BY doctor_id, status');
    console.log('Counts per doctor and status:', counts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkData();
