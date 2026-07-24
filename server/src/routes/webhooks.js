import express from 'express';
import { query } from '../db/config.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { notifyDoctor } from '../websocket/server.js';
import { sendNewAppointmentNotificationToDoctor, sendAppointmentConfirmation } from '../services/emailService.js';
import { sendPushToDoctor } from '../cron/reminderCron.js';
import crypto from 'crypto';

const router = express.Router();

const safeTokenMatch = (receivedToken, expectedToken) => {
  if (!receivedToken || !expectedToken) return false;

  const receivedBuffer = Buffer.from(String(receivedToken));
  const expectedBuffer = Buffer.from(String(expectedToken));
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
};

const hasValidWhatsAppSignature = (req) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('WhatsApp webhook recibido sin META_APP_SECRET configurado.');
    return process.env.NODE_ENV !== 'production';
  }

  const receivedSignature = req.get('x-hub-signature-256');
  if (!receivedSignature || !req.rawBody) return false;

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex')}`;

  return safeTokenMatch(receivedSignature, expectedSignature);
};

const persistWhatsAppEvent = async ({
  eventType,
  metaMessageId,
  status,
  phoneNumberId,
  contactWaId,
  eventTimestamp,
  payload
}) => {
  const eventKey = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      eventType,
      metaMessageId,
      status,
      phoneNumberId,
      contactWaId,
      eventTimestamp,
      payload
    }))
    .digest('hex');

  await query(
    `INSERT INTO whatsapp_webhook_events (
      event_key,
      event_type,
      meta_message_id,
      status,
      phone_number_id,
      contact_wa_id,
      event_timestamp,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    ON CONFLICT (event_key) DO NOTHING`,
    [
      eventKey,
      eventType,
      metaMessageId || null,
      status || null,
      phoneNumberId || null,
      contactWaId || null,
      eventTimestamp ? new Date(Number(eventTimestamp) * 1000) : null,
      JSON.stringify(payload)
    ]
  );
};

// Meta usa este endpoint para validar la URL de devolución de llamada.
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const receivedToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error('No se configuró WHATSAPP_WEBHOOK_VERIFY_TOKEN.');
    return res.status(503).send('Webhook no configurado');
  }

  if (mode === 'subscribe' && challenge && safeTokenMatch(receivedToken, expectedToken)) {
    console.log('Webhook de WhatsApp verificado correctamente por Meta.');
    return res.status(200).send(String(challenge));
  }

  console.warn('Intento fallido de verificación del webhook de WhatsApp.');
  return res.sendStatus(403);
});

// Recibe mensajes entrantes y actualizaciones de estado.
router.post('/whatsapp', async (req, res) => {
  if (!hasValidWhatsAppSignature(req)) {
    console.warn('Firma inválida en webhook de WhatsApp.');
    return res.sendStatus(401);
  }

  if (req.body?.object !== 'whatsapp_business_account') {
    return res.sendStatus(200);
  }

  try {
    let processedEvents = 0;

    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id || null;

        for (const messageStatus of value.statuses || []) {
          await persistWhatsAppEvent({
            eventType: 'message_status',
            metaMessageId: messageStatus.id,
            status: messageStatus.status,
            phoneNumberId,
            contactWaId: messageStatus.recipient_id,
            eventTimestamp: messageStatus.timestamp,
            payload: messageStatus
          });
          processedEvents += 1;
        }

        for (const message of value.messages || []) {
          await persistWhatsAppEvent({
            eventType: `incoming_${message.type || 'unknown'}`,
            metaMessageId: message.id,
            status: 'received',
            phoneNumberId,
            contactWaId: message.from,
            eventTimestamp: message.timestamp,
            payload: {
              id: message.id,
              from: message.from,
              timestamp: message.timestamp,
              type: message.type,
              context: message.context
                ? { id: message.context.id, from: message.context.from }
                : null
            }
          });
          processedEvents += 1;
        }
      }
    }

    console.log(`Webhook de WhatsApp procesado: ${processedEvents} evento(s).`);
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando webhook de WhatsApp:', error.message);
    return res.sendStatus(500);
  }
});

