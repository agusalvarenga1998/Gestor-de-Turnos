import { query } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

// Obtener todos los planes de una obra social
export const getPlansByInsurance = async (insuranceId) => {
  const result = await query(
    `SELECT * FROM insurance_plans
     WHERE insurance_company_id = $1
     ORDER BY name ASC`,
    [insuranceId]
  );
  return result.rows;
};

// Obtener un plan por ID con el doctor_id asociado
export const getPlanById = async (planId) => {
  const result = await query(
    `SELECT ip.*, ic.doctor_id 
     FROM insurance_plans ip
     JOIN insurance_companies ic ON ip.insurance_company_id = ic.id
     WHERE ip.id = $1`,
    [planId]
  );
  return result.rows[0];
};

// Crear un nuevo plan para una obra social
export const createPlan = async (insuranceId, name, coverageType = 'fixed_amount', coverageValue = 0) => {
  const result = await query(
    `INSERT INTO insurance_plans (id, insurance_company_id, name, coverage_type, coverage_value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [uuidv4(), insuranceId, name, coverageType, coverageValue]
  );
  return result.rows[0];
};

// Actualizar un plan
export const updatePlan = async (planId, data) => {
  const { name, coverage_type, coverage_value } = data;
  const result = await query(
    `UPDATE insurance_plans
     SET name = COALESCE($1, name),
         coverage_type = COALESCE($2, coverage_type),
         coverage_value = COALESCE($3, coverage_value),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [name, coverage_type, coverage_value, planId]
  );
  return result.rows[0];
};

// Eliminar un plan
export const deletePlan = async (planId) => {
  const result = await query(
    `DELETE FROM insurance_plans
     WHERE id = $1
     RETURNING *`,
    [planId]
  );
  return result.rows[0];
};
