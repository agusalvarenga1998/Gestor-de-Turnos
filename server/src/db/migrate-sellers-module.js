import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function migrateSellersModule() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Alter doctors table
    console.log('Adding seller fields to doctors table...');
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS registered_by_seller_id UUID REFERENCES sellers(id),
      ADD COLUMN IF NOT EXISTS commercial_status VARCHAR(50) DEFAULT 'lead',
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMP;
    `);

    // 2. Create seller_invitations table
    console.log('Creating seller_invitations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seller_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES sellers(id) NOT NULL,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email, status)
      );
    `);

    // 3. Create seller_commissions table
    console.log('Creating seller_commissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seller_commissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES sellers(id) NOT NULL,
        doctor_id UUID REFERENCES doctors(id) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
      );
    `);

    // 4. Create seller_notes table
    console.log('Creating seller_notes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS seller_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES sellers(id) NOT NULL,
        doctor_id UUID REFERENCES doctors(id) NOT NULL,
        note TEXT NOT NULL,
        created_by UUID REFERENCES sellers(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Check if seller_notes column in doctors exists and migrate data if needed?
    // We can just keep both for now or migrate. Let's just create the table.

    // 5. Update sellers table configuration if needed
    console.log('Adding commission config to sellers table...');
    await client.query(`
      ALTER TABLE sellers
      ADD COLUMN IF NOT EXISTS commission_type VARCHAR(50) DEFAULT 'fixed',
      ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrateSellersModule();
