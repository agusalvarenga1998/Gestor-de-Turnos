import { query } from '../db/config.js';

async function addMissingSubscriptions() {
  try {
    console.log('Adding missing subscription records...\n');

    // Get all approved doctors
    const doctors = await query(
      `SELECT id, name, email, subscription_expires_at, trial_ends_at
       FROM doctors
       WHERE status = 'approved'`
    );

    console.log(`Found ${doctors.rows.length} approved doctors\n`);

    // For each doctor, check if they have a subscription record
    for (const doctor of doctors.rows) {
      const existing = await query(
        `SELECT id FROM subscriptions WHERE doctor_id = $1`,
        [doctor.id]
      );

      if (existing.rows.length === 0) {
        // Create subscription record
        const periodEnd = doctor.subscription_expires_at || doctor.trial_ends_at;
        await query(
          `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
           VALUES ($1, 0, 'approved', CURRENT_TIMESTAMP, $2)`,
          [doctor.id, periodEnd]
        );
        console.log(`✓ Added subscription for ${doctor.name} (${doctor.email})`);
      } else {
        console.log(`- ${doctor.name} already has subscription record`);
      }
    }

    // Show total subscriptions
    const total = await query('SELECT COUNT(*) FROM subscriptions');
    console.log(`\n✓ Total subscriptions: ${total.rows[0].count}`);
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

addMissingSubscriptions();
