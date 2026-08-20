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

export async function seedDemoAccounts() {
  let client;
  try {
    client = await pool.connect();
    console.log('🌱 Inicializando cuentas y datos pre-cargados de Demo por Plan...');

    // 1. Agregar columna seller_notes si no existe
    await client.query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS seller_notes TEXT;
    `);

    // 2. Obtener IDs de planes de precios
    const plansRes = await client.query(`SELECT id, key FROM pricing_plans`);
    const planMap = {};
    plansRes.rows.forEach(row => {
      planMap[row.key] = row.id;
    });

    const defaultPassword = await bcrypt.hash('Demo2026!', 10);

    // Definición de las 4 cuentas demo
    const demoAccountsConfig = [
      {
        email: 'demo.mensual@turnohub.com',
        name: 'Dra. María González (Demo Mensual Pro)',
        specialization: 'Medicina General & Estética',
        rubro: 'Salud y Medicina',
        clinic_name: 'Centro Médico & Estético Estilo',
        planKey: 'mensual_pro',
        subscriptionStatus: 'active',
        phone: '+5491144445555',
        type: 'mensual',
        docPrefix: '11'
      },
      {
        email: 'demo.odontologia@turnohub.com',
        name: 'Dr. Roberto Fernández (Demo Odontología)',
        specialization: 'Odontología General & Implantología',
        rubro: 'Odontología',
        clinic_name: 'Dental Care San Martín',
        planKey: 'odontologia',
        subscriptionStatus: 'active',
        phone: '+5491133334444',
        type: 'odontologia',
        docPrefix: '22'
      },
      {
        email: 'demo.filavirtual@turnohub.com',
        name: 'Barbería & Estética Urbana (Demo Fila Virtual)',
        specialization: 'Cortes, Barba & Estética Espontánea',
        rubro: 'Barbería y Peluquería',
        clinic_name: 'Urbano Barber Shop',
        planKey: 'orden_llegada',
        subscriptionStatus: 'active',
        phone: '+5491122223333',
        type: 'filavirtual',
        docPrefix: '33'
      },
      {
        email: 'demo.comision@turnohub.com',
        name: 'Lic. Sofía Martinez (Demo Plan Comisión)',
        specialization: 'Psicología & Psicoterapia',
        rubro: 'Salud y Medicina',
        clinic_name: 'Consultorio Lic. Martinez',
        planKey: 'commission',
        subscriptionStatus: 'active',
        phone: '+5491166667777',
        type: 'comision',
        docPrefix: '44'
      }
    ];

    for (const demoConf of demoAccountsConfig) {
      const planId = planMap[demoConf.planKey] || null;

      // Buscar si el usuario demo ya existe
      const existingDocRes = await client.query(`SELECT id FROM doctors WHERE email = $1`, [demoConf.email]);
      let doctorId;

      if (existingDocRes.rows.length > 0) {
        doctorId = existingDocRes.rows[0].id;
        await client.query(`
          UPDATE doctors SET
            name = $1,
            specialization = $2,
            rubro = $3,
            clinic_name = $4,
            pricing_plan_id = $5,
            subscription_status = 'active',
            subscription_expires_at = NOW() + INTERVAL '365 days',
            is_active = true
          WHERE id = $6
        `, [demoConf.name, demoConf.specialization, demoConf.rubro, demoConf.clinic_name, planId, doctorId]);
      } else {
        const insertRes = await client.query(`
          INSERT INTO doctors (
            email, password_hash, name, specialization, rubro, clinic_name, phone, 
            status, subscription_status, subscription_expires_at, pricing_plan_id, is_active
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            'approved', 'active', NOW() + INTERVAL '365 days', $8, true
          )
          RETURNING id;
        `, [demoConf.email, defaultPassword, demoConf.name, demoConf.specialization, demoConf.rubro, demoConf.clinic_name, demoConf.phone, planId]);
        doctorId = insertRes.rows[0].id;
      }

      console.log(`  ✓ Profesional Demo [${demoConf.planKey}]: ${demoConf.email} (${doctorId})`);

      // Cargar datos específicos para cada tipo de demo si está vacía
      const checkPatients = await client.query(`SELECT COUNT(*) FROM patients WHERE doctor_id = $1`, [doctorId]);
      const patientsCount = parseInt(checkPatients.rows[0].count, 10);

      if (patientsCount === 0) {
        const p1 = await client.query(`
          INSERT INTO patients (doctor_id, name, email, phone, date_of_birth, gender, address, medical_history, document_number)
          VALUES 
          ($1, 'Carlos Benítez', 'carlos.benitez.${demoConf.docPrefix}@ejemplo.com', '+5491155551111', '1985-04-12', 'M', 'Av. Santa Fe 1420', 'Sin antecedentes alérgicos', '${demoConf.docPrefix}456789'),
          ($1, 'Ana Laura Ramírez', 'ana.ramirez.${demoConf.docPrefix}@ejemplo.com', '+5491155552222', '1992-08-25', 'F', 'Calle Corrientes 890', 'Paciente habitual', '${demoConf.docPrefix}789123'),
          ($1, 'Lucas Peralta', 'lucas.peralta.${demoConf.docPrefix}@ejemplo.com', '+5491155553333', '1998-11-03', 'M', 'Belgrano 450', 'Sin observaciones', '${demoConf.docPrefix}234567'),
          ($1, 'Mariana Rossi', 'mariana.rossi.${demoConf.docPrefix}@ejemplo.com', '+5491155554444', '1979-01-30', 'F', 'Maipú 112', 'Hipertensión leve', '${demoConf.docPrefix}890123')
          RETURNING id, name;
        `, [doctorId]);

        const patients = p1.rows;

        // Insertar servicios de prueba
        let s1, s2;
        if (demoConf.type === 'odontologia') {
          s1 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Limpieza y Profilaxis Dental', 'Higiene dental profunda y pulido', 18000, 45, 5000) RETURNING id`, [doctorId]);
          s2 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Restauración Estética / Arreglo', 'Obturación con resina de alta estética', 25000, 60, 5000) RETURNING id`, [doctorId]);
        } else if (demoConf.type === 'filavirtual') {
          s1 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Corte de Cabello & Peinado', 'Corte moderno con lavado y peinado', 8000, 30, 0) RETURNING id`, [doctorId]);
          s2 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Perfilado de Barba', 'Recorte, perfilado y toalla caliente', 6000, 20, 0) RETURNING id`, [doctorId]);
        } else {
          s1 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Consulta Presencial / Control', 'Evaluación integral y diagnóstico', 20000, 30, 5000) RETURNING id`, [doctorId]);
          s2 = await client.query(`INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee) VALUES ($1, 'Telemedicina / Consulta Online', 'Videollamada Google Meet automática', 18000, 30, 5000) RETURNING id`, [doctorId]);
        }

        const serviceId1 = s1.rows[0]?.id;
        const serviceId2 = s2.rows[0]?.id;

        // Cargar turnos de prueba en fechas recientes y futuras
        const todayStr = new Date().toISOString().split('T')[0];

        try {
          await client.query(`
            INSERT INTO appointments (doctor_id, patient_id, appointment_date, appointment_time, end_time, status, reason_for_visit, total_price, booking_fee_paid, payment_status, service_id)
            VALUES 
            ($1, $2, $3, '10:00:00', '10:30:00', 'confirmed', 'Consulta de rutina', 20000, 5000, 'paid', $4),
            ($1, $5, $3, '11:00:00', '11:30:00', 'pending', 'Seguimiento y control', 18000, 0, 'pending', $6),
            ($1, $7, CURRENT_DATE + INTERVAL '1 day', '15:00:00', '15:30:00', 'confirmed', 'Tratamiento estético', 25000, 5000, 'paid', $4);
          `, [doctorId, patients[0].id, todayStr, serviceId1, patients[1].id, serviceId2, patients[2].id]);
        } catch (e) {
          // Ignorar si ya existían turnos en ese horario
        }

        // Si es Fila Virtual, insertar items en waiting_queue
        if (demoConf.type === 'filavirtual') {
          await client.query(`
            INSERT INTO waiting_queue (doctor_id, patient_id, ticket_number, ticket_code, patient_name, patient_phone, service_name, status, joined_at)
            VALUES 
            ($1, $2, 101, 'A-101', 'Carlos Benítez', '+5491155551111', 'Corte de Cabello & Peinado', 'completed', NOW() - INTERVAL '40 minutes'),
            ($1, $3, 102, 'A-102', 'Ana Laura Ramírez', '+5491155552222', 'Perfilado de Barba', 'called', NOW() - INTERVAL '10 minutes'),
            ($1, $4, 103, 'A-103', 'Lucas Peralta', '+5491155553333', 'Corte de Cabello & Peinado', 'waiting', NOW() - INTERVAL '5 minutes');
          `, [doctorId, patients[0].id, patients[1].id, patients[2].id]);
        }

        // Si es Odontología, cargar expedientes/registros de odontograma en patient_records
        if (demoConf.type === 'odontologia') {
          await client.query(`
            INSERT INTO patient_records (patient_id, doctor_id, type, title, content)
            VALUES 
            ($1, $2, 'note', 'Odontograma Inicial', 'Pieza 16: Resina oclusal realizada. Pieza 24: Caries leve tratada. Limpieza ultrasónica efectuada.'),
            ($3, $2, 'note', 'Control Dental', 'Encías sanas, se sugiere blanqueamiento en próxima sesión.');
          `, [patients[0].id, doctorId, patients[1].id]);
        }

        // Cargar movimientos de caja
        await client.query(`
          INSERT INTO movements (doctor_id, amount, type, payment_method, description)
          VALUES 
          ($1, 5000, 'seña', 'mercadopago', 'Seña cobrada online'),
          ($1, 15000, 'cobro', 'efectivo', 'Cobro de saldo restante de consulta'),
          ($1, -2500, 'gasto', 'efectivo', 'Compra de insumos y descartables');
        `, [doctorId]);

        console.log(`    → Datos de prueba cargados correctamente para ${demoConf.email}`);
      }
    }

    console.log('✅ Cuentas y datos pre-cargados de Demo listos.');
  } catch (error) {
    console.error('❌ Error en seedDemoAccounts:', error);
  } finally {
    if (client) client.release();
  }
}

// Ejecutar directamente si se llama desde la terminal
if (process.argv[1] && process.argv[1].includes('seed-demo-accounts.js')) {
  seedDemoAccounts().then(() => process.exit(0));
}
