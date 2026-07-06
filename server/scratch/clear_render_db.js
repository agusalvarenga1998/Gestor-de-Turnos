import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ ERROR: Debes definir la variable de entorno DATABASE_URL.');
  console.error('Ejemplo (PowerShell): $env:DATABASE_URL="tu_url_conexion_externa"; node scratch/clear_render_db.js');
  console.error('Ejemplo (Bash/Terminal): DATABASE_URL="tu_url_conexion_externa" node scratch/clear_render_db.js');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false } // Requerido por Render para conexiones externas SSL
});

async function clearRender() {
  try {
    console.log('🔄 Conectando a la base de datos de Render...');
    
    // 1. Contar doctores actuales
    const countRes = await pool.query('SELECT COUNT(*) FROM doctors');
    const doctorCount = parseInt(countRes.rows[0].count);
    console.log(`Doctores registrados en Render: ${doctorCount}`);

    if (doctorCount === 0) {
      console.log('No hay doctores registrados en Render.');
      return;
    }

    // 2. Mostrar la lista de doctores que se van a eliminar
    const listRes = await pool.query('SELECT id, name, email FROM doctors');
    console.log('Doctores a eliminar:');
    listRes.rows.forEach(d => {
      console.log(`- ID: ${d.id} | Nombre: ${d.name} | Email: ${d.email}`);
    });

    // 3. Eliminar todos los doctores
    console.log('Eliminando todos los doctores en Render (cascada activa)...');
    const deleteRes = await pool.query('DELETE FROM doctors');
    console.log(`✓ Eliminación completada. Filas afectadas: ${deleteRes.rowCount}`);

    // 4. Verificar conteo final
    const finalCountRes = await pool.query('SELECT COUNT(*) FROM doctors');
    console.log(`Doctores restantes en Render: ${finalCountRes.rows[0].count}`);

  } catch (err) {
    console.error('❌ ERROR EN LA OPERACIÓN:', err.message);
  } finally {
    await pool.end();
  }
}

clearRender();
