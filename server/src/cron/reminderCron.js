import cron from 'node-cron';
import { query } from '../db/config.js';
import { sendAppointmentReminder, sendAdminTrialExpiringNotification, sendDoctorBirthdayGreetingEmail } from '../services/emailService.js';
import { autoUpdatePastAppointments } from '../services/appointmentService.js';
import webpush from 'web-push';

import fs from 'fs';
import path from 'path';

// Helper to write push debug logs
const logPushDebug = (msg) => {
  try {
    const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'push_debug.log'), logMsg, 'utf8');
  } catch (e) {
    console.error('Error writing push debug log:', e);
  }
};

// Helper para enviar notificaciones push a un médico (a todos sus dispositivos suscritos)
export const sendPushToDoctor = async (doctorId, payload) => {
  logPushDebug(`sendPushToDoctor called for doctorId: ${doctorId}`);
  try {
    // Verificar preferencias de notificación del doctor en la BD
    const docCheck = await query(
      'SELECT notify_daily_summary_push, notify_advance_push, notify_approval_push FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (docCheck.rows.length > 0) {
      const doc = docCheck.rows[0];
      const title = payload.title || '';

      if (title.includes('Agenda de Mañana') && doc.notify_daily_summary_push === false) {
        logPushDebug(`Push summary skipped for doctor ${doctorId} (disabled by user)`);
        return;
      }
      if (title.includes('Turno Próximo') && doc.notify_advance_push === false) {
        logPushDebug(`Push reminder skipped for doctor ${doctorId} (disabled by user)`);
        return;
      }
      if ((title.includes('Pendiente') || title.includes('Reservado') || title.includes('Nuevo Turno')) && doc.notify_approval_push === false) {
        logPushDebug(`Push approval skipped for doctor ${doctorId} (disabled by user)`);
        return;
      }
    }

    const result = await query(
      'SELECT endpoint, p256dh, auth FROM doctor_push_subscriptions WHERE doctor_id = $1',
      [doctorId]
    );

    logPushDebug(`Found ${result.rows.length} subscription(s) for doctorId: ${doctorId}`);
    if (result.rows.length === 0) return;

    const notificationsPromises = result.rows.map((sub, index) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      logPushDebug(`Sending push to endpoint: ${sub.endpoint.substring(0, 40)}...`);
      return webpush.sendNotification(
        pushConfig,
        JSON.stringify(payload)
      ).then(() => {
        logPushDebug(`Push sent successfully to endpoint index ${index}`);
      }).catch(err => {
        logPushDebug(`❌ Error sending push to endpoint index ${index}: ${err.message} (status: ${err.statusCode})`);
        // Si la suscripción expiró o ya no existe (404 o 410), la eliminamos de la base de datos
        if (err.statusCode === 404 || err.statusCode === 410) {
          query('DELETE FROM doctor_push_subscriptions WHERE endpoint = $1', [sub.endpoint])
            .then(() => logPushDebug(`Deleted expired subscription: ${sub.endpoint.substring(0, 40)}...`))
            .catch(dbErr => logPushDebug(`Error deleting expired subscription: ${dbErr.message}`));
        }
      });
    });

    await Promise.all(notificationsPromises);
    logPushDebug(`All push promises resolved for doctorId: ${doctorId}`);
  } catch (err) {
    logPushDebug(`❌ General error in sendPushToDoctor for doctor ${doctorId}: ${err.message}`);
  }
};

