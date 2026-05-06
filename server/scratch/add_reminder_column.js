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
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function addReminderColumn() {
  try {
    await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;');
    console.log('✓ Column reminder_sent added to appointments table');
  } catch (error) {
    console.error('Error adding column:', error.message);
  } finally {
    await pool.end();
  }
}

addReminderColumn();
