import { query } from './src/db/config.js';

async function updateDb() {
  try {
    console.log('⏳ Añadiendo columna accumulated_debt a doctors...');
    await query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS accumulated_debt DECIMAL(10,2) DEFAULT 0.00;');
    console.log('✅ Base de datos actualizada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error actualizando DB:', err);
    process.exit(1);
  }
}

updateDb();
