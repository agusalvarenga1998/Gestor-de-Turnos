import { query } from './config.js';

console.log('🔄 Ejecutando migration: add-calendar-tokens.js...\n');

const migrationSQL = `
-- Agregar columnas para tokens de Google Calendar
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);
`;

try {
  await query(migrationSQL);
  console.log('✅ Migration completada exitosamente');
  console.log('   - Columnas google_access_token, google_refresh_token y google_calendar_id agregadas a doctors\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Error ejecutando migration:', error.message);
  process.exit(1);
}
