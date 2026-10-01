import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.TEST_DB_NAME;
if (!/^turnohub_(test_|audit_)[a-z0-9_]+$/.test(database || '')) throw new Error('Usa una base de pruebas explícita en TEST_DB_NAME.');
process.env.DB_NAME = database;
process.env.DATABASE_URL = '';
const { default: pool, query, transaction } = await import('../src/db/config.js');
const { stabilizeSchema } = await import('../src/db/stabilize.js');
const { enqueueEmail, processEmailOutbox } = await import('../src/services/emailOutbox.js');
const ids = [];
let passed = 0;
const check = (name, value) => { assert.ok(value, name); passed++; console.log('PASS ' + name); };
const enqueue = async () => {
  const job = await enqueueEmail({ from: 'test@example.invalid', to: 'patient@example.invalid', subject: randomUUID(), text: 'Datos ficticios' });
  ids.push(job.id);
  return job;
};
const row = async id => (await query('SELECT * FROM email_outbox WHERE id=$1', [id])).rows[0];
try {
  await stabilizeSchema();
  await assert.rejects(transaction(async () => { await enqueue(); throw new Error('rollback'); }));
  check('rollback no deja un correo pendiente', !await row(ids[0]));
  const job = await enqueue();
  check('aviso persistido sin afirmar entrega', job.queued && !job.sent && (await row(job.id)).status === 'pending');
  await processEmailOutbox(async () => { throw Object.assign(new Error('SMTP temporal'), { code: 'ECONNRESET' }); }, { jobId: job.id });
  const retry = await row(job.id);
  check('fallo temporal conserva el mensaje y programa reintento', retry.status === 'pending' && retry.attempts === 1 && retry.payload && new Date(retry.available_at) > new Date());
  let sends = 0;
  await processEmailOutbox(async () => { sends++; }, { jobId: job.id });
  check('reintento respeta la espera', sends === 0);
  await query('UPDATE email_outbox SET available_at=now() WHERE id=$1', [job.id]);
  await Promise.all(Array.from({ length: 5 }, () => processEmailOutbox(async payload => {
    assert.equal(payload.messageId, job.messageId); sends++;
  }, { jobId: job.id })));
  check('procesos concurrentes toman un aviso una sola vez', sends === 1);
  check('entrega elimina el contenido privado', (await row(job.id)).status === 'sent' && (await row(job.id)).payload === null);
  const abandoned = await enqueue();
  await query("UPDATE email_outbox SET status='processing',lease_until=now()-interval '1 minute',lease_token=$2 WHERE id=$1", [abandoned.id, randomUUID()]);
  await processEmailOutbox(async () => { sends++; }, { jobId: abandoned.id });
  check('aviso abandonado se recupera tras vencer el bloqueo', (await row(abandoned.id)).status === 'sent');
  const expired = await enqueue();
  await query("UPDATE email_outbox SET expires_at=now()-interval '1 minute' WHERE id=$1", [expired.id]);
  await processEmailOutbox(async () => { throw new Error('No debe enviarse'); }, { jobId: expired.id });
  check('aviso vencido no se envía y elimina datos', (await row(expired.id)).status === 'expired' && (await row(expired.id)).payload === null);
  const rejected = await enqueue();
  await processEmailOutbox(async () => { throw Object.assign(new Error('Dirección inválida'), { responseCode: 550, code: 'EENVELOPE' }); }, { jobId: rejected.id });
  check('rechazo permanente no genera reintentos infinitos', (await row(rejected.id)).status === 'failed' && (await row(rejected.id)).payload === null);
  const exhausted = await enqueue();
  await query('UPDATE email_outbox SET attempts=7 WHERE id=$1', [exhausted.id]);
  await processEmailOutbox(async () => { throw new Error('Error temporal'); }, { jobId: exhausted.id });
  check('límite de ocho intentos', (await row(exhausted.id)).status === 'failed' && (await row(exhausted.id)).attempts === 8);
  console.log(`${passed} comprobaciones de cola correctas.`);
} finally {
  await query('DELETE FROM email_outbox WHERE id=ANY($1::uuid[])', [ids]);
  await pool.end();
}
