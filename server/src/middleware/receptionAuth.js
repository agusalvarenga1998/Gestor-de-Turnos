import jwt from 'jsonwebtoken';
import { jwtSecret } from '../utils/security.js';
import { query } from '../db/config.js';

export async function verifyReception(req, res, next) {
  let decoded;
  try {
    decoded = jwt.verify(req.headers.authorization?.split(' ')[1], jwtSecret);
    if (decoded.role !== 'reception' || decoded.purpose) throw new Error('Reception session required');
  } catch { return res.status(401).json({ success: false, message: 'Iniciá sesión en recepción.' }); }
  try {
    const account = (await query(`SELECT r.id,r.doctor_id,r.name,r.is_active,r.token_version,d.status,
      d.subscription_status,d.subscription_expires_at,d.trial_ends_at,d.name AS doctor_name
      FROM reception_accounts r JOIN doctors d ON d.id=r.doctor_id WHERE r.id=$1`, [decoded.id])).rows[0];
    if (!account || !account.is_active || account.token_version !== decoded.token_version || account.doctor_id !== decoded.doctor_id) return res.status(401).json({ success: false, message: 'El acceso fue revocado. Contactá al profesional.' });
    const expiration = account.subscription_status === 'trial' ? account.trial_ends_at : account.subscription_expires_at;
    if (account.status !== 'approved' || !['trial', 'active'].includes(account.subscription_status) || (expiration && Date.parse(expiration) <= Date.now())) return res.status(403).json({ success: false, message: 'El profesional debe habilitar o renovar su cuenta.' });
    req.reception = account;
    req.user = { id: account.doctor_id, role: 'reception', receptionId: account.id };
    next();
  } catch { res.status(503).json({ success: false, message: 'No pudimos verificar tu acceso. Reintentá.' }); }
}
