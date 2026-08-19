import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
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
      password: process.env.DB_PASSWORD || 'Agusagusbmx15$',
    };

const pool = new Pool(poolConfig);

async function migrateSellers() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔄 Ejecutando migración de vendedores...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sellers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tabla sellers creada/verificada');

    const sellerEmail = 'vendedor@turnohub.com';
    const sellerPass = 'Vendedor2026!';
    const hashedPass = await bcrypt.hash(sellerPass, 10);

    await client.query(`
      INSERT INTO sellers (email, password_hash, name, phone)
      VALUES ($1, $2, 'Vendedor Oficial TurnoHub', '+5491100000000')
      ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = 'Vendedor Oficial TurnoHub';
    `, [sellerEmail, hashedPass]);

    console.log(`✓ Cuenta de vendedor demo creada: ${sellerEmail} (Clave: ${sellerPass})`);
    console.log('✅ Migración finalizada con éxito.');
  } catch (error) {
    console.error('❌ Error en migración de vendedores:', error);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

migrateSellers();
