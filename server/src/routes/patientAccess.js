import express from 'express';
import { randomInt, createHash, randomUUID } from 'node:crypto';
import { query, transaction } from '../db/config.js';
import { recoveryLimit, loginLimit } from '../middleware/rateLimits.js';
import { requireUuid } from '../utils/validation.js';
import { signPurposeToken, readPurposeToken } from '../utils/security.js';
import { sendPatientAccessCode } from '../services/emailService.js';

const router = express.Router();
const hash = code => createHash('sha256').update(String(code)).digest('hex');
export const patientAccess = (req, doctorId, documentNumber) => {
  const token = req.headers['x-patient-access'] || req.body?.patientAccessToken;
  const access = readPurposeToken(token, 'patient-access');
  return access && access.doctorId === doctorId && (!documentNumber || access.documentNumber === documentNumber) ? access : null;
};

router.post('/request', recoveryLimit, async (req, res) => {
  try {
    const { doctorId, documentNumber, email } = req.body;
    requireUuid(doctorId);
    const patient = (await query('SELECT id,email FROM patients WHERE doctor_id=$1 AND document_number=$2 AND lower(trim(email))=$3 LIMIT 1', [doctorId, String(documentNumber || '').trim(), String(email || '').trim().toLowerCase()])).rows[0];
    const id = randomUUID();
    const code = String(randomInt(100000, 1000000));
    await query(`INSERT INTO patient_access_challenges(id,patient_id,doctor_id,code_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')`,[id,patient?.id || null,doctorId,hash(code)]);
    if (patient) sendPatientAccessCode(patient.email, code).catch(error => console.error('No se pudo enviar código de acceso:', error.message));
    res.json({ success: true, challengeId: id, message: 'Si los datos coinciden con tu ficha, recibirás un código por email. Puedes reservar igualmente completando tus datos.' });
  } catch (error) { res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'No pudimos enviar el código. Puedes reservar completando tus datos.' }); }
});
router.post('/verify', loginLimit, async (req, res) => {
  try {
    const { challengeId, code } = req.body;
    requireUuid(challengeId);
    const access = await transaction(async client => {
      const row = (await client.query('SELECT * FROM patient_access_challenges WHERE id=$1 FOR UPDATE',[challengeId])).rows[0];
      if (!row || row.consumed_at || row.attempts >= 5 || new Date(row.expires_at) < new Date()) return null;
      await client.query('UPDATE patient_access_challenges SET attempts=attempts+1 WHERE id=$1',[challengeId]);
      if (!row.patient_id || row.code_hash !== hash(code)) return null;
      await client.query('UPDATE patient_access_challenges SET consumed_at=now() WHERE id=$1',[challengeId]);
      return (await client.query('SELECT id,doctor_id,document_number FROM patients WHERE id=$1',[row.patient_id])).rows[0];
    });
    if (!access) return res.status(400).json({ success: false, message: 'El código es incorrecto o venció. Solicita uno nuevo si es necesario.' });
    res.json({ success: true, accessToken: signPurposeToken({ patientId: access.id, doctorId: access.doctor_id, documentNumber: access.document_number }, 'patient-access', '30m') });
  } catch { res.status(400).json({ success: false, message: 'No pudimos verificar el código.' }); }
});
export default router;
