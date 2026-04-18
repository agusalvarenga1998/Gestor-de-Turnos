import { query, transaction } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';
import * as googleCalendarService from './googleCalendarService.js';
import * as emailService from './emailService.js';
const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MH-${code}`;
};

// Crear una cita
export const createAppointment = async (doctorId, patientId, appointmentData) => {
  const { 
    appointment_date, 
    appointment_time, 
    end_time, 
    reason_for_visit, 
    insurance_company_id,
    serviceId,
    durationMinutes,
    servicePrice
  } = appointmentData;

  try {
    console.log('\n📌 === CREAR CITA ===');
    console.log('Doctor ID:', doctorId);
    console.log('Patient ID:', patientId);
    console.log('Servicio:', serviceId, 'Duración:', durationMinutes, 'Precio:', servicePrice);

    const appointmentId = uuidv4();
    const confirmationToken = uuidv4();
    const appointmentCode = generateShortCode();

    // Obtener precio base del doctor si no hay precio de servicio
    let finalPrice = servicePrice;
    if (finalPrice === null || finalPrice === undefined) {
      const doctorResult = await query('SELECT appointment_price FROM doctors WHERE id = $1', [doctorId]);
      finalPrice = parseFloat(doctorResult.rows[0]?.appointment_price || 0);
    }

    const result = await query(
      `INSERT INTO appointments (
        id, 
        doctor_id, 
        patient_id, 
        appointment_date, 
        appointment_time, 
        end_time, 
        reason_for_visit, 
        status, 
        confirmation_token, 
        insurance_company_id, 
        total_amount, 
        system_fee, 
        payment_status, 
        appointment_code,
        total_price,
        service_id,
        duration_minutes,
        booking_fee_paid,
        coverage_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        appointmentId, 
        doctorId, 
        patientId, 
        appointment_date, 
        appointment_time, 
        end_time || null, 
        reason_for_visit, 
        confirmationToken, 
        insurance_company_id || null, 
        0, 
        0, 
        'paid', 
        appointmentCode,
        finalPrice,
        serviceId || null,
        durationMinutes || 30,
        0, // booking_fee_paid
        0  // coverage_amount
      ]
    );

    const appointment = result.rows[0];
    console.log('✓ Cita insertada en BD');
    console.log('🔐 Token de confirmación:', confirmationToken.substring(0, 8) + '...');

    // Obtener datos del paciente y doctor para enviar email
    console.log('📧 Obteniendo datos para enviar email...');
    const patientResult = await query('SELECT name, email FROM patients WHERE id = $1', [patientId]);
    const doctorResult = await query('SELECT name, specialization FROM doctors WHERE id = $1', [doctorId]);

    const patient = patientResult.rows[0];
    const doctor = doctorResult.rows[0];

    // Enviar email de confirmación
    if (patient && patient.email) {
      const confirmUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/appointment/${confirmationToken}`;
      await emailService.sendAppointmentConfirmation({
        to: patient.email,
        patientName: patient.name,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialization,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        reason: reason_for_visit,
        appointmentCode: appointment.appointment_code,
        confirmUrl: confirmUrl
      });
    }

    // Sincronizar con Google Calendar si el doctor tiene conexión
    console.log('🔄 Llamando a createCalendarEvent...');
    try {
      const googleEventId = await googleCalendarService.createCalendarEvent(doctorId, appointment);
      console.log('Resultado:', googleEventId);
    } catch (error) {
      console.error('Error sincronizando con Google Calendar:', error.message);
      // No lanzar error para no romper el flujo de creación de cita
    }

    console.log('✓ Cita creada exitosamente\n');
    return appointment;
  } catch (error) {
    console.error('Error en createAppointment:', error.message);
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('Ya existe una cita en ese horario');
    }
    throw error;
  }
};

// Obtener citas de un doctor
export const getAppointmentsByDoctor = async (doctorId, filters = {}) => {
  let queryText = `
    SELECT
      a.*,
      p.name as patient_name,
      p.phone as patient_phone,
      p.email as patient_email,
      ic.name as insurance_name,
      ic.additional_fee as insurance_fee
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN insurance_companies ic ON a.insurance_company_id = ic.id
    WHERE a.doctor_id = $1 AND a.status != 'pending_payment'
  `;

  const params = [doctorId];
  let paramIndex = 2;

  // Filtrar por fecha
  if (filters.date) {
    queryText += ` AND a.appointment_date = $${paramIndex}`;
    params.push(filters.date);
    paramIndex++;
  }

  // Filtrar por estado
  if (filters.status) {
    queryText += ` AND a.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  // Ordenar por fecha y hora
  queryText += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

  const result = await query(queryText, params);
  return result.rows;
};

// Obtener citas de un paciente
export const getAppointmentsByPatient = async (patientId) => {
  const result = await query(
    `SELECT
      a.*,
      d.name as doctor_name,
      d.specialization,
      d.clinic_name,
      d.phone as doctor_phone
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.patient_id = $1
    ORDER BY a.appointment_date DESC`,
    [patientId]
  );

  return result.rows;
};

