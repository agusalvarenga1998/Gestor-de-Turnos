import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { sendWhatsAppConfirmationServer } from '../src/services/whatsappService.js';

test('el aviso de fila usa el teléfono correcto y comunica que ya es su turno', async () => {
  const originalPost = axios.post;
  const keys = ['WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_CLOUD_PHONE_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'WHATSAPP_API_URL'];
  const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  process.env.WHATSAPP_API_URL = 'https://example.invalid/test';
  let sent;
  axios.post = async (url, body) => { sent = body; return {}; };
  try {
    assert.equal(await sendWhatsAppConfirmationServer({ toPhone: '+54 9 11 1234 5678', patientName: 'Ana', customMessage: 'Ana, es tu turno. Pasá al consultorio.' }), true);
    assert.equal(sent.phone, '5491112345678');
    assert.match(sent.message, /es tu turno/);
    assert.doesNotMatch(sent.message, /CONFIRMADO|Invalid Date/);
  } finally {
    axios.post = originalPost;
    for (const key of keys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
  }
});
