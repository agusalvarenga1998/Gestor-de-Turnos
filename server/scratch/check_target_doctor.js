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

const TARGET_ID = '76ac3cb0-e303-4fa3-96bb-e7d0a72e0b42';

async function checkData() {
  try {
    const doctor = await pool.query('SELECT * FROM doctors WHERE id = $1', [TARGET_ID]);
    console.log('Doctor:', doctor.rows);

    const patients = await pool.query('SELECT COUNT(*) FROM patients WHERE doctor_id = $1', [TARGET_ID]);
    console.log('Patient Count:', patients.rows[0].count);

    const appointments = await pool.query('SELECT * FROM appointments WHERE doctor_id = $1', [TARGET_ID]);
    console.log('Appointments:', appointments.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkData();
