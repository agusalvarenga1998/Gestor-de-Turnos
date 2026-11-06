import axios from 'axios';
import { query } from '../db/config.js';
import { httpError, requireUuid, finiteAmount } from '../utils/validation.js';
import { applyApprovedPayment } from './paymentService.js';

export async function reconcileAppointmentPayment(doctorId, appointmentId) {
  requireUuid(appointmentId);
  const appointment = (await query(`SELECT a.id,a.status,a.total_amount,d.mp_access_token FROM appointments a
    JOIN doctors d ON d.id=a.doctor_id WHERE a.id=$1 AND a.doctor_id=$2`, [appointmentId, doctorId])).rows[0];
  if (!appointment) throw httpError('Turno no encontrado.', 404);
  return reconcilePayment(doctorId, appointmentId, appointment, 'appointment');
}

export async function reconcileSubscriptionPayment(subscriptionId) {
  requireUuid(subscriptionId);
  const subscription = (await query(`SELECT s.id,s.doctor_id,s.status,s.amount AS total_amount,
    COALESCE((SELECT mp_access_token FROM admins WHERE mp_connected=true LIMIT 1),$2) AS mp_access_token
    FROM subscriptions s WHERE s.id=$1`, [subscriptionId, process.env.MP_ACCESS_TOKEN || null])).rows[0];
  if (!subscription) throw httpError('Solicitud no encontrada.', 404);
  return reconcilePayment(subscription.doctor_id, subscriptionId, subscription, 'subscription');
}

async function reconcilePayment(doctorId, appointmentId, appointment, kind) {
  if (!appointment.mp_access_token) throw httpError('Vinculá Mercado Pago para consultar los pagos.', 409);
  const options = { timeout: 10000, headers: { Authorization: `Bearer ${appointment.mp_access_token}` } };
  const response = await axios.get('https://api.mercadopago.com/v1/payments/search', { ...options, params: { external_reference: appointmentId, limit: 20, sort: 'date_created', criteria: 'desc' } });
  const payments = (response.data.results || []).filter(payment => payment.external_reference === appointmentId && payment.currency_id === 'ARS' && Number(payment.transaction_amount) === Number(appointment.total_amount));
  const results = [];
  for (const payment of payments) {
    let outcome = 'pending';
    if (['charged_back', 'in_mediation'].includes(payment.status)) outcome = 'needs_review';
    let refundedAmount = 0;
    if (['approved', 'refunded'].includes(payment.status)) {
      const refunds = await axios.get(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment.id)}/refunds`, options);
      if (!Array.isArray(refunds.data)) throw httpError('No pudimos confirmar las devoluciones del proveedor.', 503);
      refundedAmount = Math.round(refunds.data.filter(refund => refund.status === 'approved').reduce((sum, refund) => sum + finiteAmount(refund.amount), 0) * 100) / 100;
      if (payment.status === 'refunded') refundedAmount = finiteAmount(payment.transaction_amount);
      if (refundedAmount > 0 || payment.status === 'refunded') outcome = refundedAmount >= Number(payment.transaction_amount) ? 'refund_confirmed' : 'partial_refund_confirmed';
      else if (['cancelled','rejected','expired','absent'].includes(appointment.status)) outcome = 'needs_review';
      else {
        try {
          const applied = await applyApprovedPayment(payment, appointmentId, kind);
          outcome = applied.applied ? 'applied' : 'already_applied';
        } catch (error) { if (error.status === 409) outcome = 'needs_review'; else throw error; }
      }
    }
    await query(`INSERT INTO payment_checks(doctor_id,appointment_id,payment_id,provider_status,refunded_amount,outcome,subscription_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [doctorId, kind === 'appointment' ? appointmentId : null, String(payment.id), payment.status, refundedAmount, outcome, kind === 'subscription' ? appointmentId : null]);
    results.push({ paymentId: String(payment.id), providerStatus: payment.status, refundedAmount, outcome });
  }
  return { results, message: results.length ? 'Consulta completada. Las devoluciones se consultan; esta acción no devuelve dinero.' : 'No se encontraron pagos que coincidan con el turno, importe y moneda.' };
}
