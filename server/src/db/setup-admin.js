import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('👷 Configurando tablas de administración...');
    
    // Crear tabla admins
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla subscriptions
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar admin si no existe
    const hashedPass = await bcrypt.hash('adminpass123', 10);
    await client.query(`
      INSERT INTO admins (email, password_hash, name)
      VALUES ('admin@example.com', $1, 'Administrador')
      ON CONFLICT (email) DO NOTHING;
    `, [hashedPass]);

    console.log('✅ Tablas creadas y usuario admin@example.com listo.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
