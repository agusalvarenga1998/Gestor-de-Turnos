import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('📋 Agregando columna document_number a tabla patients...\n');

    // Agregar columna document_number
    await client.query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);
    `);
    console.log('✓ Columna document_number agregada');

    // Crear índice único para document_number
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_document_number
      ON patients(document_number) WHERE document_number IS NOT NULL;
    `);
    console.log('✓ Índice único en document_number creado');

    console.log('\n✅ Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
