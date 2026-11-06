import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/db/config.js';
import { notifyWaitlistForSlot } from '../src/services/waitlistService.js';

test('un horario libre genera un aviso por interesado y horario sin reservarlo', async () => {
  const originalConnect = pool.connect; let offered = false; const mails = []; const statements = [];
  pool.connect = async () => ({ async query(sql, params) {
    statements.push(sql);
    if (sql.includes('FROM appointment_waitlist')) return { rows: [{ id: 'entry', email: 'patient@example.com', doctor_name: 'Profesional', duration_minutes: 30 }] };
    if (sql.includes('FROM doctor_availability')) return { rows: [{ start_time: '08:00', end_time: '18:00' }] };
    if (sql.includes('INSERT INTO waitlist_offers')) { const rowCount = offered ? 0 : 1; offered = true; return { rowCount, rows: rowCount ? [{ id: 'offer' }] : [] }; }
    if (sql.includes('INSERT INTO email_outbox')) mails.push(params);
    return { rows: [] };
  }, release() {} });
  try {
    const slot = { doctor_id: 'doctor', appointment_date: '2099-01-06', appointment_time: '10:00:00' };
    assert.equal(await notifyWaitlistForSlot(slot), 1);
    assert.equal(await notifyWaitlistForSlot(slot), 0);
    assert.equal(mails.length, 1);
    assert.match(mails[0][1].text, /no reserva el turno/);
    assert.equal(mails[0][3], 'doctor');
    assert.equal(mails[0][4], 'waitlist');
    assert.equal(statements.some(sql => /INSERT INTO appointments|UPDATE appointments/.test(sql)), false);
  } finally { pool.connect = originalConnect; }
});
