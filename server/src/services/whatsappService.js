const axios = require('axios');

/**
 * Servicio Centralizado de Notificaciones por WhatsApp de TurnoHub
 * Permite enviar mensajes automáticos desde el número oficial de TurnoHub a los pacientes.
 * 
 * Soporta las siguientes integraciones en segundo plano:
 * 1. Meta WhatsApp Cloud API (Oficial): WHATSAPP_CLOUD_TOKEN & WHATSAPP_CLOUD_PHONE_ID
 * 2. Twilio for WhatsApp: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN & TWILIO_WHATSAPP_NUMBER
 * 3. Gateway HTTP / UltraMsg / Whapi / Evolution API: WHATSAPP_API_URL & WHATSAPP_API_TOKEN
 */
const sendWhatsAppConfirmationServer = async ({
  toPhone,
  patientName,
  doctorName,
  date,
  time,
  serviceName,
  meetLink,
  clinicAddress
}) => {
  if (!toPhone) return false;

  try {
    let cleanPhone = String(toPhone).replace(/\D/g, '');
    if (!cleanPhone) return false;

    const dateStr = String(date).split('T')[0];
    const dateObj = new Date(dateStr + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = String(time || '').substring(0, 5);

    let message = `*¡Hola ${patientName || 'Paciente'}!* 👋\n\n` +
      `Tu turno con *${doctorName || 'el profesional'}* ha sido *CONFIRMADO* ✅\n\n` +
      `📅 *Fecha:* ${formattedDate}\n` +
      `⏰ *Hora:* ${timeStr} hs\n`;

    if (serviceName) message += `📋 *Servicio:* ${serviceName}\n`;
    if (meetLink) message += `📹 *Modalidad:* Online (Videollamada)\n🔗 *Link:* ${meetLink}\n`;
    else if (clinicAddress) message += `📍 *Lugar:* ${clinicAddress}\n`;

    message += `\n_Mensaje automático enviado por TurnoHub_ 🚀`;

    // 1. Meta / WhatsApp Cloud API
    if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_CLOUD_PHONE_ID) {
      const phoneId = process.env.WHATSAPP_CLOUD_PHONE_ID;
      const token = process.env.WHATSAPP_CLOUD_TOKEN;
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log(`💬 [TurnoHub WhatsApp Cloud API] Notificación enviada a +${cleanPhone}`);
      return true;
    }

    // 2. Twilio for WhatsApp
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
        ? process.env.TWILIO_WHATSAPP_NUMBER
        : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
      const toNumber = `whatsapp:+${cleanPhone}`;

      const params = new URLSearchParams();
      params.append('From', fromNumber);
      params.append('To', toNumber);
      params.append('Body', message);

      const auth = Buffer.from(`${sid}:${authToken}`).toString('base64');
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        params,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );
      console.log(`💬 [TurnoHub Twilio WhatsApp] Notificación enviada a ${toNumber}`);
      return true;
    }

    // 3. Gateway HTTP / UltraMsg / Whapi / Evolution API
    if (process.env.WHATSAPP_API_URL) {
      const apiUrl = process.env.WHATSAPP_API_URL;
      const apiToken = process.env.WHATSAPP_API_TOKEN;
      await axios.post(
        apiUrl,
        {
          phone: cleanPhone,
          to: cleanPhone,
          message: message,
          body: message
        },
        {
          headers: {
            ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      console.log(`💬 [TurnoHub WhatsApp Gateway] Notificación enviada a +${cleanPhone}`);
      return true;
    }

    console.log(`ℹ️ [TurnoHub WhatsApp] Cita confirmada para ${patientName} (+${cleanPhone}). Para activar envíos automáticos sin clic del profesional, configura las credenciales de WhatsApp (Twilio / Meta API / Gateway) en el servidor.`);
  } catch (err) {
    console.error('⚠️ Error al enviar mensaje automático de WhatsApp por TurnoHub:', err.response?.data || err.message);
  }

  return false;
};

module.exports = {
  sendWhatsAppConfirmationServer
};
