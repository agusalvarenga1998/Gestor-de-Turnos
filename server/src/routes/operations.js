import express from 'express';
import { readFile } from 'node:fs/promises';
import { query, transaction } from '../db/config.js';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import { verifyAdmin } from '../middleware/adminAuth.js';
import { requireUuid, calendarDate, httpError, localDate } from '../utils/validation.js';
import { notifyWaitlistForSlot } from '../services/waitlistService.js';
import { reconcileAppointmentPayment, reconcileSubscriptionPayment } from '../services/reconciliationService.js';

const router = express.Router();
router.use((req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const fail = (res, error) => res.status(error.status || (error.code === '23505' ? 409 : 503)).json({ success: false, message: error.status ? error.message : error.code === '23505' ? 'El paciente ya está en espera para ese servicio.' : 'No pudimos completar la operación. Reintentá.' });
const currentAppointmentContext = `(appointment_id IS NULL OR EXISTS(SELECT 1 FROM appointments a WHERE a.id=email_outbox.appointment_id
  AND a.appointment_date::text=email_outbox.appointment_context->>'date'
  AND a.appointment_time::text=email_outbox.appointment_context->>'time'
  AND a.status=email_outbox.appointment_context->>'status'))`;
async function notifications(req, res) {
  try {
    const jobs = (await query(`SELECT id,doctor_id,category,recipient_hint,status,attempts,manual_retries,error_code,created_at,finished_at,
      (payload IS NOT NULL AND expires_at>now() AND status IN ('failed','pending') AND manual_retries<3 AND ${currentAppointmentContext}) AS can_retry
      FROM email_outbox WHERE ($1::uuid IS NULL OR doctor_id=$1) ORDER BY created_at DESC LIMIT 200`, [req.admin ? null : req.user.id])).rows;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, jobs, workerEnabled: process.env.EMAIL_WORKER_ENABLED !== 'false' });
  } catch (error) { fail(res, error); }
}
async function retryNotification(req, res) {
  try {
    requireUuid(req.params.id);
    await transaction(async () => {
      const result = await query(`UPDATE email_outbox SET status='pending',attempts=0,manual_retries=manual_retries+1,available_at=now(),finished_at=NULL,error_code=NULL
        WHERE id=$1 AND ($2::uuid IS NULL OR doctor_id=$2) AND status IN ('failed','pending') AND payload IS NOT NULL
        AND expires_at>now() AND manual_retries<3 AND ${currentAppointmentContext} RETURNING doctor_id`, [req.params.id, req.admin ? null : req.user.id]);
      if (!result.rowCount) throw httpError('El aviso no admite reintento: ya se envió, venció, está en proceso o agotó sus reintentos.', 409);
      if (result.rows[0].doctor_id) await query('INSERT INTO audit_logs(doctor_id,action,details) VALUES($1,$2,$3)', [result.rows[0].doctor_id, 'notification_retry', JSON.stringify({ notificationId: req.params.id, adminId: req.admin?.id || null })]);
    });
    res.json({ success: true, message: 'Aviso en cola para reintentar.' });
  } catch (error) { fail(res, error); }
}
router.get('/admin/notifications', verifyAdmin, notifications);
router.post('/admin/notifications/:id/retry', verifyAdmin, retryNotification);
router.get('/admin/reconciliation', verifyAdmin, async (req, res) => {
  try {
    const items = (await query(`SELECT s.id,s.created_at,s.created_at::date AS appointment_date,'00:00' AS appointment_time,s.status,
      CASE WHEN s.status='approved' THEN 'paid' ELSE 'pending' END AS payment_status,s.amount AS total_amount,
      d.name AS patient_name,0 AS recorded_refunds,c.outcome,c.provider_status,c.refunded_amount,c.checked_at
      FROM subscriptions s JOIN doctors d ON d.id=s.doctor_id LEFT JOIN LATERAL
      (SELECT outcome,provider_status,refunded_amount,checked_at FROM payment_checks WHERE subscription_id=s.id ORDER BY checked_at DESC LIMIT 1) c ON true
      WHERE s.pricing_plan_id IS NOT NULL AND s.amount>0 ORDER BY (s.status='pending') DESC,s.created_at DESC LIMIT 200`)).rows;
    res.json({ success: true, items });
  } catch (error) { fail(res, error); }
});
router.post('/admin/reconciliation/:id/check', verifyAdmin, async (req, res) => {
  try { res.json({ success: true, ...await reconcileSubscriptionPayment(req.params.id) }); } catch (error) { fail(res, error); }
});
router.get('/admin/backups', verifyAdmin, async (req, res) => {
  try {
    if (!process.env.BACKUP_STATUS_FILE) return res.json({ success: true, status: { configured: false, message: 'Configurá el respaldo cifrado y su verificación de restauración.' } });
    const report = JSON.parse(await readFile(process.env.BACKUP_STATUS_FILE, 'utf8'));
    res.json({ success: true, status: { configured: true, createdAt: report.createdAt, verifiedAt: report.verifiedAt || null, databaseRestoreVerified: report.databaseRestoreVerified === true, attachmentsVerified: report.attachmentsVerified === true, lastAttemptFailed: report.lastAttemptFailed === true, stale: !Number.isFinite(Date.parse(report.createdAt)) || Date.now() - Date.parse(report.createdAt) > 36 * 3600000 } });
  } catch { res.status(503).json({ success: false, message: 'No pudimos leer el estado del respaldo.' }); }
});

