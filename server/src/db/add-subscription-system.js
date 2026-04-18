import { query } from '../db/config.js';

async function runMigration() {
  try {
    console.log('Starting subscription system migration...');

    // 1. Add columns to doctors table
    console.log('Adding columns to doctors table...');
    await query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
    `);

    // 2. Create admins table
    console.log('Creating admins table...');
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create subscriptions table
    console.log('Creating subscriptions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        mp_payment_id VARCHAR(255),
        mp_preference_id VARCHAR(255),
        amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, period_start, period_end)
      );
    `);

    // 4. Create indexes for better query performance
    console.log('Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);
      CREATE INDEX IF NOT EXISTS idx_doctors_subscription_status ON doctors(subscription_status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_doctor_id ON subscriptions(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `);

    console.log('✓ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
