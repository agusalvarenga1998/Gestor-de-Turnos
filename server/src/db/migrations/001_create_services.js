import { query } from '../config.js';

async function migrate() {
  console.log('🚀 Iniciando migración: Tabla Services...');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) DEFAULT 0.00,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // También añadiremos una columna opcional a appointments para guardar el service_id
    await query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id) ON DELETE SET NULL;
    `);

    console.log('✅ Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  }
}

migrate();
