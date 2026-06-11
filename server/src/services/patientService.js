import { query } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

// Crear un paciente
export const createPatient = async (doctorId, patientData) => {
  const { 
    email, phone, name, date_of_birth, gender, address, document_number,
    document_type, locality, province, insurance_company_id, insurance_plan_id, insurance_policy_number 
  } = patientData;

  const result = await query(
    `INSERT INTO patients (
       id, doctor_id, email, phone, name, date_of_birth, gender, address, document_number,
       document_type, locality, province, insurance_company_id, insurance_plan_id, insurance_policy_number
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      uuidv4(), 
      doctorId, 
      email || null, 
      phone || null, 
      name, 
      date_of_birth || null, 
      gender || null, 
      address || null, 
      document_number,
      document_type || 'DNI', 
      locality || null, 
      province || null, 
      insurance_company_id || null, 
      insurance_plan_id || null, 
      insurance_policy_number || null
    ]
  );

  return result.rows[0];
};

// Obtener todos los pacientes de un doctor con estadísticas de citas
export const getPatientsByDoctor = async (doctorId, searchQuery = '') => {
  let queryText = `
    SELECT 
      p.*,
      ic.name as insurance_company_name,
      ip.name as insurance_plan_name,
      COUNT(a.id) as visit_count,
      MAX(a.appointment_date) as last_appointment_date
    FROM patients p
    LEFT JOIN insurance_companies ic ON p.insurance_company_id = ic.id
    LEFT JOIN insurance_plans ip ON p.insurance_plan_id = ip.id
    LEFT JOIN appointments a ON p.id = a.patient_id
    WHERE p.doctor_id = $1 AND p.is_active = true
  `;

  const params = [doctorId];

  if (searchQuery) {
    queryText += ` AND (p.name ILIKE $2 OR p.email ILIKE $2 OR p.phone ILIKE $2)`;
    params.push(`%${searchQuery}%`);
  }

  queryText += ` GROUP BY p.id, ic.name, ip.name ORDER BY p.created_at DESC`;

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
  const existing = await getPatientById(patientId, doctorId);
  if (!existing) return null;

  const { 
    email, phone, name, date_of_birth, gender, address, medical_history, document_number,
    document_type, locality, province, insurance_company_id, insurance_plan_id, insurance_policy_number 
  } = updateData;

  const emailVal = email !== undefined ? email : existing.email;
  const phoneVal = phone !== undefined ? phone : existing.phone;
  const nameVal = name !== undefined ? name : existing.name;
  const dobVal = date_of_birth !== undefined ? date_of_birth : existing.date_of_birth;
  const genderVal = gender !== undefined ? gender : existing.gender;
  const addressVal = address !== undefined ? address : existing.address;
  const medVal = medical_history !== undefined ? medical_history : existing.medical_history;
  const docNumVal = document_number !== undefined ? document_number : existing.document_number;
  const docTypeVal = document_type !== undefined ? document_type : existing.document_type;
  const localityVal = locality !== undefined ? locality : existing.locality;
  const provinceVal = province !== undefined ? province : existing.province;
  const insCompanyVal = insurance_company_id !== undefined ? insurance_company_id : existing.insurance_company_id;
  const insPlanVal = insurance_plan_id !== undefined ? insurance_plan_id : existing.insurance_plan_id;
  const insPolicyVal = insurance_policy_number !== undefined ? insurance_policy_number : existing.insurance_policy_number;

  const result = await query(
    `UPDATE patients
     SET email = $1,
         phone = $2,
         name = $3,
         date_of_birth = $4,
         gender = $5,
         address = $6,
         medical_history = $7,
         document_number = $8,
         document_type = $9,
         locality = $10,
         province = $11,
         insurance_company_id = $12,
         insurance_plan_id = $13,
         insurance_policy_number = $14,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $15 AND doctor_id = $16
     RETURNING *`,
    [
      emailVal, 
      phoneVal, 
      nameVal, 
      dobVal || null, 
      genderVal || null, 
      addressVal || null, 
      medVal || null, 
      docNumVal, 
      docTypeVal || 'DNI',
      localityVal || null,
      provinceVal || null,
      insCompanyVal || null,
      insPlanVal || null,
      insPolicyVal || null,
      patientId,
      doctorId
    ]
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
