import test from 'node:test';
import assert from 'node:assert/strict';

// Aislar la DB: estas pruebas nunca abren una conexión.
process.env.JWT_SECRET = 'local-tests-only-secret';
const { default: pool } = await import('../src/db/config.js');
const { verifyDoctorRole, checkSubscription } = await import('../src/middleware/auth.js');

test('una renovación habilita la sesión aunque el token diga expired; consulta una sola vez', async () => {
  const original = pool.query;
  let calls = 0;
  pool.query = async () => {
    calls++;
    return { rows: [{ subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 86400000) }] };
  };
  try {
    const req = { user: { id: 'test-id', role: 'doctor', subscription_status: 'expired' } };
    let nextCalls = 0;
    const res = { status() { throw new Error('Acceso rechazado'); } };
    await verifyDoctorRole(req, res, () => { nextCalls++; });
    await checkSubscription(req, res, () => { nextCalls++; });
    assert.equal(nextCalls, 2);
    assert.equal(calls, 1);
  } finally { pool.query = original; }
});

test('una sesión con token active queda bloqueada si la DB está vencida', async () => {
  const original = pool.query;
  pool.query = async () => ({ rows: [{ subscription_status: 'expired' }] });
  try {
    let status;
    let body;
    const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
    await verifyDoctorRole({ user: { id: 'test-id', role: 'doctor', subscription_status: 'active' } }, res, () => assert.fail('Acceso permitido'));
    assert.equal(status, 403);
    assert.equal(body.subscriptionExpired, true);
  } finally { pool.query = original; }
});
