import { query, transaction } from './config.js';

async function fixAppointmentsConstraint() {
  try {
    console.log('🔧 Arreglando constraint de appointments...\n');

    // Primero, obtener el nombre exacto de la constraint
    const constraintResult = await query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'appointments'
      AND constraint_type = 'UNIQUE'
    `);

    console.log('Constraints UNIQUE encontrados:');
    constraintResult.rows.forEach(row => {
      console.log('  -', row.constraint_name);
    });

    // Usar transaction para que se ejecute todo junto
    await transaction(async (client) => {
      // Remover todos los constraints UNIQUE
      for (const constraint of constraintResult.rows) {
        console.log(`\nRemoviendo: ${constraint.constraint_name}`);
        try {
          await client.query(`
            ALTER TABLE appointments
            DROP CONSTRAINT ${constraint.constraint_name}
          `);
          console.log('  ✓ Removido');
        } catch (err) {
          console.log('  ⚠️  No se pudo remover:', err.message);
        }
      }

      // Crear índice único parcial que solo considere citas no canceladas
      console.log('\nCreando índice único parcial (solo citas activas)...');
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active
        ON appointments(doctor_id, appointment_date, appointment_time)
        WHERE status != 'cancelled'
      `);
      console.log('  ✓ Índice creado');
    });

    console.log('\n✅ Constraint arreglado correctamente\n');
  } catch (error) {
    console.error('❌ Error arreglando constraint:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAppointmentsConstraint().catch(() => process.exit(1));
}

export default fixAppointmentsConstraint;
