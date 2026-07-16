import { query } from '../db/config.js';

/**
 * Registra una acción de auditoría en la base de datos de manera asíncrona.
 * 
 * @param {string} doctorId - ID del profesional
 * @param {string} action - Nombre de la acción ('login', 'change_appointment', etc.)
 * @param {string|object} details - Detalles de la acción o payload
 * @param {string} ipAddress - IP de la petición
 */
export const logAction = async (doctorId, action, details = '', ipAddress = '') => {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    
    await query(
      `INSERT INTO audit_logs (doctor_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [doctorId, action, detailsStr, ipAddress || null]
    );
  } catch (error) {
    console.error('❌ Error al registrar log de auditoría:', error.message);
  }
};
