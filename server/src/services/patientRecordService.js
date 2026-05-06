import { query } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

export const createRecord = async (doctorId, patientId, recordData) => {
  const { type, title, content, file_path, file_name, file_type, file_size } = recordData;

  const result = await query(
    `INSERT INTO patient_records (id, doctor_id, patient_id, type, title, content, file_path, file_name, file_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [uuidv4(), doctorId, patientId, type, title, content, file_path, file_name, file_type, file_size]
  );

  return result.rows[0];
};

export const getRecordsByPatient = async (doctorId, patientId) => {
  const result = await query(
    `SELECT * FROM patient_records 
     WHERE doctor_id = $1 AND patient_id = $2 
     ORDER BY created_at DESC`,
    [doctorId, patientId]
  );

  return result.rows;
};

export const deleteRecord = async (doctorId, recordId) => {
  const result = await query(
    `DELETE FROM patient_records WHERE id = $1 AND doctor_id = $2 RETURNING *`,
    [recordId, doctorId]
  );

  return result.rows[0];
};
