import { query } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

// Obtener todas las obras sociales del doctor
export const getInsurancesByDoctor = async (doctorId) => {
  const result = await query(
    `SELECT * FROM insurance_companies
     WHERE doctor_id = $1
     ORDER BY name ASC`,
    [doctorId]
  );
  return result.rows;
};

// Crear una nueva obra social
export const createInsurance = async (doctorId, name, additionalFee = 0) => {
  const result = await query(
    `INSERT INTO insurance_companies (id, doctor_id, name, additional_fee)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [uuidv4(), doctorId, name, additionalFee]
  );
  return result.rows[0];
};

// Actualizar una obra social (nombre y/o monto)
export const updateInsurance = async (id, doctorId, data) => {
  const { name, additional_fee } = data;

  const result = await query(
    `UPDATE insurance_companies
     SET name = COALESCE($1, name),
         additional_fee = COALESCE($2, additional_fee),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND doctor_id = $4
     RETURNING *`,
    [name, additional_fee, id, doctorId]
  );

  return result.rows[0];
};

// Eliminar una obra social
export const deleteInsurance = async (id, doctorId) => {
  const result = await query(
    `DELETE FROM insurance_companies
     WHERE id = $1 AND doctor_id = $2
     RETURNING *`,
    [id, doctorId]
  );

  return result.rows[0];
};

// Obtener obras sociales asignadas a un paciente
export const getPatientInsurances = async (patientId, doctorId) => {
  const result = await query(
    `SELECT ic.* FROM insurance_companies ic
     JOIN patient_insurances pi ON ic.id = pi.insurance_company_id
     WHERE pi.patient_id = $1 AND ic.doctor_id = $2
     ORDER BY ic.name ASC`,
    [patientId, doctorId]
  );
  return result.rows;
};

// Asignar obras sociales a un paciente (reemplaza las existentes)
export const setPatientInsurances = async (patientId, insuranceIds) => {
  // Si insuranceIds es null o vacío, solo eliminar
  if (!insuranceIds || insuranceIds.length === 0) {
    await query(
      `DELETE FROM patient_insurances WHERE patient_id = $1`,
      [patientId]
    );
    return [];
  }

  // Eliminar las actuales
  await query(
    `DELETE FROM patient_insurances WHERE patient_id = $1`,
    [patientId]
  );

  // Insertar las nuevas
  for (const insuranceId of insuranceIds) {
    await query(
      `INSERT INTO patient_insurances (id, patient_id, insurance_company_id)
       VALUES ($1, $2, $3)`,
      [uuidv4(), patientId, insuranceId]
    );
  }

  // Retornar las obras sociales asignadas
  const result = await query(
    `SELECT ic.* FROM insurance_companies ic
     WHERE ic.id = ANY($1)
     ORDER BY ic.name ASC`,
    [insuranceIds]
  );

  return result.rows;
};
