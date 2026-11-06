import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePatientReschedule } from '../src/utils/rescheduleValidation.js';
import pool from '../src/db/config.js';
import { reschedulePatientAppointment } from '../src/services/patientRescheduleService.js';

test('exige 24 horas en ambos horarios y rechaza estados finales o pagos pendientes', () => {
  const now = Date.parse('2026-11-06T10:00:00-03:00');
  const appt = { status: 'scheduled', appointment_date: '2026-11-08', appointment_time: '10:00:00' };
  assert.doesNotThrow(() => validatePatientReschedule(appt, '2026-11-07', '10:00', now));
  assert.throws(() => validatePatientReschedule(appt, '2026-11-07', '09:59', now));
  assert.throws(() => validatePatientReschedule({ ...appt, appointment_date: '2026-11-06' }, '2026-11-08', '10:00', now));
  for (const status of ['cancelled', 'completed', 'absent', 'expired', 'rejected', 'pending_payment']) assert.throws(() => validatePatientReschedule({ ...appt, status }, '2026-11-08', '10:00', now));
  assert.throws(() => validatePatientReschedule(appt, '2026-02-30', '10:00', now));
  assert.throws(() => validatePatientReschedule(appt, '2026-11-08', '25:00', now));
});

async function change({ conflict = false, failQueue = false } = {}) {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const statements = [];
  const appointment = { id: '00000000-0000-0000-0000-000000000001', doctor_id: '00000000-0000-0000-0000-000000000002', status: 'scheduled', appointment_date: '2099-01-05', appointment_time: '10:00:00', duration_minutes: 30, doctor_status: 'approved', subscription_status: 'active', doctor_name: 'Doctor', patient_email: 'patient@example.com', doctor_email: 'doctor@example.com', payment_status: 'partial', booking_fee_paid: '1000.00' };
  const execute = async (sql, params) => {
    statements.push(sql);
    if (sql.includes('SELECT a.*')) return { rows: [appointment] };
    if (sql.includes('FROM doctor_vacation')) return { rows: [] };
    if (sql.includes('FROM doctor_availability')) return { rows: [{ start_time: '08:00:00', end_time: '18:00:00' }] };
    if (sql.includes('SELECT appointment_time, duration_minutes')) return { rows: conflict ? [{ appointment_time: '11:00:00', duration_minutes: 30 }] : [] };
    if (sql.includes('UPDATE appointments SET appointment_date')) return { rows: [{ ...appointment, appointment_date: params[1], appointment_time: params[2] }] };
    if (failQueue && sql.includes('INSERT INTO email_outbox')) throw new Error('Queue failure');
    return { rows: [] };
  };
  pool.query = execute;
  pool.connect = async () => ({ query: execute, release() {} });
  try {
    const result = await reschedulePatientAppointment(appointment.id, '2099-01-06', '11:00');
    return { result, statements };
  } catch (error) { return { error, statements }; }
  finally { pool.query = originalQuery; pool.connect = originalConnect; }
}

test('cambia el horario en transacción sin modificar estado ni seña y guarda dos avisos', async () => {
  const { result, statements, error } = await change();
  assert.equal(error, undefined);
  assert.equal(result.status, 'scheduled');
  assert.equal(result.appointment_time, '11:00');
  const mutation = statements.find(sql => sql.includes('UPDATE appointments SET appointment_date'));
  assert.doesNotMatch(mutation, /payment_status\s*=|booking_fee_paid\s*=|status\s*=/);
  assert.equal(statements.filter(sql => sql.includes('INSERT INTO email_outbox')).length, 2);
  assert.ok(statements.indexOf('COMMIT') > statements.findIndex(sql => sql.includes('INSERT INTO email_outbox')));
});

test('un horario ocupado conserva el turno original', async () => {
  const { error, statements } = await change({ conflict: true });
  assert.equal(error.status, 409);
  assert.equal(statements.some(sql => sql.includes('UPDATE appointments SET appointment_date')), false);
  assert.equal(statements.at(-1), 'ROLLBACK');
});

test('revierte el cambio si falla guardar las notificaciones', async () => {
  const { error, statements } = await change({ failQueue: true });
  assert.ok(error);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false);
});
