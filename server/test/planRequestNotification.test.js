import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanRequestNotifications } from '../src/utils/planRequestNotification.js';

const details = { doctorName: 'Profesional', doctorEmail: 'doctor@example.com', doctorPhone: '1112345678', planName: 'Mensual', planPrice: '$24.999' };

test('envía notificaciones independientes al administrador y a Agustín', () => {
  const mails = buildPlanRequestNotifications(details, { adminEmail: 'admin@example.com', frontendUrl: 'https://example.com/', from: 'TurnoHub <noreply@example.com>' });
  assert.deepEqual(mails.map(mail => mail.to), ['admin@example.com', 'agusalvarenga44@gmail.com']);
  for (const mail of mails) {
    assert.match(mail.text, /doctor@example.com/);
    assert.match(mail.text, /1112345678/);
    assert.match(mail.text, /\$24\.999/);
    assert.doesNotMatch(mail.text, /\$\$24/);
    assert.match(mail.html, /https:\/\/example.com\/admin\/activation-requests/);
    assert.match(mail.subject, /Mensual/);
  }
});

test('usa el correo admin por defecto y no duplica destinatarios', () => {
  assert.deepEqual(buildPlanRequestNotifications(details, { adminEmail: '' }).map(mail => mail.to), ['admin.turnohub@gmail.com', 'agusalvarenga44@gmail.com']);
  assert.deepEqual(buildPlanRequestNotifications(details, { adminEmail: ' AGUSALVARENGA44@gmail.com;agusalvarenga44@gmail.com ' }).map(mail => mail.to), ['agusalvarenga44@gmail.com']);
});

test('escapa los datos del profesional en el HTML del aviso', () => {
  const [mail] = buildPlanRequestNotifications({ ...details, doctorName: '<img src=x onerror=alert(1)>', planName: '<a>Plan</a>' }, { adminEmail: 'admin@example.com' });
  assert.doesNotMatch(mail.html, /<img|<a>Plan/);
  assert.match(mail.html, /&lt;img/);
});