// Tareas programadas
export const initReminderCron = () => {
  console.log('⏰ Cron de recordatorios de turnos inicializado (Cada hora)');
  
  // 1. CRON EXISTENTE: Recordatorios por Email a pacientes (Cada hora)
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🔍 Buscando turnos para mañana (24hs antes)...');
      
      const result = await query(`
        SELECT 
          a.id, 
          a.appointment_date, 
          a.appointment_time, 
          p.name as patient_name, 
          p.email as patient_email, 
          d.name as doctor_name,
          d.clinic_name,
          d.clinic_address
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN pricing_plans p_plan ON d.pricing_plan_id = p_plan.id
        WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND a.status IN ('scheduled', 'confirmed', 'pending')
          AND a.reminder_sent = false
          AND p.email IS NOT NULL
          AND COALESCE(p_plan.allow_reminders, true) = true
      `);

      console.log(`📋 Se encontraron ${result.rows.length} recordatorios pendientes.`);

      for (const appointment of result.rows) {
        try {
          console.log(`📧 Enviando recordatorio a ${appointment.patient_email} para el turno con ${appointment.doctor_name}`);
          
          const emailSent = await sendAppointmentReminder({
            to: appointment.patient_email,
            patientName: appointment.patient_name,
            doctorName: appointment.doctor_name,
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            clinicName: appointment.clinic_name,
            clinicAddress: appointment.clinic_address
          });

          if (emailSent.sent) {
            await query('UPDATE appointments SET reminder_sent = true WHERE id = $1', [appointment.id]);
            console.log(`✓ Recordatorio enviado y marcado para el turno ${appointment.id}`);
          }
        } catch (innerError) {
          console.error(`❌ Error procesando recordatorio para turno ${appointment.id}:`, innerError.message);
        }
      }
    } catch (error) {
      console.error('❌ Error en el cron de recordatorios:', error.message);
    }
  });

  // 2. CRON PUSH: Alertas de Turno Próximo al médico (Cada 5 minutos)
  console.log('⏰ Cron de alertas push próximas inicializado (Cada 5 minutos)');
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔍 Buscando turnos próximos...');
      
      const result = await query(`
        SELECT 
          a.id, 
          a.appointment_date, 
          a.appointment_time, 
          p.name as patient_name, 
          d.id as doctor_id,
          d.name as doctor_name,
          d.notify_advance_push,
          d.notify_advance_time
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.appointment_date = CURRENT_DATE
          AND a.status IN ('scheduled', 'confirmed', 'pending')
          AND a.doctor_push_sent = false
      `);
 
      if (result.rows.length === 0) return;
 
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;
 
      for (const appt of result.rows) {
        if (appt.notify_advance_push === false) continue;

        const advanceTime = appt.notify_advance_time !== null ? appt.notify_advance_time : 15;
        const [h, m] = appt.appointment_time.split(':').map(Number);
        const apptTimeInMinutes = h * 60 + m;
        const diff = apptTimeInMinutes - currentTimeInMinutes;
 
        // Si el turno es en los próximos advanceTime minutos
        if (diff >= 0 && diff <= advanceTime) {
          console.log(`📱 Enviando alerta push al médico ${appt.doctor_name} por turno próximo de ${appt.patient_name}`);
          
          await sendPushToDoctor(appt.doctor_id, {
            title: 'Turno Próximo 📅',
            body: `Tu turno con ${appt.patient_name} comienza a las ${appt.appointment_time} hs.`,
            url: '/appointments'
          });
 
          // Marcar como enviado para evitar duplicados
          await query('UPDATE appointments SET doctor_push_sent = true WHERE id = $1', [appt.id]);
        }
      }
    } catch (error) {
      console.error('❌ Error en el cron de alertas push:', error.message);
    }
  });

  // 3. CRON PUSH: Resumen diario de turnos de mañana al médico (Todos los días a las 20:00hs)
  console.log('⏰ Cron de resumen push diario inicializado (Todos los días a las 20:00 hs)');
  cron.schedule('0 20 * * *', async () => {
    try {
      console.log('🔍 Consolidando resúmenes de turnos para mañana...');
      
      const result = await query(`
        SELECT 
          d.id as doctor_id,
          d.name as doctor_name,
          d.notify_daily_summary_push,
          COUNT(a.id) as appointment_count,
          MIN(a.appointment_time) as first_appointment_time
        FROM doctors d
        JOIN appointments a ON a.doctor_id = d.id
        WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND a.status IN ('scheduled', 'confirmed', 'pending')
        GROUP BY d.id, d.name, d.notify_daily_summary_push
      `);

      console.log(`📋 Se enviarán resúmenes push a ${result.rows.length} médicos.`);

      for (const row of result.rows) {
        if (row.notify_daily_summary_push === false) {
          console.log(`Resumen push diario desactivado para el Dr. ${row.doctor_name}`);
          continue;
        }

        console.log(`📱 Enviando resumen push a ${row.doctor_name}: ${row.appointment_count} turnos para mañana`);
        
        await sendPushToDoctor(row.doctor_id, {
          title: 'Agenda de Mañana 📋',
          body: `Hola Dr. ${row.doctor_name}, mañana tienes ${row.appointment_count} turno(s) agendado(s). El primero inicia a las ${row.first_appointment_time} hs.`,
          url: '/appointments'
        });
      }
    } catch (error) {
      console.error('❌ Error en el cron de resumen diario push:', error.message);
    }
  });

  // 4. CRON ADMIN: Alerta al Administrador de fin de prueba gratis en 2 días (Todos los días a las 09:00 hs)
  console.log('⏰ Cron de alertas admin sobre prueba gratis por vencer inicializado (Todos los días a las 09:00 hs)');
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔍 Buscando médicos con prueba gratis que vence en 2 días...');
      
      const result = await query(`
        SELECT 
          id, 
          name, 
          email, 
          trial_ends_at
        FROM doctors
        WHERE status = 'approved'
          AND subscription_status = 'trial'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at::date = (CURRENT_DATE + INTERVAL '2 days')::date
          AND (admin_trial_warning_sent IS NULL OR admin_trial_warning_sent = false)
      `);

      if (result.rows.length === 0) {
        return;
      }

      console.log(`📋 Se enviarán alertas al administrador (admin.turnohub@gmail.com) para ${result.rows.length} médico(s).`);

      for (const doc of result.rows) {
        try {
          const sentResult = await sendAdminTrialExpiringNotification({
            adminEmail: 'admin.turnohub@gmail.com',
            doctorName: doc.name,
            doctorEmail: doc.email,
            trialEndsAt: doc.trial_ends_at
          });

          if (sentResult.sent) {
            await query('UPDATE doctors SET admin_trial_warning_sent = true WHERE id = $1', [doc.id]);
            console.log(`✓ Alerta enviada a admin.turnohub@gmail.com para el doctor ${doc.name}`);
          }
        } catch (innerErr) {
          console.error(`❌ Error enviando alerta admin para doctor ${doc.id}:`, innerErr.message);
        }
      }
    } catch (error) {
      console.error('❌ Error en el cron de alerta admin de prueba gratis:', error.message);
    }
  });

  // 5. CRON CUMPLEAÑOS: Felicitación automática por mail a los profesionales en su día (Todos los días a las 08:00 hs)
  console.log('⏰ Cron de salutaciones de cumpleaños a profesionales inicializado (Todos los días a las 08:00 hs)');
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('🔍 Buscando profesionales que cumplan años hoy...');
      
      const result = await query(`
        SELECT 
          id, 
          name, 
          email, 
          date_of_birth
        FROM doctors
        WHERE date_of_birth IS NOT NULL
          AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
          AND (birthday_email_sent_year IS NULL OR birthday_email_sent_year < EXTRACT(YEAR FROM CURRENT_DATE))
      `);

      if (result.rows.length === 0) {
        return;
      }

      console.log(`🎉 ¡Hoy cumplen años ${result.rows.length} profesional(es)! Enviando emails de felicitaciones...`);

      const currentYear = new Date().getFullYear();

      for (const doc of result.rows) {
        try {
          const sentResult = await sendDoctorBirthdayGreetingEmail({
            to: doc.email,
            doctorName: doc.name
          });

          if (sentResult.sent) {
            await query('UPDATE doctors SET birthday_email_sent_year = $1 WHERE id = $2', [currentYear, doc.id]);
            console.log(`✓ Email de cumpleaños enviado exitosamente a ${doc.name} (${doc.email})`);
          }
        } catch (innerErr) {
          console.error(`❌ Error enviando email de cumpleaños a ${doc.id}:`, innerErr.message);
        }
      }
    } catch (error) {
      console.error('❌ Error en el cron de cumpleaños de profesionales:', error.message);
    }
  });

  // 6. CRON SUSCRIPCIONES: Actualizar automáticamente cuentas con trial o suscripción vencida (Cada hora)
  console.log('⏰ Cron de actualización automática de suscripciones/trials vencidos inicializado (Cada hora)');
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await query(`
        UPDATE doctors
        SET subscription_status = 'expired'
        WHERE status = 'approved'
          AND (
            (subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < CURRENT_TIMESTAMP)
            OR
            (subscription_status = 'active' AND subscription_expires_at IS NOT NULL AND subscription_expires_at < CURRENT_TIMESTAMP)
          )
      `);
      if (result.rowCount > 0) {
        console.log(`🔒 Se actualizaron ${result.rowCount} cuenta(s) a estado 'expired' (vencidas).`);
      }
    } catch (error) {
      console.error('❌ Error en el cron de actualización de suscripciones vencidas:', error.message);
    }
  });

  // 7. CRON AUTO-UPDATE TURNOS Y SOLICITUDES VENCIDAS (Cada 15 minutos)
  console.log('⏰ Cron de auto-actualización de turnos pasados y solicitudes vencidas inicializado (Cada 15 minutos)');
  cron.schedule('*/15 * * * *', async () => {
    try {
      await autoUpdatePastAppointments();
    } catch (error) {
      console.error('❌ Error en el cron de auto-actualización de turnos pasados:', error.message);
    }
  });
};
