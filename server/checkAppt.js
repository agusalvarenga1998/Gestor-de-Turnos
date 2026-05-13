import dotenv from 'dotenv';
import { query } from './src/db/config.js';

dotenv.config();

async function check() {
  const res = await query("SELECT status, payment_status FROM appointments WHERE id = '834cd767-ebe1-44a8-bb6a-11d0d29b6e17'");
  console.log(res.rows);
  process.exit(0);
}

check();
