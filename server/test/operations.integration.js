import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

const source = new URL(process.env.DATABASE_URL || 'http://invalid');
if (source.hostname !== '127.0.0.1' || !/^turnohub_test_/.test(source.pathname.slice(1)) || source.pathname.slice(1) !== process.env.TEST_DB_NAME) throw new Error('Usá una base temporal local explícita turnohub_test_* en DATABASE_URL y TEST_DB_NAME.');
const uploadRoot = path.resolve(process.env.TEST_UPLOADS_DIR || '');
if (!uploadRoot.startsWith(path.resolve('scratch') + path.sep)) throw new Error('TEST_UPLOADS_DIR debe estar dentro de server/scratch.');
process.env.JWT_SECRET = 'operations-integration-tests-only';
const transport = nodemailer.createTransport;
nodemailer.createTransport = () => ({ verify(callback) { callback(null); }, sendMail() { throw new Error('No SMTP in integration tests'); } });
const { default: router } = await import('../src/routes/operations.js');
nodemailer.createTransport = transport;
const { default: pool, query } = await import('../src/db/config.js');
const { enqueueEmail, processEmailOutbox } = await import('../src/services/emailOutbox.js');
const { notifyWaitlistForSlot } = await import('../src/services/waitlistService.js');
const { reschedulePatientAppointment } = await import('../src/services/patientRescheduleService.js');
const doctor = '11111111-1111-4111-8111-111111111111', patient = '22222222-2222-4222-8222-222222222222', service = '33333333-3333-4333-8333-333333333333';
let passed = 0;
const check = (message, condition) => { assert.ok(condition, message); console.log('PASS ' + message); passed++; };
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, setHeader() {}, json(body) { this.body = body; return this; } });
try {
  // Solo se reemplaza esta identidad ficticia en una base local con prefijo de prueba.
  await query('DELETE FROM doctors WHERE id=$1', [doctor]);
  await query(`INSERT INTO doctors(id,email,name,status,subscription_status,subscription_expires_at,token_version)
    VALUES($1,'operations-fixture@example.invalid','Profesional ficticio','approved','active','2099-12-31',1)`, [doctor]);
  await query("INSERT INTO patients(id,doctor_id,email,name,document_number) VALUES($1,$2,'patient-fixture@example.invalid','Paciente ficticio','TEST-OPERATIONS')", [patient, doctor]);
  await query("INSERT INTO services(id,doctor_id,name,duration_minutes,price,booking_fee) VALUES($1,$2,'Servicio ficticio',30,1000,100)", [service, doctor]);
  for (let day = 0; day < 7; day++) await query("INSERT INTO doctor_availability(doctor_id,day_of_week,start_time,end_time) VALUES($1,$2,'08:00','18:00')", [doctor, day]);
  await query("INSERT INTO appointment_waitlist(doctor_id,patient_id,service_id,date_from,date_to,consent_at) VALUES($1,$2,$3,'2099-01-01','2099-01-31',now())", [doctor, patient, service]);
  const slot = { doctor_id: doctor, appointment_date: '2099-01-06', appointment_time: '10:00:00', service_id: service };
  check('horario libre prepara aviso real en la cola', await notifyWaitlistForSlot(slot) === 1);
  check('el mismo interesado y horario no reciben dos ofertas', await notifyWaitlistForSlot(slot) === 0);
  await query("INSERT INTO appointments(doctor_id,patient_id,appointment_date,appointment_time,status,duration_minutes,service_id) VALUES($1,$2,'2099-01-06','10:00','cancelled',30,$3)", [doctor, patient, service]);
  const appointment = (await query(`INSERT INTO appointments(doctor_id,patient_id,appointment_date,appointment_time,status,duration_minutes,service_id,total_price,booking_fee_paid,payment_status)
    VALUES($1,$2,'2099-01-06','10:00','scheduled',30,$3,1000,100,'partial') RETURNING *`, [doctor, patient, service])).rows[0];
  check('se puede reservar un horario cancelado sin desactivar la protección de solapamientos', !!appointment.id);
  await assert.rejects(query("INSERT INTO appointments(doctor_id,patient_id,appointment_date,appointment_time,status,duration_minutes) VALUES($1,$2,'2099-01-06','10:15','scheduled',30)", [doctor, patient]), error => error.code === '23P01');
  check('el trigger rechaza un turno activo solapado', true);
  const reminder = await enqueueEmail({ to: 'patient-fixture@example.invalid', from: 'test@example.invalid', text: 'Recordatorio ficticio del horario anterior' }, { doctorId: doctor, appointmentId: appointment.id, category: 'reminder' });
  await query("UPDATE appointments SET appointment_time='11:00' WHERE id=$1", [appointment.id]);
  await processEmailOutbox(async () => assert.fail('No se envían recordatorios obsoletos'), { jobId: reminder.id });
  check('el cambio de horario invalida el recordatorio en PostgreSQL real', (await query('SELECT status,payload FROM email_outbox WHERE id=$1', [reminder.id])).rows[0].status === 'expired');
  await query("UPDATE appointments SET payment_status='paid',settlement_method='efectivo' WHERE id=$1", [appointment.id]);
  await query("UPDATE appointments SET payment_status='paid' WHERE id=$1", [appointment.id]);
  const balance = (await query("SELECT amount FROM movements WHERE appointment_id=$1 AND type='cobro'", [appointment.id])).rows;
  check('el saldo se registra una sola vez por 900, conservando la seña de 100', balance.length === 1 && Number(balance[0].amount) === 900);
  await reschedulePatientAppointment(appointment.portal_token, '2099-01-07', '12:00');
  for (let attempt = 0; attempt < 20; attempt++) {
    if ((await query("SELECT 1 FROM waitlist_offers WHERE appointment_date='2099-01-06' AND appointment_time='11:00'")).rowCount) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  const moved = (await query('SELECT appointment_date,appointment_time,payment_status,booking_fee_paid FROM appointments WHERE id=$1', [appointment.id])).rows[0];
  check('reprogramación real conserva pago y seña', moved.appointment_date === '2099-01-07' && moved.payment_status === 'paid' && Number(moved.booking_fee_paid) === 100);
  for (const endpoint of ['/summary', '/notifications', '/waitlist', '/reconciliation']) {
    const handler = router.stack.find(layer => layer.route?.path === endpoint).route.stack.at(-1).handle;
    const res = response(); await handler({ user: { id: doctor }, query: {} }, res);
    check(`consulta real ${endpoint}`, res.code === 200 && res.body.success);
  }
  await mkdir(uploadRoot, { recursive: true }); await writeFile(path.join(uploadRoot, 'fixture.txt'), 'Adjunto ficticio para comprobar la restauración.');
  await query("INSERT INTO patient_records(patient_id,doctor_id,type,title,file_path) VALUES($1,$2,'document','Prueba ficticia','/uploads/fixture.txt')", [patient, doctor]);
  console.log(`${passed} comprobaciones operativas con PostgreSQL real correctas. Datos ficticios preparados para probar el respaldo.`);
} finally { await pool.end(); }
