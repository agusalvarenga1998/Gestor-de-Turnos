import express from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { query } from '../db/config.js';
import { validPaymentSignature } from '../utils/paymentValidation.js';
import { requireUuid } from '../utils/validation.js';
import { applyApprovedPayment } from '../services/paymentService.js';
const router = express.Router();
router.post('/mercadopago', async (req, res) => {
  if (!process.env.MP_WEBHOOK_SECRET) return res.sendStatus(503);
  const paymentId = req.query['data.id'];
  if (!validPaymentSignature({ signature: req.get('x-signature'), requestId: req.get('x-request-id'), dataId: paymentId, secret: process.env.MP_WEBHOOK_SECRET }) || String(req.body.data?.id) !== String(paymentId)) return res.sendStatus(401);
  if (req.body.type !== 'payment') return res.sendStatus(200);
  try {
    const { appointmentId, subscriptionId } = req.query;
    if (Boolean(appointmentId) === Boolean(subscriptionId)) return res.sendStatus(400);
    const referenceId = requireUuid(appointmentId || subscriptionId);
    let accessToken;
    if (appointmentId) {
      accessToken = (await query('SELECT d.mp_access_token FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.id=$1', [referenceId])).rows[0]?.mp_access_token;
    } else {
      accessToken = (await query('SELECT mp_access_token FROM admins WHERE mp_connected=true LIMIT 1')).rows[0]?.mp_access_token || process.env.MP_ACCESS_TOKEN;
    }
    if (!accessToken) return res.sendStatus(503);
    const payment = await new Payment(new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } })).get({ id: paymentId });
    if (payment.status === 'approved') await applyApprovedPayment(payment, referenceId, appointmentId ? 'appointment' : 'subscription');
    return res.sendStatus(200);
  } catch (error) {
    console.error('No se pudo procesar el pago:', error.message);
    return res.sendStatus(error.status || 503);
  }
});
export default router;
