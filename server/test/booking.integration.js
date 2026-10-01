// Integration checks run only against an explicitly named disposable database.
// Restore the application's schema there first. No production data is required.
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const database = process.env.TEST_DB_NAME;
if (!/^turnohub_(test_|audit_)[a-z0-9_]+$/.test(database || '')) throw new Error('TEST_DB_NAME debe identificar una base descartable turnohub_test_* o turnohub_audit_*.');
const pool = new pg.Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database });
const env = { ...process.env, DATABASE_URL: '', DB_NAME: database, PORT: '5013', HOST: '127.0.0.1', NODE_ENV: 'test', JWT_SECRET: 'integration-only-secret', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'test@example.invalid', SMTP_PASSWORD: 'test', MP_ACCESS_TOKEN: '', MP_CLIENT_SECRET: '', MP_WEBHOOK_SECRET: 'integration-only-webhook', WHATSAPP_CLOUD_TOKEN: '', WHATSAPP_API_TOKEN: '', TWILIO_AUTH_TOKEN: '', GOOGLE_CLIENT_SECRET: '' };
// Avoid writing generated VAPID keys to .env during tests.
const webpush = (await import('web-push')).default;
const vapid = webpush.generateVAPIDKeys();
Object.assign(env, { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_EMAIL: 'mailto:test@example.invalid' });
env.EMAIL_WORKER_ENABLED = 'false';
const child = spawn(process.execPath, ['src/app.js'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
let startupErrors = '';
child.stderr.on('data', data => { startupErrors = (startupErrors + data.toString()).slice(-6000); });
let passed = 0;
async function api(path, method = 'GET', body, token) {
  const r = await fetch('http://127.0.0.1:5013/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
function check(label, condition) { assert.ok(condition, label); passed++; console.log('PASS ' + label); }
const doctors = [randomUUID(), randomUUID()];
const patientEmail = 'patient-' + doctors[0] + '@example.invalid';
try {
  for (let i = 0; i < 2; i++) {
    const migration = spawnSync(process.execPath, ['src/db/migrate.js'], { env, encoding: 'utf8', timeout: 30000 });
    check('migración maestra repetible ' + (i + 1), migration.status === 0);
    if (migration.status !== 0) console.error(migration.stderr);
  }
  const init = spawnSync(process.execPath, ['src/db/init.js'], { env, encoding: 'utf8', timeout: 10000 });
  check('inicializador antiguo omite base migrada sin modificarla', init.status === 0 && init.stdout.includes('migraciones versionadas'));
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch('http://127.0.0.1:5013/health')).ok) { ready = true; break; } } catch {}
    await wait(500);
  }
  assert.ok(ready, 'API de prueba no inició. Verifica el esquema de TEST_DB_NAME y que el puerto 5013 esté libre.\n' + startupErrors);
  const password = 'Integration-test-2026!';
  const email = 'test-' + doctors[0] + '@example.invalid';
  for (let i = 0; i < doctors.length; i++) await pool.query("INSERT INTO doctors(id,name,email,password_hash,status,subscription_status,subscription_expires_at,plan_type) VALUES($1,'Prueba automatizada',$2,$3,'approved','active',now()+interval '1 year','monthly')", [doctors[i], i === 0 ? email : 'test-' + doctors[i] + '@example.invalid', await bcrypt.hash(password, 4)]);
  const pa = (await pool.query("INSERT INTO patients(doctor_id,name,document_number,email) VALUES($1,'Paciente original','INTEGRATION',$2) RETURNING id", [doctors[0], patientEmail])).rows[0];
  const pb = (await pool.query("INSERT INTO patients(doctor_id,name,document_number) VALUES($1,'Otro paciente','INTEGRATION') RETURNING id", [doctors[1]])).rows[0];
  check('documento permitido en consultorios distintos', !!pb.id);
  const service = (await pool.query("INSERT INTO services(doctor_id,name,price,booking_fee,duration_minutes) VALUES($1,'Servicio prueba',1000,100,60) RETURNING id", [doctors[0]])).rows[0];
  const future = new Date(); future.setUTCDate(future.getUTCDate() + 21);
  const date = future.toISOString().slice(0,10);
  await pool.query("INSERT INTO doctor_availability(doctor_id,day_of_week,start_time,end_time,is_available) VALUES($1,$2,'09:00','17:00',true)", [doctors[0], future.getUTCDay()]);
  const login = await api('/auth/login','POST',{email,password}); const token = login.data.token;
  check('inicio de sesión', login.status === 200 && !!token);
  check('cola administrativa requiere administrador', (await api('/admin/system-status','GET',undefined,token)).status === 403);
  const adminStatus = await api('/admin/system-status','GET',undefined,jwt.sign({ id: randomUUID(), role: 'admin' }, env.JWT_SECRET, { expiresIn: '1m' }));
  check('estado de cola solo expone contadores', adminStatus.status === 200 && Number.isInteger(adminStatus.data.emailQueue.pending) && !('payload' in adminStatus.data.emailQueue));
  check('DNI no revela datos', (await api('/appointments/public/patient-details/'+doctors[0]+'/INTEGRATION')).status === 403);
  check('paciente de otro profesional rechazado', (await api('/appointments','POST',{patientId:pb.id,appointment_date:date,appointment_time:'10:00'},token)).status === 404);
  const booking = {doctorId:doctors[0],serviceId:service.id,appointmentDate:date,appointmentTime:'10:00',patientName:'Nombre ingresado',patientDocumentNumber:'INTEGRATION',paymentMethod:'cash'};
  const race = await Promise.all(['10:00','10:30'].map(time=>api('/appointments/public/create','POST',{...booking,appointmentTime:time})));
  check('reservas concurrentes no se superponen', race.filter(r=>r.status===200).length===1 && race.some(r=>r.status===409));
  const portal = race.find(r=>r.status===200).data.appointment.id;
  check('reserva no altera ficha sin verificación', (await pool.query('SELECT name FROM patients WHERE id=$1',[pa.id])).rows[0].name === 'Paciente original');
  const stored = (await pool.query('SELECT id FROM appointments WHERE portal_token=$1',[portal])).rows[0];
  check('ID interno no abre turno', (await api('/appointments/public/'+stored.id)).status===404);
  check('enlace privado abre turno', (await api('/appointments/public/'+portal)).status===200);
  check('cancelación sin cuenta', (await api('/appointments/public/'+portal+'/cancel','POST',{})).status===200);
  for (const amount of ['abc',-1,1.001]) check('importe inválido '+amount, (await api('/movements','POST',{amount,type:'cobro',paymentMethod:'efectivo'},token)).status===400);
  const tickets=await Promise.all(Array.from({length:5},()=>api('/queue/register','POST',{patientName:'Paciente prueba'},token)));
  check('tickets concurrentes únicos', tickets.every(r=>r.status===201)&&new Set(tickets.map(r=>r.data.entry.ticket_number)).size===5);
  const board=await api('/queue/public/board/'+doctors[0]);
  check('pantalla pública sin contactos ni tokens', board.status===200&&!JSON.stringify(board.data.waitingList).match(/patient_phone|tracking_token|patient_email|notes/));
  Object.assign(process.env, env);
  const { applyApprovedPayment } = await import('../src/services/paymentService.js');
  const { default: servicePool } = await import('../src/db/config.js');
  try {
    const charge=(await pool.query("INSERT INTO appointments(doctor_id,patient_id,appointment_date,appointment_time,duration_minutes,status,payment_status,total_price,total_amount,system_fee) VALUES($1,$2,$3,'13:00',30,'pending_payment','pending',5000,1000,30) RETURNING id",[doctors[0],pa.id,date])).rows[0];
    const payment={id:'test-'+charge.id,status:'approved',external_reference:charge.id,currency_id:'ARS',transaction_amount:1000};
    await assert.rejects(applyApprovedPayment({...payment,transaction_amount:1},charge.id,'appointment'));
    check('pago con importe incorrecto no se aplica', !(await pool.query('SELECT 1 FROM payment_receipts WHERE reference_id=$1',[charge.id])).rowCount);
    const payments=await Promise.all(Array.from({length:5},()=>applyApprovedPayment(payment,charge.id,'appointment')));
    check('avisos de pago concurrentes aplican una sola vez', payments.filter(r=>r.applied).length===1);
    const deposit=(await pool.query('SELECT payment_status,booking_fee_paid FROM appointments WHERE id=$1',[charge.id])).rows[0];
    check('seña conserva saldo pendiente', deposit.payment_status==='partial'&&Number(deposit.booking_fee_paid)===970);
    const paid=await api('/appointments/'+charge.id,'PATCH',{payment_status:'paid',settlement_method:'transferencia'},token);
    check('profesional registra saldo cobrado', paid.status===200);
    const cash=(await pool.query("SELECT amount,payment_method FROM movements WHERE appointment_id=$1 AND type='cobro'",[charge.id])).rows;
    check('saldo contable correcto y medio elegido',cash.length===1&&Number(cash[0].amount)===4030&&cash[0].payment_method==='transferencia');
    await api('/appointments/'+charge.id,'PATCH',{status:'cancelled'},token);
    check('cancelar no simula devolver dinero',!(await pool.query("SELECT 1 FROM movements WHERE appointment_id=$1 AND type='reembolso'",[charge.id])).rowCount);
    await pool.query('DELETE FROM payment_receipts WHERE reference_id=$1',[charge.id]);
  } finally { await servicePool.end(); }
  await api('/auth/profile/logout-all','POST',{},token);
  check('sesión previa revocada', (await api('/auth/verify','GET',undefined,token)).status===401);
  const next=await api('/auth/login','POST',{email,password});
  check('nuevo ingreso tras revocación', (await api('/auth/verify','GET',undefined,next.data.token)).status===200);
  await pool.query('UPDATE doctors SET two_factor_enabled=true WHERE id=$1',[doctors[0]]);
  const challenge=await api('/auth/login','POST',{email,password});
  check('contraseña no omite segundo factor', !!challenge.data.challengeToken&&!challenge.data.token);
  check('segundo factor exige desafío previo', (await api('/auth/login/2fa','POST',{doctorId:doctors[0],code:'000000'})).status===401);
  console.log(`${passed} comprobaciones de integración correctas.`);
} finally {
  // Only this run's synthetic accounts are removed; never truncate shared tables.
  child.kill();
  await pool.query("DELETE FROM email_outbox WHERE payload->>'to'=$1", [patientEmail]);
  await pool.query('DELETE FROM doctors WHERE id=ANY($1::uuid[])',[doctors]);
  await pool.end();
}
