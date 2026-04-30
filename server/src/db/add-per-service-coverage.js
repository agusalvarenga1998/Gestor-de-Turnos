import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio_medico',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool(poolConfig);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando migración de coberturas por servicio...');

    // 1. Crear la tabla de coberturas por servicio
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_service_coverage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        coverage_type VARCHAR(20) NOT NULL DEFAULT 'fixed_amount', -- 'fixed_amount' o 'percentage'
        coverage_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(insurance_company_id, service_id)
      );
    `);
    console.log('✅ Tabla insurance_service_coverage creada');

    console.log('🎉 Migración completada con éxito');
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
