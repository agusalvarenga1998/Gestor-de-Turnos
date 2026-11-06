import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

process.env.JWT_SECRET = 'activation-request-tests-only';
process.env.ADMIN_EMAIL = 'admin@example.com';
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = () => ({ verify(callback) { callback(null); }, sendMail() { throw new Error('No SMTP in tests'); } });
const { default: router } = await import('../src/routes/doctor.js');
nodemailer.createTransport = originalTransport;
const { default: pool } = await import('../src/db/config.js');
const handler = router.stack.find(layer => layer.route?.path === '/subscriptions/request').route.stack.at(-1).handle;

async function request({ failQueue = false } = {}) {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const statements = [];
  const emails = [];
  let released = false;
  pool.query = async sql => ({ rows: sql.includes('pricing_plans')
    ? [{ id: 'plan', name: 'Plan Mensual', price: '$24.999' }]
    : [{ name: 'Profesional', email: 'doctor@example.com', phone: '1112345678' }] });
  pool.connect = async () => ({
    async query(sql, params) {
      statements.push(sql);
      if (sql.includes('INSERT INTO subscriptions')) return { rows: [{ id: 'request-id', amount: params[2], status: 'pending' }] };
      if (sql.includes('INSERT INTO email_outbox')) {
        if (failQueue && emails.length === 1) throw new Error('Simulated queue failure');
        emails.push(params[1]);
      }
      return { rows: [] };
    },
    release() { released = true; }
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await handler({ body: { pricing_plan_id: 'plan' }, user: { id: 'doctor' } }, res);
    return { res, statements, emails, released };
  } finally { pool.query = originalQuery; pool.connect = originalConnect; }
}

test('solicitud y avisos a ambos destinatarios se confirman en la misma transacción', async () => {
  const { res, statements, emails, released } = await request();
  assert.equal(res.code, 201);
  assert.equal(res.body.subscription.amount, 24999);
  assert.deepEqual(emails.map(mail => mail.to), ['admin@example.com', 'agusalvarenga44@gmail.com']);
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.at(-1), 'COMMIT');
  assert.equal(released, true);
});

test('si falla guardar un aviso se revierte todo y no se informa éxito', async () => {
  const { res, statements, released } = await request({ failQueue: true });
  assert.equal(res.code, 500);
  assert.equal(res.body.success, false);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false);
  assert.equal(released, true);
});
