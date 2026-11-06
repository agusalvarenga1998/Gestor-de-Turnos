import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../db/config.js';
import { verifyReception } from '../middleware/receptionAuth.js';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import { loginLimit } from '../middleware/rateLimits.js';
import { jwtSecret, validPassword } from '../utils/security.js';
import { calendarDate, requireUuid, httpError, finiteAmount } from '../utils/validation.js';
import { createAppointment } from '../controllers/appointmentController.js';
import { transactionalRoute } from '../middleware/transactionalRoute.js';

const router = express.Router();
const fail = (res, error) => res.status(error.status || (error.code === '23505' ? 409 : 503)).json({ success: false, message: error.status ? error.message : error.code === '23505' ? 'Ese correo ya tiene una cuenta de recepción.' : 'No se pudo completar la operación. Reintentá.' });
const audit = (account, action, details) => query('INSERT INTO audit_logs(doctor_id,action,details) VALUES($1,$2,$3)', [account.doctor_id, action, JSON.stringify({ receptionId: account.id, ...details })]);

// Solo el profesional titular administra los accesos; un token de recepción no pasa verifyToken.
router.get('/accounts', verifyToken, verifyDoctorRole, async (req, res) => {
  try { res.json({ success: true, accounts: (await query('SELECT id,name,email,is_active,created_at FROM reception_accounts WHERE doctor_id=$1 ORDER BY created_at DESC', [req.user.id])).rows }); } catch (error) { fail(res, error); }
});
router.post('/accounts', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || !validPassword(password)) throw httpError('Ingresá nombre, email válido y contraseña de entre 10 y 72 bytes.');
    const hash = await bcrypt.hash(password, 12);
    const account = await transaction(async () => {
      const row = (await query('INSERT INTO reception_accounts(doctor_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,is_active', [req.user.id, name.trim(), email.trim().toLowerCase(), hash])).rows[0];
      await audit({ id: row.id, doctor_id: req.user.id }, 'reception_account_created', {});
      return row;
    });
    res.status(201).json({ success: true, account });
  } catch (error) { fail(res, error); }
});
router.patch('/accounts/:id', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    requireUuid(req.params.id);
    const { is_active, password } = req.body;
    if (typeof is_active !== 'boolean' && !validPassword(password)) throw httpError('Indicá el estado del acceso o una contraseña válida.');
    if (password !== undefined && !validPassword(password)) throw httpError('La contraseña debe tener entre 10 y 72 bytes.');
    const hash = password === undefined ? null : await bcrypt.hash(password, 12);
    await transaction(async () => {
      const result = await query('UPDATE reception_accounts SET is_active=COALESCE($3,is_active),password_hash=COALESCE($4,password_hash),token_version=token_version+1 WHERE id=$1 AND doctor_id=$2 RETURNING id', [req.params.id, req.user.id, typeof is_active === 'boolean' ? is_active : null, hash]);
      if (!result.rowCount) throw httpError('Acceso no encontrado.', 404);
      await audit({ id: req.params.id, doctor_id: req.user.id }, 'reception_access_updated', { passwordChanged: !!hash, is_active });
    });
    res.json({ success: true });
  } catch (error) { fail(res, error); }
});

router.post('/login', loginLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 72) throw httpError('Ingresá tu email y contraseña.');
    const account = (await query('SELECT id,doctor_id,password_hash,is_active,token_version FROM reception_accounts WHERE lower(email)=$1', [email.trim().toLowerCase()])).rows[0];
    if (!account || !await bcrypt.compare(password, account.password_hash) || !account.is_active) throw httpError('Email o contraseña incorrectos, o acceso desactivado.', 401);
    const token = jwt.sign({ id: account.id, doctor_id: account.doctor_id, role: 'reception', token_version: account.token_version }, jwtSecret, { expiresIn: '8h' });
    await audit(account, 'reception_login', {});
    res.json({ success: true, token });
  } catch (error) { fail(res, error); }
});

