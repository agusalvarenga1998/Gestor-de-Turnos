import bcrypt from 'bcryptjs';
import { query } from './config.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedDatabase() {
  try {
    console.log('🌱 Sembrando datos de prueba...\n');

    // Limpiar tablas para evitar duplicados
    console.log('🧹 Limpiando tablas...');
    await query('TRUNCATE TABLE appointments, patients, doctors, insurance_companies RESTART IDENTITY CASCADE');
    console.log('✓ Tablas limpias\n');

    // Crear un doctor de prueba
    const hashedPassword = await bcrypt.hash('password123', 10);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15); // 15 días de prueba

    const doctorResult = await query(
      `INSERT INTO doctors (email, password_hash, name, specialization, phone, clinic_name, clinic_address, status, subscription_status, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', 'trial', $8)
       RETURNING id, email, name`,
      [
        'doctor@example.com',
        hashedPassword,
        'Dr. Juan Pérez',
        'Cardiología',
        '+56912345678',
        'Clínica La Salud',
        'Calle Principal 123, Santiago',
        trialEndsAt
      ]
    );

    const doctorId = doctorResult.rows[0].id;
    console.log('✓ Doctor creado:', doctorResult.rows[0]);

    // Crear pacientes de prueba
    const patientsData = [
      {
        name: 'Carlos González',
        email: 'carlos@example.com',
        phone: '+56987654321',
        date_of_birth: '1980-05-15',
        gender: 'M',
        address: 'Avenida Siempre Viva 123'
      },
      {
        name: 'María López',
        email: 'maria@example.com',
        phone: '+56987654322',
        date_of_birth: '1985-08-20',
        gender: 'F',
        address: 'Calle Nueva 456'
      },
      {
        name: 'Roberto Martínez',
        email: 'roberto@example.com',
        phone: '+56987654323',
        date_of_birth: '1975-03-10',
        gender: 'M',
        address: 'Pasaje Central 789'
      }
    ];

    const patients = [];
    for (const patient of patientsData) {
      const result = await query(
        `INSERT INTO patients (doctor_id, name, email, phone, date_of_birth, gender, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email`,
        [
          doctorId,
          patient.name,
          patient.email,
          patient.phone,
          patient.date_of_birth,
          patient.gender,
          patient.address
        ]
      );
      patients.push(result.rows[0]);
    }

    console.log(`✓ ${patients.length} pacientes creados\n`);

    // Crear disponibilidades (Lunes a Viernes, 09:00 a 17:00)
    const days = [1, 2, 3, 4, 5]; // Lunes a Viernes
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    for (let i = 0; i < days.length; i++) {
      await query(
        `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [doctorId, days[i], '09:00', '17:00']
      );
    }

    console.log('✓ Disponibilidades creadas (Lunes a Viernes 09:00-17:00)\n');

    // Crear algunas citas de prueba
    const appointmentsData = [
      {
        patient_index: 0,
        appointment_date: new Date().toISOString().split('T')[0], // Hoy
        appointment_time: '10:00',
        end_time: '10:30',
        reason_for_visit: 'Chequeo general',
        status: 'scheduled'
      },
      {
        patient_index: 1,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '11:00',
        end_time: '11:30',
        reason_for_visit: 'Control de presión',
        status: 'scheduled'
      },
      {
        patient_index: 2,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '14:00',
        end_time: '14:30',
        reason_for_visit: 'Seguimiento',
        status: 'scheduled'
      }
    ];

    for (let i = 0; i < appointmentsData.length; i++) {
      const appt = appointmentsData[i];
      await query(
        `INSERT INTO appointments (doctor_id, patient_id, appointment_date, appointment_time, end_time, reason_for_visit, status, queue_position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          doctorId,
          patients[appt.patient_index].id,
          appt.appointment_date,
          appt.appointment_time,
          appt.end_time,
          appt.reason_for_visit,
          appt.status,
          i + 1
        ]
      );
    }

    console.log('✓ Citas de prueba creadas\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BASE DE DATOS SEMBRADA CORRECTAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Credenciales de prueba:');
    console.log('   Email:', doctorResult.rows[0].email);
    console.log('   Contraseña: password123\n');

    console.log('👥 Pacientes creados:');
    patients.forEach(p => {
      console.log(`   - ${p.name} (${p.email})`);
    });

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sembrando base de datos:', error.message);
    process.exit(1);
  }
}

seedDatabase();
