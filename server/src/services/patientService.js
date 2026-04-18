import { query } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

// Crear un paciente
export const createPatient = async (doctorId, patientData) => {
  const { email, phone, name, date_of_birth, gender, address, document_number } = patientData;

  const result = await query(
    `INSERT INTO patients (id, doctor_id, email, phone, name, date_of_birth, gender, address, document_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [uuidv4(), doctorId, email, phone, name, date_of_birth, gender, address, document_number]
  );

  return result.rows[0];
};

// Obtener todos los pacientes de un doctor con estadísticas de citas
export const getPatientsByDoctor = async (doctorId, searchQuery = '') => {
  let queryText = `
    SELECT 
      p.*,
      COUNT(a.id) as visit_count,
      MAX(a.appointment_date) as last_appointment_date
    FROM patients p
    LEFT JOIN appointments a ON p.id = a.patient_id
    WHERE p.doctor_id = $1 AND p.is_active = true
  `;

  const params = [doctorId];

  if (searchQuery) {
    queryText += ` AND (p.name ILIKE $2 OR p.email ILIKE $2 OR p.phone ILIKE $2)`;
    params.push(`%${searchQuery}%`);
  }

  queryText += ` GROUP BY p.id ORDER BY p.created_at DESC`;

  const result = await query(queryText, params);
  return result.rows;
};

// Obtener paciente por ID
export const getPatientById = async (patientId, doctorId = null) => {
  let queryText = `SELECT * FROM patients WHERE id = $1`;
  const params = [patientId];

  if (doctorId) {
    queryText += ` AND doctor_id = $2`;
    params.push(doctorId);
  }

  const result = await query(queryText, params);
  return result.rows[0];
};

// Obtener paciente con historial de citas
export const getPatientWithAppointments = async (patientId, doctorId) => {
  const patient = await query(
    `SELECT * FROM patients WHERE id = $1 AND doctor_id = $2`,
    [patientId, doctorId]
  );

  if (patient.rows.length === 0) {
    return null;
  }

  const appointments = await query(
    `SELECT * FROM appointments
     WHERE patient_id = $1 AND doctor_id = $2
     ORDER BY appointment_date DESC`,
    [patientId, doctorId]
  );

  return {
    ...patient.rows[0],
    appointments: appointments.rows
  };
};

// Actualizar paciente
export const updatePatient = async (patientId, doctorId, updateData) => {
  const { email, phone, name, date_of_birth, gender, address, medical_history, document_number } = updateData;

  const result = await query(
    `UPDATE patients
     SET email = COALESCE($1, email),
         phone = COALESCE($2, phone),
         name = COALESCE($3, name),
         date_of_birth = COALESCE($4, date_of_birth),
         gender = COALESCE($5, gender),
         address = COALESCE($6, address),
         medical_history = COALESCE($7, medical_history),
         document_number = COALESCE($10, document_number),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8 AND doctor_id = $9
     RETURNING *`,
    [email, phone, name, date_of_birth, gender, address, medical_history, patientId, doctorId, document_number]
  );

  return result.rows[0];
};

// Eliminar paciente (soft delete)
export const deletePatient = async (patientId, doctorId) => {
  const result = await query(
    `UPDATE patients
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND doctor_id = $2
     RETURNING *`,
    [patientId, doctorId]
  );

  return result.rows[0];
};

// Obtener estadísticas del paciente
export const getPatientStats = async (patientId, doctorId) => {
  const result = await query(
    `SELECT
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments
    FROM appointments
    WHERE patient_id = $1 AND doctor_id = $2`,
    [patientId, doctorId]
  );

  return result.rows[0];
};

// Buscar pacientes por nombre o contacto
export const searchPatients = async (doctorId, searchTerm) => {
  const result = await query(
    `SELECT * FROM patients
     WHERE doctor_id = $1
       AND is_active = true
       AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)
     ORDER BY name ASC
     LIMIT 20`,
    [doctorId, `%${searchTerm}%`]
  );

  return result.rows;
};

// Obtener pacientes sin citas recientes
export const getInactivePatients = async (doctorId, daysThreshold = 90) => {
  const result = await query(
    `SELECT DISTINCT p.* FROM patients p
     WHERE p.doctor_id = $1 AND p.is_active = true
       AND (
         NOT EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.patient_id = p.id
             AND a.appointment_date >= CURRENT_DATE - INTERVAL '1 day' * $2
         )
       )
     ORDER BY p.name ASC`,
    [doctorId, daysThreshold]
  );

  return result.rows;
};
