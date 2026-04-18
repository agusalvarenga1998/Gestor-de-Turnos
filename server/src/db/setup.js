import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Pool para conectarse al servidor postgres (sin base de datos específica)
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: 'postgres', // Conectarse a la BD por defecto
});

async function setupDatabase() {
  const client = await adminPool.connect();

  try {
    console.log('🔧 Configurando base de datos...\n');

    // Verificar si la base de datos existe
    const dbExists = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'consultorio_medico'}'`
    );

    if (dbExists.rows.length === 0) {
      console.log(`📍 Creando base de datos '${process.env.DB_NAME || 'consultorio_medico'}'...`);
      await client.query(`CREATE DATABASE "${process.env.DB_NAME || 'consultorio_medico'}"`);
      console.log('✅ Base de datos creada exitosamente\n');
    } else {
      console.log(`✅ Base de datos '${process.env.DB_NAME || 'consultorio_medico'}' ya existe\n`);
    }
  } catch (error) {
    console.error('❌ Error al crear base de datos:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  La base de datos ya existe, continuando...\n');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

// Ejecutar setup
setupDatabase();
