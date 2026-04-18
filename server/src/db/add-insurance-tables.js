import { query } from './config.js';

console.log('🔄 Ejecutando migration: add-insurance-tables.js...\n');

const migrationSQL = `
-- Obras sociales disponibles (definidas por el doctor)
CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  additional_fee DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación N:N paciente ↔ obra social
CREATE TABLE IF NOT EXISTS patient_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, insurance_company_id)
);

-- Columna en appointments para la obra social seleccionada
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES insurance_companies(id);
`;

try {
  await query(migrationSQL);
  console.log('✅ Tablas de obras sociales creadas correctamente');
  console.log('   - insurance_companies');
  console.log('   - patient_insurances');
  console.log('   - insurance_company_id agregado a appointments\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Error ejecutando migration:', error.message);
  process.exit(1);
}
