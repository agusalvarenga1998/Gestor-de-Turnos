import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'consultorio_medico',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function fix() {
  const client = await pool.connect();
  try {
    // Configurar una dirección real de Buenos Aires (Obelisco aproximado)
    const address = 'Av. Corrientes 1050, CABA, Argentina';
    const lat = -34.6037389;
    const lon = -58.3815704;

    await client.query(
      `UPDATE doctors 
       SET address = $1, clinic_address = $1, latitude = $2, longitude = $3 
       WHERE status = 'approved'`,
      [address, lat, lon]
    );
    console.log(`✅ ¡Éxito! Médico actualizado con: ${address}`);
  } finally {
    client.release();
    await pool.end();
  }
}
fix();
