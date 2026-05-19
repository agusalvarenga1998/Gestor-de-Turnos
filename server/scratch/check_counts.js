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
    const doctors = await pool.query('SELECT id, name FROM doctors');
    for (const doc of doctors.rows) {
      const patientCount = await pool.query('SELECT COUNT(*) FROM patients WHERE doctor_id = $1', [doc.id]);
      const apptCount = await pool.query('SELECT status, COUNT(*) FROM appointments WHERE doctor_id = $1 GROUP BY status', [doc.id]);
      console.log(`Doctor: ${doc.name} (${doc.id})`);
      console.log(`  Patients: ${patientCount.rows[0].count}`);
      console.log(`  Appointments:`, apptCount.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkData();
