import { query } from './config.js';

console.log('🔄 Ejecutando migration: add-google-auth.js...\n');

const migrationSQL = `
-- Agregar google_id para identificar al doctor por su cuenta de Google
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Hacer password_hash nullable (para doctores que se registran solo con Google)
ALTER TABLE doctors
  ALTER COLUMN password_hash DROP NOT NULL;
`;

try {
  await query(migrationSQL);
  console.log('✅ Migration completada exitosamente');
  console.log('   - Columna google_id agregada a doctors');
  console.log('   - password_hash ahora es nullable\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Error ejecutando migration:', error.message);
  process.exit(1);
}
