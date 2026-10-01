import { createHmac, timingSafeEqual } from 'node:crypto';
import { httpError } from './validation.js';
// https://www.mercadopago.com.ar/developers/en/docs/wallet-connect/notifications
export function validPaymentSignature({ signature, requestId, dataId, secret }) {
  if (!secret || !signature || !requestId || !dataId) return false;
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  if (!/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return timingSafeEqual(createHmac('sha256', secret).update(manifest).digest(), Buffer.from(parts.v1, 'hex'));
}
export function validateApprovedPayment(payment, referenceId, amount) {
  if (payment.status !== 'approved' || String(payment.external_reference) !== referenceId || payment.currency_id !== 'ARS' || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(payment.transaction_amount) !== Number(amount)) throw httpError('El pago no coincide con la operación pendiente.', 422);
}
