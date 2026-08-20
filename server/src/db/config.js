import pkg from 'pg';
const { Pool, types } = pkg;
import dotenv from 'dotenv';
import path from 'path';

// Forzar que el tipo DATE (OID 1082) se retorne como string en lugar de objeto Date de JS
types.setTypeParser(1082, (val) => val);

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config();

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      keepAlive: true,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio_medico',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
      keepAlive: true,
    };

const pool = new Pool({
  ...poolConfig,
  max: 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('⚠️ Aviso/Error en pool de conexiones PostgreSQL:', err.message);
});

pool.on('connect', () => {
  // Conexión nueva establecida
});

// Función optimizada para ejecutar consultas utilizando pool.query directamente
export const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Error en query SQL:', error.message);
    throw error;
  }
};

// Función para ejecutar transacciones con un cliente dedicado del pool
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en transacción SQL:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
