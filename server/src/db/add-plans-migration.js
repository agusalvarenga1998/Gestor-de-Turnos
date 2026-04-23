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
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Iniciando migración para planes de clientes...');

    // 1. Añadir plan_type y commission_rate a la tabla de doctores
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 3.00;
    `);
    console.log('✓ Columnas plan_type y commission_rate añadidas a doctors');

    // 2. Añadir fee_charged a la tabla de turnos
    await client.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS fee_charged BOOLEAN DEFAULT false;
    `);
    console.log('✓ Columna fee_charged añadida a appointments');

    // 3. Asegurar que los doctores existentes tengan un plan por defecto
    await client.query(`
      UPDATE doctors SET plan_type = 'monthly' WHERE plan_type IS NULL;
    `);
    console.log('✓ Plan por defecto configurado para doctores existentes');

    console.log('✅ Migración completada con éxito');
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
