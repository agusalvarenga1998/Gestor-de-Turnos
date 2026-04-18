import { query } from './config.js';

async function addConfirmationToken() {
  try {
    console.log('🔄 Agregando columna confirmation_token a appointments...\n');

    // Agregar columna si no existe
    await query(`
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS confirmation_token TEXT UNIQUE
    `);

    console.log('✓ Columna confirmation_token agregada\n');
    console.log('✅ Migration completada\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addConfirmationToken();