router.post('/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body;
    const { appointmentId, subscriptionId } = req.query;

    if (type === 'payment' && subscriptionId) {
      const paymentId = data.id;
      console.log(`🔔 Webhook MP: Procesando Pago de Suscripción ID ${paymentId} para Suscripción ${subscriptionId}`);

      const adminTokenResult = await query("SELECT mp_access_token FROM admins WHERE mp_connected = true LIMIT 1");
      const platformToken = (adminTokenResult.rows.length > 0 && adminTokenResult.rows[0].mp_access_token)
        ? adminTokenResult.rows[0].mp_access_token
        : (process.env.MP_ACCESS_TOKEN || 'APP_USR-3334296268871714-041414-dcbc9a327d0a87b9e037764d80e95f57-161301647');
      const client = new MercadoPagoConfig({ accessToken: platformToken });
      const payment = new Payment(client);
      
      const paymentData = await payment.get({ id: paymentId });
      const status = paymentData.status;

      console.log(`📝 Estado del pago de suscripción en MP: ${status}`);

      if (status === 'approved') {
        const subResult = await query(
          'SELECT doctor_id, pricing_plan_id FROM subscriptions WHERE id = $1',
          [subscriptionId]
        );

        if (subResult.rows.length > 0) {
          const { doctor_id, pricing_plan_id } = subResult.rows[0];

          const planResult = await query(
            'SELECT key FROM pricing_plans WHERE id = $1',
            [pricing_plan_id]
          );

          if (planResult.rows.length > 0) {
            const plan = planResult.rows[0];
            const plan_type = plan.key === 'commission' ? 'commission' : 'monthly';

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            await query(
              `UPDATE doctors
               SET subscription_status = 'active',
                   subscription_expires_at = $1,
                   pricing_plan_id = $2,
                   plan_type = $3
               WHERE id = $4`,
              [expiresAt, pricing_plan_id, plan_type, doctor_id]
            );

            await query(
              `UPDATE subscriptions
               SET status = 'approved',
                   period_start = CURRENT_TIMESTAMP,
                   period_end = $1
               WHERE id = $2`,
              [expiresAt, subscriptionId]
            );

            console.log(`✅ Suscripción ${subscriptionId} pagada y aprobada automáticamente vía MP webhook. Doctor ${doctor_id} activado.`);
          }
        }
      }
      return res.sendStatus(200);
    }

    if (type === 'payment' && appointmentId) {
      const paymentId = data.id;
      console.log(`🔔 Webhook MP: Procesando Pago ID ${paymentId} para Turno ${appointmentId}`);

      // 1. Buscamos el token del doctor asociado a este turno
      const apptQuery = await query(
        `SELECT d.mp_access_token, d.email as doctor_email, d.name as doctor_name, d.specialization as doctor_specialization 
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.id = $1`,
        [appointmentId]
      );

      const doctorToken = apptQuery.rows[0]?.mp_access_token;

      if (!doctorToken) {
        console.error('❌ No se encontró token de Mercado Pago para el doctor de este turno.');
        return res.sendStatus(200);
      }
      
      const client = new MercadoPagoConfig({ accessToken: doctorToken });
      const payment = new Payment(client);
      
      const paymentData = await payment.get({ id: paymentId });
      const status = paymentData.status;

      console.log(`📝 Estado del pago en MP: ${status}`);

      if (status === 'approved') {
        // 1. Obtener la comisión del turno y el plan del doctor
        const feeQuery = await query(
          `SELECT a.system_fee, a.doctor_id, d.plan_type, s.is_online, a.patient_id, a.appointment_date, a.appointment_time
           FROM appointments a
           JOIN doctors d ON a.doctor_id = d.id
           LEFT JOIN services s ON a.service_id = s.id
           WHERE a.id = $1`,
          [appointmentId]
        );
        
        if (feeQuery.rows.length > 0) {
          const { system_fee, doctor_id, plan_type, is_online, patient_id, appointment_date, appointment_time } = feeQuery.rows[0];
          let meetLink = null;

          // 2. Actualizar turno en la base de datos
          const updateResult = await query(
            `UPDATE appointments 
             SET status = 'pending', 
                 payment_status = 'paid', 
                 fee_charged = true, 
                 system_fee = CASE WHEN $2 = 'commission' THEN system_fee ELSE 0 END,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1
             RETURNING *`,
            [appointmentId, plan_type]
          );

          const appointment = updateResult.rows[0];

          // 3. SUMAR DEUDA AL DOCTOR (Solo si está en plan por comisión)
          if (plan_type === 'commission' && system_fee > 0) {
            await query(
              'UPDATE doctors SET accumulated_debt = accumulated_debt + $1 WHERE id = $2',
              [system_fee, doctor_id]
            );
            console.log(`✅ Turno ${appointmentId} confirmado y deuda de $${system_fee} cargada al doctor.`);
          } else {
            console.log(`✅ Turno ${appointmentId} confirmado. Sin deuda por plan: ${plan_type}`);
          }

          // Integración con Google Calendar (Solo si NO es consulta online)
          if (!is_online) {
            try {
              const { createCalendarEvent } = await import('../services/googleCalendarService.js');
              const calResult = await createCalendarEvent(doctor_id, {
                id: appointment.id,
                patient_id: patient_id,
                appointment_date: appointment_date,
                appointment_time: appointment_time,
                reason_for_visit: 'Consulta Presencial',
                is_online: false
              });
              meetLink = calResult?.meetLink || null;
              if (meetLink) {
                await query('UPDATE appointments SET meet_link = $1 WHERE id = $2', [meetLink, appointment.id]);
                console.log('🎥 Meet link generado en webhook:', meetLink);
              } else {
                console.log('📅 Evento de calendario creado en webhook');
              }
            } catch (err) {
              console.error('⚠️ Error en Google Calendar (webhook):', err.message);
            }
          } else {
            console.log('🎥 Cita online detectada en webhook. El evento de calendario y meet link se generarán al ser aceptada por el doctor.');
          }

          // 4. NOTIFICAR AL DOCTOR MEDIANTE WEBSOCKET
          notifyDoctor(doctor_id, {
            appointmentId: appointment.id,
            patientName: `${appointment.patient_name} ${appointment.patient_last_name}`,
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            message: 'Nuevo turno pagado y pendiente de aprobación'
          });

          // 4b. NOTIFICAR AL DOCTOR POR PUSH NOTIFICATION
          try {
            const formattedDate = new Date(appointment.appointment_date).toLocaleDateString('es-ES');
            sendPushToDoctor(doctor_id, {
              title: 'Nueva Solicitud de Turno 📅',
              body: `El paciente ${appointment.patient_name} ${appointment.patient_last_name} solicitó un turno para el ${formattedDate} a las ${appointment.appointment_time} hs.`,
              url: '/appointments'
            }).catch(err => console.error("Error enviando push al doctor desde webhook:", err.message));
          } catch (pushErr) {
            console.error("Error al preparar notificación push desde webhook:", pushErr.message);
          }

          // 5. NOTIFICAR AL DOCTOR POR EMAIL
          const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/appointments`;
          
          // Obtener nombre del servicio si existe
          let serviceName = 'Consulta General';
          if (appointment.service_id) {
            const srvResult = await query('SELECT name FROM services WHERE id = $1', [appointment.service_id]);
            if (srvResult.rows.length > 0) serviceName = srvResult.rows[0].name;
          }

          // Obtener nombre y email del paciente para el email
          const patResult = await query('SELECT name, email FROM patients WHERE id = $1', [appointment.patient_id]);
          const patientFullName = patResult.rows[0]?.name || 'Cliente';
          const patientEmail = patResult.rows[0]?.email;

          // NOTIFICAR AL DOCTOR
          sendNewAppointmentNotificationToDoctor({
            to: apptQuery.rows[0].doctor_email,
            doctorName: apptQuery.rows[0].doctor_name,
            patientName: patientFullName,
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            serviceName: serviceName,
            dashboardUrl: dashboardUrl
          }).catch(err => console.error("Error asíncrono email doctor webhook:", err));

          // NOTIFICAR AL PACIENTE
          if (patientEmail) {
            sendAppointmentConfirmation({
              to: patientEmail,
              patientName: patientFullName,
              doctorName: apptQuery.rows[0].doctor_name,
              doctorSpecialty: apptQuery.rows[0].doctor_specialization,
              appointmentDate: appointment.appointment_date,
              appointmentTime: appointment.appointment_time,
              appointmentCode: appointment.appointment_code,
              confirmUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient/appointment/${appointmentId}`,
              meetLink: meetLink
            }).catch(err => console.error("Error asíncrono email paciente webhook:", err));
          }

          console.log(`✅ Turno ${appointmentId} confirmado y deuda de $${system_fee} cargada al doctor.`);
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook MP:', error.message);
    res.sendStatus(200); // Siempre responder 200 a MP para evitar reintentos infinitos si el error es nuestro
  }
});

export default router;
