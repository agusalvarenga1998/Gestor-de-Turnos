import pkg from 'pg';
const { Pool } = pkg;
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function fixAndGeocode() {
  const client = await pool.connect();
  try {
    console.log('🧹 Sincronizando campos y geocodificando...');
    
    // 1. Unificar clinic_address con address
    await client.query("UPDATE doctors SET clinic_address = address WHERE address IS NOT NULL");
    
    // 2. Obtener doctores para geocodificar
    const { rows: doctors } = await client.query(
      "SELECT id, address FROM doctors WHERE address IS NOT NULL AND address != ''"
    );

    for (const doc of doctors) {
      console.log(`📍 Procesando dirección: "${doc.address}"`);
      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
          params: { q: doc.address, format: 'json', limit: 1 },
          headers: { 'User-Agent': 'TurnoHub-App/1.0' }
        });

        if (response.data && response.data.length > 0) {
          const { lat, lon } = response.data[0];
          await client.query(
            'UPDATE doctors SET latitude = $1, longitude = $2 WHERE id = $3',
            [lat, lon, doc.id]
          );
          console.log(`✅ ¡Éxito! Nueva ubicación: ${lat}, ${lon}`);
        } else {
          console.warn(`⚠️ No se encontró ubicación para: ${doc.address}`);
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`❌ Error con doctor ${doc.id}:`, err.message);
      }
    }

    console.log('✨ Base de datos geoespacial saneada.');
  } catch (err) {
    console.error('❌ Error general:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAndGeocode();