router.use(verifyToken, verifyDoctorRole);
router.get('/notifications', notifications);
router.post('/notifications/:id/retry', retryNotification);
router.get('/summary', async (req, res) => {
  try {
    const day = localDate();
    const summary = (await query(`SELECT
      count(*) FILTER(WHERE status='pending')::integer AS awaiting_confirmation,
      count(*) FILTER(WHERE status='pending_payment')::integer AS awaiting_payment,
      count(*) FILTER(WHERE status='scheduled' AND appointment_date=$2)::integer AS scheduled_today,
      count(*) FILTER(WHERE status='scheduled' AND (appointment_date::text||'T'||appointment_time::text||'-03:00')::timestamptz+make_interval(mins=>COALESCE(duration_minutes,30))<now())::integer AS awaiting_closure,
      COALESCE(sum(GREATEST(COALESCE(total_price,0)-COALESCE(booking_fee_paid,0)-COALESCE(coverage_amount,0),0)) FILTER(WHERE status IN ('scheduled','completed') AND payment_status IS DISTINCT FROM 'paid'),0) AS outstanding
      FROM appointments WHERE doctor_id=$1`, [req.user.id, day])).rows[0];
    const notifications = (await query("SELECT count(*)::integer AS failed FROM email_outbox WHERE doctor_id=$1 AND status IN ('failed','expired')", [req.user.id])).rows[0];
    const waiting = (await query("SELECT count(*)::integer AS waiting FROM appointment_waitlist WHERE doctor_id=$1 AND status='waiting' AND date_to>=CURRENT_DATE", [req.user.id])).rows[0];
    const queue = (await query("SELECT count(*)::integer AS waiting_now FROM waiting_queue WHERE doctor_id=$1 AND queue_day=$2 AND status='waiting'", [req.user.id, day])).rows[0];
    const nextAppointments = (await query(`SELECT a.id,a.appointment_date,a.appointment_time,p.name AS patient_name FROM appointments a JOIN patients p ON p.id=a.patient_id
      WHERE a.doctor_id=$1 AND a.status='scheduled' AND (a.appointment_date::text||'T'||a.appointment_time::text||'-03:00')::timestamptz>=now()
      ORDER BY a.appointment_date,a.appointment_time LIMIT 5`, [req.user.id])).rows;
    res.json({ success: true, summary: { ...summary, ...notifications, ...waiting, ...queue, nextAppointments } });
  } catch (error) { fail(res, error); }
});
router.get('/waitlist', async (req, res) => {
  try {
    const entries = (await query(`SELECT w.id,w.patient_id,w.service_id,w.date_from,w.date_to,w.status,w.created_at,p.name AS patient_name,s.name AS service_name,
      (SELECT max(created_at) FROM waitlist_offers WHERE waitlist_id=w.id) AS last_notified_at
      FROM appointment_waitlist w JOIN patients p ON p.id=w.patient_id LEFT JOIN services s ON s.id::text=w.service_id AND s.doctor_id=w.doctor_id
      WHERE w.doctor_id=$1 ORDER BY (w.status='waiting') DESC,w.created_at DESC LIMIT 200`, [req.user.id])).rows;
    res.json({ success: true, entries });
  } catch (error) { fail(res, error); }
});
router.get('/waitlist/options', async (req, res) => {
  try { res.json({ success: true, patients: (await query('SELECT id,name FROM patients WHERE doctor_id=$1 AND is_active=true ORDER BY name', [req.user.id])).rows, services: (await query('SELECT id,name FROM services WHERE doctor_id=$1 ORDER BY name', [req.user.id])).rows }); } catch (error) { fail(res, error); }
});
router.post('/waitlist', async (req, res) => {
  try {
    const { patientId, serviceId, dateFrom, dateTo, consent } = req.body;
    requireUuid(patientId); calendarDate(dateFrom); calendarDate(dateTo);
    if (dateFrom < localDate() || dateTo < dateFrom || consent !== true) throw httpError('Elegí fechas vigentes y confirmá que el paciente pidió recibir el aviso.');
    const patient = (await query('SELECT id,email FROM patients WHERE id=$1 AND doctor_id=$2 AND is_active=true', [patientId, req.user.id])).rows[0];
    if (!patient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email || '')) throw httpError('El paciente debe pertenecer al consultorio y tener un email válido.');
    if (serviceId && !(await query('SELECT id FROM services WHERE id::text=$1 AND doctor_id=$2', [String(serviceId), req.user.id])).rowCount) throw httpError('Servicio no disponible.');
    await query('INSERT INTO appointment_waitlist(doctor_id,patient_id,service_id,date_from,date_to,consent_at) VALUES($1,$2,$3,$4,$5,now())', [req.user.id, patientId, serviceId ? String(serviceId) : null, dateFrom, dateTo]);
    res.status(201).json({ success: true });
  } catch (error) { fail(res, error); }
});
router.patch('/waitlist/:id', async (req, res) => {
  try {
    requireUuid(req.params.id);
    if (!['booked','cancelled'].includes(req.body.status)) throw httpError('Elegí reservado o cancelado.');
    if (!(await query("UPDATE appointment_waitlist SET status=$3 WHERE id=$1 AND doctor_id=$2 AND status='waiting' RETURNING id", [req.params.id, req.user.id, req.body.status])).rowCount) throw httpError('Registro no encontrado o ya cerrado.', 404);
    res.json({ success: true });
  } catch (error) { fail(res, error); }
});
router.post('/waitlist/notify-slot', async (req, res) => {
  try {
    calendarDate(req.body.date);
    if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(req.body.time || '')) throw httpError('Horario inválido.');
    const count = await notifyWaitlistForSlot({ doctor_id: req.user.id, appointment_date: req.body.date, appointment_time: req.body.time, service_id: req.body.serviceId || null });
    res.json({ success: true, count });
  } catch (error) { fail(res, error); }
});
router.get('/reconciliation', async (req, res) => {
  try {
    const items = (await query(`SELECT a.id,a.appointment_date,a.appointment_time,a.status,a.payment_status,a.total_amount,a.booking_fee_paid,
      p.name AS patient_name,
      (SELECT count(*)::integer FROM movements m WHERE m.appointment_id=a.id AND m.type='reembolso') AS recorded_refunds,
      c.outcome,c.provider_status,c.refunded_amount,c.checked_at
      FROM appointments a JOIN patients p ON p.id=a.patient_id LEFT JOIN LATERAL
      (SELECT outcome,provider_status,refunded_amount,checked_at FROM payment_checks WHERE appointment_id=a.id ORDER BY checked_at DESC LIMIT 1) c ON true
      WHERE a.doctor_id=$1 AND (a.status='pending_payment' OR a.booking_fee_paid>0 OR EXISTS(SELECT 1 FROM payment_receipts r WHERE r.reference_id=a.id AND r.kind='appointment'))
      ORDER BY (a.status='pending_payment') DESC,a.created_at DESC LIMIT 200`, [req.user.id])).rows;
    res.json({ success: true, items });
  } catch (error) { fail(res, error); }
});
router.post('/reconciliation/:id/check', async (req, res) => {
  try { res.json({ success: true, ...await reconcileAppointmentPayment(req.user.id, req.params.id) }); } catch (error) { fail(res, error); }
});
export default router;
