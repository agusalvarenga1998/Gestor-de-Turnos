import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/db/config.js';
import { processEmailOutbox } from '../src/services/emailOutbox.js';

test('no envía un recordatorio cuyo turno cambió de horario o estado', async () => {
  const original = pool.query;
  const statements = [];
  pool.query = async sql => {
    statements.push(sql);
    if (sql.includes('RETURNING *')) return { rows: [{ id: 'job', appointment_id: 'appointment', appointment_context: { date: '2099-01-01', time: '10:00:00', status: 'scheduled' }, payload: { text: 'Horario anterior' } }] };
    return { rows: [], rowCount: 0 };
  };
  try {
    await processEmailOutbox(async () => assert.fail('El aviso quedó obsoleto'));
    assert.match(statements.at(-1), /status='expired',payload=NULL/);
  } finally { pool.query = original; }
});
