import { query, transaction, afterCommit } from '../db/config.js';
import { validateApprovedPayment } from '../utils/paymentValidation.js';
import { httpError, requireUuid } from '../utils/validation.js';
import { notifyDoctor } from '../websocket/server.js';
import { sendAppointmentConfirmation, sendNewAppointmentNotificationToDoctor } from './emailService.js';

export async function applyApprovedPayment(payment, referenceId, kind) {
  requireUuid(referenceId);
  if (!['appointment', 'subscription'].includes(kind) || !payment.id) throw httpError('Pago inválido.');
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['payment:' + String(payment.id)]);
    const previous = (await client.query('SELECT reference_id,kind FROM payment_receipts WHERE payment_id=$1', [String(payment.id)])).rows[0];
    if (previous) {
      if (previous.reference_id !== referenceId || previous.kind !== kind) throw httpError('Pago ya asignado a otra operación.', 409);
      return { applied: false, duplicate: true };
    }
    const table = kind === 'appointment' ? 'appointments' : 'subscriptions';
    const row = (await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [referenceId])).rows[0];
    if (!row) throw httpError('Operación no encontrada.', 404);
    validateApprovedPayment(payment, referenceId, kind === 'appointment' ? row.total_amount : row.amount);
    if (row.status !== (kind === 'appointment' ? 'pending_payment' : 'pending')) {
      if (row.payment_status === 'paid' || row.status === 'approved') return { applied: false, duplicate: true };
      throw httpError('La operación ya no está pendiente. Requiere revisión.', 409);
    }
    await client.query('INSERT INTO payment_receipts(payment_id,reference_id,kind,amount,currency) VALUES($1,$2,$3,$4,$5)', [String(payment.id), referenceId, kind, payment.transaction_amount, payment.currency_id]);
    if (kind === 'subscription') {
      const plan = (await client.query('SELECT key FROM pricing_plans WHERE id=$1', [row.pricing_plan_id])).rows[0];
      if (!plan) throw httpError('Plan no disponible.', 409);
      const updated = await client.query(`UPDATE doctors SET subscription_status='active', subscription_expires_at=GREATEST(COALESCE(subscription_expires_at,now()),now())+interval '30 days', pricing_plan_id=$2,plan_type=$3 WHERE id=$1 RETURNING subscription_expires_at`, [row.doctor_id, row.pricing_plan_id, plan.key === 'commission' ? 'commission' : 'monthly']);
      await client.query("UPDATE subscriptions SET status='approved',mp_payment_id=$2,period_start=now(),period_end=$3 WHERE id=$1", [referenceId, String(payment.id), updated.rows[0].subscription_expires_at]);
    } else {
      await client.query("UPDATE appointments SET status='pending',payment_status=CASE WHEN GREATEST(total_amount-COALESCE(system_fee,0),0) >= COALESCE(total_price,0)-COALESCE(coverage_amount,0) THEN 'paid' ELSE 'partial' END,booking_fee_paid=GREATEST(total_amount-COALESCE(system_fee,0),0),fee_charged=true,updated_at=now() WHERE id=$1", [referenceId]);
      afterCommit(async () => {
        notifyDoctor(row.doctor_id, { appointmentId: referenceId, message: 'Pago recibido. Turno pendiente de aprobación.' });
        const info = (await query(`SELECT d.name as doctor_name,d.email as doctor_email,p.name,p.email FROM doctors d JOIN patients p ON p.id=$2 WHERE d.id=$1`, [row.doctor_id, row.patient_id])).rows[0];
        if (!info) return;
        await Promise.allSettled([
          sendNewAppointmentNotificationToDoctor({ to: info.doctor_email, doctorName: info.doctor_name, patientName: info.name, appointmentDate: row.appointment_date, appointmentTime: row.appointment_time, dashboardUrl: `${process.env.FRONTEND_URL}/appointments` }),
          sendAppointmentConfirmation({ to: info.email, patientName: info.name, doctorName: info.doctor_name, appointmentDate: row.appointment_date, appointmentTime: row.appointment_time, appointmentCode: row.appointment_code, confirmUrl: `${process.env.FRONTEND_URL}/patient/appointment/${row.portal_token}`, status: 'pending' })
        ]);
      });
    }
    return { applied: true };
  });
}
