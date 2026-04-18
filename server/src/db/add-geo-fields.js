import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function addGeoFields() {
  const client = await pool.connect();
  try {
    console.log('🌍 Añadiendo campos de geolocalización a doctores...');
    
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `);
    
    // Sembrando coordenadas de prueba para los médicos existentes (Buenos Aires como ejemplo)
    await client.query(`
      UPDATE doctors 
      SET latitude = -34.6037 + (random() * 0.05), 
          longitude = -58.3816 + (random() * 0.05)
      WHERE latitude IS NULL;
    `);

    console.log('✅ Campos latitude y longitude añadidos y sembrados.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addGeoFields();
