import { query } from './src/db/config.js';

async function main() {
  console.log('Conectando a la BD...');

  try {
    // Verificar conexión
    await query('SELECT 1');
    console.log('✓ Conectado\n');

    // Ver constraints actuales
    console.log('Buscando constraints UNIQUE...');
    const constraints = await query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'appointments'
      AND constraint_type = 'UNIQUE'
    `);

    console.log('Encontrados:', constraints.rows.length);
    constraints.rows.forEach(row => {
      console.log('  -', row.constraint_name);
    });

    // Remover constraints
    if (constraints.rows.length > 0) {
      console.log('\nRemoviendo constraints...');
      for (const row of constraints.rows) {
        try {
          await query(`ALTER TABLE appointments DROP CONSTRAINT ${row.constraint_name}`);
          console.log('  ✓', row.constraint_name);
        } catch (e) {
          console.log('  ⚠️', row.constraint_name, '-', e.message);
        }
      }
    }

    // Crear índice único parcial
    console.log('\nCreando índice único parcial...');
    try {
      await query(`
        DROP INDEX IF EXISTS idx_appointments_unique_active
      `);
      console.log('  ✓ Índice anterior removido');
    } catch (e) {
      console.log('  ℹ️ No había índice anterior');
    }

    await query(`
      CREATE UNIQUE INDEX idx_appointments_unique_active
      ON appointments(doctor_id, appointment_date, appointment_time)
      WHERE status != 'cancelled'
    `);
    console.log('  ✓ Nuevo índice creado\n');

    console.log('✅ Completado!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
