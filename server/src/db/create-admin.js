import { query } from '../db/config.js';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=== Admin User Creation ===\n');

    const email = await question('Email: ');
    if (!email || !email.includes('@')) {
      console.error('✗ Invalid email');
      process.exit(1);
    }

    const name = await question('Full Name: ');
    if (!name) {
      console.error('✗ Name is required');
      process.exit(1);
    }

    const password = await question('Password (min 8 chars): ');
    if (password.length < 8) {
      console.error('✗ Password must be at least 8 characters');
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      console.error('✗ Admin with this email already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const result = await query(
      'INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, passwordHash, name]
    );

    console.log('\n✓ Admin created successfully:');
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Name: ${result.rows[0].name}\n`);

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();
