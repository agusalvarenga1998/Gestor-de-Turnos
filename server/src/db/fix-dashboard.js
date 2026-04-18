import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️ Creando tablas de seguros y ajustando citas...');
    
    // 1. Crear tabla insurance_companies
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        additional_fee DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ajustar tabla appointments
    await client.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS confirmation_token UUID DEFAULT gen_random_uuid();
    `);

    // 3. Insertar algunas obras sociales de prueba
    await client.query(`
      INSERT INTO insurance_companies (name, additional_fee)
      VALUES 
        ('Particular', 0),
        ('OSDE 210', 1500),
        ('Galeno Oro', 1000),
        ('Swiss Medical', 1200)
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('✅ Base de datos lista para el Dashboard');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
