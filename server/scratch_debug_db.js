import * as db from './src/db/config.js';

async function run() {
  try {
    const doctors = await db.query('SELECT id, name, email FROM doctors');
    console.log('--- DOCTORS ---');
    console.log(doctors.rows);

    const appointments = await db.query('SELECT id, doctor_id, patient_id, appointment_date, appointment_time, status FROM appointments LIMIT 10');
    console.log('--- APPOINTMENTS ---');
    console.log(appointments.rows);

    const patients = await db.query('SELECT id, doctor_id, name FROM patients LIMIT 10');
    console.log('--- PATIENTS ---');
    console.log(patients.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