router.use(verifyReception);
router.get('/session', (req, res) => res.json({ success: true, name: req.reception.name, doctorName: req.reception.doctor_name }));
router.post('/logout', async (req, res) => {
  try { await query('UPDATE reception_accounts SET token_version=token_version+1 WHERE id=$1', [req.reception.id]); res.json({ success: true }); } catch (error) { fail(res, error); }
});
router.get('/appointments', async (req, res) => {
  try {
    calendarDate(req.query.date);
    res.setHeader('Cache-Control', 'private, no-store');
    const appointments = (await query(`SELECT a.id,a.appointment_date,a.appointment_time,a.duration_minutes,a.status,a.payment_status,
      a.total_price,a.booking_fee_paid,a.coverage_amount,p.name AS patient_name,p.phone AS patient_phone,s.name AS service_name
      FROM appointments a JOIN patients p ON p.id=a.patient_id LEFT JOIN services s ON s.id=a.service_id
      WHERE a.doctor_id=$1 AND a.appointment_date=$2 ORDER BY a.appointment_time`, [req.user.id, req.query.date])).rows;
    res.json({ success: true, appointments });
  } catch (error) { fail(res, error); }
});
router.get('/booking-data', async (req, res) => {
  try {
    const patients = (await query('SELECT id,name,phone FROM patients WHERE doctor_id=$1 AND is_active=true ORDER BY name', [req.user.id])).rows;
    const services = (await query('SELECT id,name,duration_minutes,price FROM services WHERE doctor_id=$1 ORDER BY name', [req.user.id])).rows;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, patients, services });
  } catch (error) { fail(res, error); }
});
router.post('/appointments', (req, res, next) => {
  const { patientId, serviceId, appointment_date, appointment_time } = req.body;
  if (!serviceId) return res.status(400).json({ success: false, message: 'Seleccioná un servicio.' });
  req.body = { patientId, serviceId, appointment_date, appointment_time };
  const originalJson = res.json;
  res.json = function (payload) { return originalJson.call(this, payload.appointment ? { success: payload.success, message: payload.message, appointment: { id: payload.appointment.id } } : payload); };
  next();
}, transactionalRoute(async (req, res, next) => {
  await createAppointment(req, res, next);
  if (res.statusCode < 400) await audit(req.reception, 'reception_booked_appointment', { patientId: req.body.patientId, date: req.body.appointment_date, time: req.body.appointment_time });
}));
router.post('/appointments/:id/collect', async (req, res) => {
  try {
    requireUuid(req.params.id);
    const receivedAmount = finiteAmount(req.body.amount, { min: 0.01 });
    if (!['efectivo', 'transferencia'].includes(req.body.method)) throw httpError('Seleccioná efectivo o transferencia. Los pagos online se verifican automáticamente.');
    await transaction(async () => {
      const appointment = (await query('SELECT id,status,payment_status,total_price,booking_fee_paid,coverage_amount FROM appointments WHERE id=$1 AND doctor_id=$2 FOR UPDATE', [req.params.id, req.user.id])).rows[0];
      if (!appointment) throw httpError('Turno no encontrado.', 404);
      if (!['scheduled', 'completed'].includes(appointment.status)) throw httpError('Solo se cobran turnos confirmados o finalizados.', 409);
      if (appointment.payment_status === 'paid') return;
      const balance = Math.round(Math.max(0, Number(appointment.total_price || 0) - Number(appointment.booking_fee_paid || 0) - Number(appointment.coverage_amount || 0)) * 100) / 100;
      if (balance !== receivedAmount) throw httpError('El saldo cambió. Actualizá la agenda antes de registrar el cobro.', 409);
      await query("UPDATE appointments SET payment_status='paid',settlement_method=$3,updated_at=now() WHERE id=$1 AND doctor_id=$2", [req.params.id, req.user.id, req.body.method]);
      await audit(req.reception, 'reception_collected_payment', { appointmentId: req.params.id, method: req.body.method, amount: receivedAmount });
    });
    res.json({ success: true, message: 'Cobro registrado.' });
  } catch (error) { fail(res, error); }
});

export default router;
