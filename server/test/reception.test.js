import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

process.env.JWT_SECRET = 'reception-tests-only';
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = () => ({ verify(callback) { callback(null); }, sendMail() { throw new Error('No SMTP in tests'); } });
const { default: router } = await import('../src/routes/reception.js');
nodemailer.createTransport = originalTransport;
const { default: pool } = await import('../src/db/config.js');
const { verifyReception } = await import('../src/middleware/receptionAuth.js');
const { verifyToken } = await import('../src/middleware/auth.js');
const id = '00000000-0000-0000-0000-000000000001';
const doctorId = '00000000-0000-0000-0000-000000000002';
const account = { id, doctor_id: doctorId, name: 'Recepción', is_active: true, token_version: 1, status: 'approved', subscription_status: 'active' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const token = payload => jwt.sign({ id, doctor_id: doctorId, role: 'reception', token_version: 1, ...payload }, process.env.JWT_SECRET);

test('la sesión queda vinculada al consultorio y no acepta accesos desactivados o revocados', async () => {
  const original = pool.query;
  let row = account;
  pool.query = async () => ({ rows: [row] });
  try {
    const req = { headers: { authorization: `Bearer ${token({})}` } };
    let called = false;
    await verifyReception(req, response(), () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.id, doctorId);
    assert.equal(req.user.role, 'reception');
    for (const override of [{ is_active: false }, { token_version: 2 }, { doctor_id: 'another-doctor' }]) {
      row = { ...account, ...override };
      const res = response();
      await verifyReception(req, res, () => assert.fail('Acceso denegado'));
      assert.equal(res.statusCode, 401);
    }
    row = { ...account, status: 'suspended' };
    const res = response();
    await verifyReception(req, res, () => assert.fail('Profesional suspendido'));
    assert.equal(res.statusCode, 403);
  } finally { pool.query = original; }
});

test('un token de recepción no accede a las rutas del profesional ni usa tokens de otro propósito', async () => {
  const res = response();
  await verifyToken({ headers: { authorization: `Bearer ${token({})}` } }, res, () => assert.fail('No es profesional'));
  assert.equal(res.statusCode, 401);
  for (const override of [{ role: 'doctor' }, { purpose: 'login-2fa' }]) {
    await verifyReception({ headers: { authorization: `Bearer ${token(override)}` } }, res, () => assert.fail('No es sesión de recepción'));
    assert.equal(res.statusCode, 401);
  }
});

async function collect({ found = true, paid = false, amount = 900 } = {}) {
  const handler = router.stack.find(layer => layer.route?.path === '/appointments/:id/collect').route.stack.at(-1).handle;
  const original = pool.connect;
  const statements = [];
  pool.connect = async () => ({ async query(sql, params) {
    statements.push({ sql, params });
    if (sql.includes('FOR UPDATE')) return { rows: found ? [{ id, status: 'scheduled', payment_status: paid ? 'paid' : 'partial', total_price: '1000', booking_fee_paid: '100', coverage_amount: '0' }] : [] };
    return { rows: [] };
  }, release() {} });
  try {
    const res = response();
    await handler({ params: { id }, body: { method: 'efectivo', amount }, user: { id: doctorId }, reception: account }, res);
    return { res, statements };
  } finally { pool.connect = original; }
}

test('registra el saldo una sola vez y audita a la persona de recepción', async () => {
  const { res, statements } = await collect();
  assert.equal(res.statusCode, 200);
  const lock = statements.find(item => item.sql.includes('FOR UPDATE'));
  assert.deepEqual(lock.params, [id, doctorId]);
  const audit = statements.find(item => item.sql.includes('INSERT INTO audit_logs'));
  assert.equal(JSON.parse(audit.params[2]).receptionId, id);
  assert.equal(JSON.parse(audit.params[2]).amount, 900);
  assert.equal(statements.at(-1).sql, 'COMMIT');
  const duplicate = await collect({ paid: true });
  assert.equal(duplicate.statements.some(item => item.sql.includes('UPDATE appointments')), false);
});

test('no cobra turnos ajenos ni saldos que cambiaron desde la consulta', async () => {
  const missing = await collect({ found: false });
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.statements.at(-1).sql, 'ROLLBACK');
  const stale = await collect({ amount: 800 });
  assert.equal(stale.res.statusCode, 409);
  assert.equal(stale.statements.some(item => item.sql.includes('UPDATE appointments')), false);
});
