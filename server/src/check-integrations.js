import 'dotenv/config';

// Read-only preflight: never print credentials, contact providers, or send messages.
const present = key => {
  const value = String(process.env[key] || '').trim();
  return !!value && !/^(your_|tu_|example|changeme|placeholder)/i.test(value);
};
const groups = [
  ['Correo SMTP', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']],
  ['Mercado Pago (plataforma y webhook)', ['MP_ACCESS_TOKEN', 'MP_CLIENT_ID', 'MP_CLIENT_SECRET', 'MP_WEBHOOK_SECRET', 'MP_REDIRECT_URI', 'BACKEND_WEBHOOK_URL']],
  ['Google Calendar', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']]
];
console.log('Revisión local de configuración. Una variable presente no acredita credenciales válidas ni una integración funcional.');
for (const [name, keys] of groups) {
  const missing = keys.filter(key => !present(key));
  console.log(`${name}: ${missing.length ? 'faltan ' + missing.join(', ') : 'variables presentes; falta prueba externa'}`);
}
const whatsappOptions = [
  ['WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_CLOUD_PHONE_ID'],
  ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'],
  ['WHATSAPP_API_URL', 'WHATSAPP_API_TOKEN']
];
console.log('WhatsApp: ' + (whatsappOptions.some(keys => keys.every(present)) ? 'variables presentes para un proveedor; falta prueba externa' : 'ningún proveedor completamente configurado'));
for (const key of ['FRONTEND_URL', 'BACKEND_URL', 'BACKEND_WEBHOOK_URL', 'MP_REDIRECT_URI', 'GOOGLE_REDIRECT_URI']) {
  let state = 'ausente o inválida';
  try {
    const url = new URL(process.env[key]);
    state = url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ? 'HTTPS configurado; verificar accesibilidad y registro en el proveedor'
      : 'dirección local o sin HTTPS; revisar antes de publicar';
  } catch { /* Report state only, never the actual URL or its query parameters. */ }
  console.log(`${key}: ${state}`);
}
