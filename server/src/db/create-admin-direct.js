import { query } from '../db/config.js';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: node create-admin-direct.js <email> <name> <password>');
  console.error('Example: node create-admin-direct.js admin@example.com "Admin Name" adminpass123');
  process.exit(1);
}

const [email, name, password] = args;

async function createAdmin() {
  try {
    console.log('\n=== Creating Admin User ===\n');

    if (!email || !email.includes('@')) {
      throw new Error('Invalid email');
    }

    if (!name) {
      throw new Error('Name is required');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      throw new Error('Admin with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const result = await query(
      'INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, passwordHash, name]
    );

    console.log('✓ Admin created successfully:');
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Name: ${result.rows[0].name}\n`);

    process.exit(0);
  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
    process.exit(1);
  }
}

createAdmin();
