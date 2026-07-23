const axios = require('axios');

/**
 * Servicio para envío automático de notificaciones por WhatsApp
 * Soporta integración con APIs de WhatsApp (Twilio, WhatsApp Cloud API, Meta, UltraMsg, Whapi, etc.)
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
    const cleanPhone = String(toPhone).replace(/\D/g, '');
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

    message += `\n¡Te esperamos!`;

    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;

    if (apiUrl && apiToken) {
      await axios.post(apiUrl, {
        phone: cleanPhone,
        message: message
      }, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log(`💬 [WhatsApp API] Mensaje de confirmación enviado a ${cleanPhone}`);
      return true;
    } else {
      console.log(`ℹ️ [WhatsApp Service] Cita confirmada para ${patientName} (${cleanPhone}). Para envíos 100% silenciosos configura WHATSAPP_API_URL.`);
    }
  } catch (err) {
    console.error('⚠️ Error en servicio WhatsApp API:', err.message);
  }

  return false;
};

module.exports = {
  sendWhatsAppConfirmationServer
};
