import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from './server/src/db/config.js';

async function check() {
  try {
    const result = await query("SELECT id, status, payment_status, total_amount, appointment_date FROM appointments ORDER BY created_at DESC LIMIT 5");
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
