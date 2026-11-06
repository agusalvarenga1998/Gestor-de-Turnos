import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import axios from 'axios';

process.env.JWT_SECRET = 'operations-tests-only';
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = () => ({ verify(callback) { callback(null); }, sendMail() { throw new Error('No SMTP in tests'); } });
const { default: router } = await import('../src/routes/operations.js');
nodemailer.createTransport = originalTransport;
const { default: pool } = await import('../src/db/config.js');
const { reconcileAppointmentPayment } = await import('../src/services/reconciliationService.js');
const id = '00000000-0000-0000-0000-000000000001';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('reintentar avisos siempre usa el propietario de la sesión y rechaza avisos no reintentables', async () => {
  const handler = router.stack.find(layer => layer.route?.path === '/notifications/:id/retry').route.stack.at(-1).handle;
  const original = pool.connect; let allow = false; let params;
  pool.connect = async () => ({ async query(sql, values) {
    if (sql.includes('UPDATE email_outbox')) { params = values; return { rowCount: allow ? 1 : 0, rows: allow ? [{ doctor_id: id }] : [] }; }
    return { rows: [] };
  }, release() {} });
  try {
    const req = { params: { id }, user: { id }, body: { doctorId: 'other' } };
    let res = response(); await handler(req, res); assert.equal(res.code, 409); assert.equal(params[1], id);
    allow = true; res = response(); await handler(req, res); assert.equal(res.code, 200);
  } finally { pool.connect = original; }
});

test('un pago aprobado tardío no reactiva una cita cancelada ni ejecuta devoluciones', async () => {
  const originalQuery = pool.query, originalGet = axios.get, originalPost = axios.post;
  const checks = [];
  pool.query = async (sql, params) => {
    if (sql.includes('JOIN doctors')) return { rows: [{ id, status: 'cancelled', total_amount: '1000', mp_access_token: 'test-only-token' }] };
    if (sql.includes('INSERT INTO payment_checks')) checks.push(params);
    return { rows: [] };
  };
  axios.get = async url => url.includes('/refunds') ? { data: [] } : { data: { results: [{ id: 'payment', external_reference: id, currency_id: 'ARS', transaction_amount: 1000, status: 'approved' }] } };
  axios.post = async () => assert.fail('No debe devolver ni cobrar dinero');
  try {
    const result = await reconcileAppointmentPayment(id, id);
    assert.equal(result.results[0].outcome, 'needs_review');
    assert.equal(checks[0][5], 'needs_review');
  } finally { pool.query = originalQuery; axios.get = originalGet; axios.post = originalPost; }
});

test('distingue devolución confirmada por proveedor de un movimiento de Caja', async () => {
  const originalQuery = pool.query, originalGet = axios.get;
  pool.query = async sql => ({ rows: sql.includes('JOIN doctors') ? [{ id, status: 'cancelled', total_amount: '1000', mp_access_token: 'test-only-token' }] : [] });
  axios.get = async url => url.includes('/refunds') ? { data: [{ status: 'approved', amount: 1000 }] } : { data: { results: [{ id: 'payment', external_reference: id, currency_id: 'ARS', transaction_amount: 1000, status: 'refunded' }] } };
  try {
    const result = await reconcileAppointmentPayment(id, id);
    assert.equal(result.results[0].outcome, 'refund_confirmed');
    assert.equal(result.results[0].refundedAmount, 1000);
  } finally { pool.query = originalQuery; axios.get = originalGet; }
});