// Obtener cita por ID
export const getAppointmentById = async (appointmentId) => {
  const result = await query(
    `SELECT
      a.*,
      p.name as patient_name,
      p.phone as patient_phone,
      p.email as patient_email,
      d.name as doctor_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.id = $1`,
    [appointmentId]
  );

  return result.rows[0];
};

// Actualizar cita
export const updateAppointment = async (appointmentId, updateData) => {
  const { appointment_date, appointment_time, end_time, status, reason_for_visit, notes, delay_minutes, insurance_company_id } = updateData;

  try {
    // Obtener cita actual para sincronización
    const currentResult = await query(
      'SELECT * FROM appointments WHERE id = $1',
      [appointmentId]
    );

    const currentAppointment = currentResult.rows[0];

    const result = await query(
      `UPDATE appointments
       SET appointment_date = COALESCE($1, appointment_date),
           appointment_time = COALESCE($2, appointment_time),
           end_time = COALESCE($3, end_time),
           status = COALESCE($4, status),
           reason_for_visit = COALESCE($5, reason_for_visit),
           notes = COALESCE($6, notes),
           delay_minutes = COALESCE($7, delay_minutes),
           insurance_company_id = COALESCE($9, insurance_company_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [appointment_date, appointment_time, end_time, status, reason_for_visit, notes, delay_minutes, appointmentId, insurance_company_id]
    );

    const updatedAppointment = result.rows[0];

    // Sincronizar cambios con Google Calendar si existe el evento
    if (currentAppointment && currentAppointment.google_event_id) {
      try {
        await googleCalendarService.updateCalendarEvent(
          currentAppointment.doctor_id,
          currentAppointment.google_event_id,
          updatedAppointment
        );
      } catch (error) {
        console.error('Error actualizando evento en Google Calendar:', error);
        // No lanzar error
      }
    }

    return updatedAppointment;
  } catch (error) {
    throw error;
  }
};

// Cancelar cita
export const cancelAppointment = async (appointmentId) => {
  try {
    // Obtener la cita para tener acceso a google_event_id
    const appointmentResult = await query(
      'SELECT * FROM appointments WHERE id = $1',
      [appointmentId]
    );

    const appointment = appointmentResult.rows[0];

    const result = await query(
      `UPDATE appointments
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appointmentId]
    );

    // Eliminar evento de Google Calendar si existe
    if (appointment && appointment.google_event_id) {
      try {
        await googleCalendarService.deleteCalendarEvent(
          appointment.doctor_id,
          appointment.google_event_id
        );
      } catch (error) {
        console.error('Error eliminando evento de Google Calendar:', error);
        // No lanzar error
      }
    }

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// Obtener citas del día (para el dashboard)
export const getAppointmentsForToday = async (doctorId) => {
  // Primero obtener la fecha de hoy en la zona horaria del cliente
  const todayResult = await query(
    `SELECT CURRENT_DATE as today`
  );
  const today = todayResult.rows[0].today;

  console.log('📅 Buscando citas para hoy:', today);

  const result = await query(
    `SELECT
      a.*,
      p.name as patient_name,
      p.phone as patient_phone
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.doctor_id = $1
      AND a.appointment_date = $2
      AND a.status NOT IN ('cancelled', 'pending_payment')
    ORDER BY a.appointment_time ASC`,
    [doctorId, today]
  );

  console.log('  Citas encontradas:', result.rows.length);
  result.rows.forEach(apt => {
    console.log(`  - ${apt.patient_name} a las ${apt.appointment_time}`);
  });

  return result.rows;
};

// Obtener estadísticas de citas
export const getAppointmentStats = async (doctorId, startDate, endDate) => {
  const result = await query(
    `SELECT
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      AVG(delay_minutes) as average_delay
    FROM appointments
    WHERE doctor_id = $1
      AND appointment_date BETWEEN $2 AND $3`,
    [doctorId, startDate, endDate]
  );

  return result.rows[0];
};

// Actualizar posición en cola
export const updateQueuePosition = async (appointmentId, position) => {
  const result = await query(
    `UPDATE appointments
     SET queue_position = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [position, appointmentId]
  );

  return result.rows[0];
};

// Recalcular colas para un día específico
export const recalculateQueueForDate = async (doctorId, appointmentDate) => {
  try {
    await transaction(async (client) => {
      // Obtener todas las citas del día ordenadas por hora
      const appointmentsResult = await client.query(
        `SELECT id FROM appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'cancelled'
         ORDER BY appointment_time ASC`,
        [doctorId, appointmentDate]
      );

      // Actualizar posición en cola
      for (let i = 0; i < appointmentsResult.rows.length; i++) {
        await client.query(
          `UPDATE appointments SET queue_position = $1 WHERE id = $2`,
          [i + 1, appointmentsResult.rows[i].id]
        );
      }
    });

    return true;
  } catch (error) {
    console.error('Error recalculando cola:', error);
    throw error;
  }
};
