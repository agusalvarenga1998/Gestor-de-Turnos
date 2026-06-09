import pkg from 'pg';
const { Pool, types } = pkg;
import dotenv from 'dotenv';

// Forzar que el tipo DATE (OID 1082) se retorne como string en lugar de objeto Date de JS
types.setTypeParser(1082, (val) => val);

dotenv.config();

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio_medico',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de conexiones:', err);
});

pool.on('connect', () => {
  console.log('✓ Conexión a PostgreSQL establecida');
});

// Función para ejecutar consultas
export const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Error en query:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Función para ejecutar transacciones
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en transacción:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
