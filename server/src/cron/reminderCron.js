import cron from 'node-cron';
import { query } from '../db/config.js';
import { sendAppointmentReminder } from '../services/emailService.js';
import webpush from 'web-push';

// Helper para enviar notificaciones push a un médico (a todos sus dispositivos suscritos)
const sendPushToDoctor = async (doctorId, payload) => {
  try {
    const result = await query(
      'SELECT endpoint, p256dh, auth FROM doctor_push_subscriptions WHERE doctor_id = $1',
      [doctorId]
    );

    if (result.rows.length === 0) return;

    const notificationsPromises = result.rows.map(sub => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(
        pushConfig,
        JSON.stringify(payload)
      ).catch(err => {
        console.error(`❌ Error enviando push al endpoint ${sub.endpoint}:`, err.message);
        // Si la suscripción expiró o ya no existe (404 o 410), la eliminamos de la base de datos
        if (err.statusCode === 404 || err.statusCode === 410) {
          query('DELETE FROM doctor_push_subscriptions WHERE endpoint = $1', [sub.endpoint])
            .catch(dbErr => console.error('Error al limpiar suscripción push obsoleta:', dbErr.message));
        }
      });
    });

    await Promise.all(notificationsPromises);
  } catch (err) {
    console.error(`❌ Error general en sendPushToDoctor para médico ${doctorId}:`, err.message);
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
      console.log('🔍 Buscando turnos próximos en los siguientes 15 minutos...');
      
      const result = await query(`
        SELECT 
          a.id, 
          a.appointment_date, 
          a.appointment_time, 
          p.name as patient_name, 
          d.id as doctor_id,
          d.name as doctor_name
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
        const [h, m] = appt.appointment_time.split(':').map(Number);
        const apptTimeInMinutes = h * 60 + m;
        const diff = apptTimeInMinutes - currentTimeInMinutes;

        // Si el turno es en los próximos 15 minutos (0 a 15)
        if (diff >= 0 && diff <= 15) {
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
          COUNT(a.id) as appointment_count,
          MIN(a.appointment_time) as first_appointment_time
        FROM doctors d
        JOIN appointments a ON a.doctor_id = d.id
        WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND a.status IN ('scheduled', 'confirmed', 'pending')
        GROUP BY d.id, d.name
      `);

      console.log(`📋 Se enviarán resúmenes push a ${result.rows.length} médicos.`);

      for (const row of result.rows) {
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
};
