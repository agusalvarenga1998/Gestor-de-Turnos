import cron from 'node-cron';
import { query } from '../db/config.js';
import { sendAppointmentReminder } from '../services/emailService.js';

// Tarea programada: Se ejecuta cada hora
export const initReminderCron = () => {
  console.log('⏰ Cron de recordatorios de turnos inicializado (Cada hora)');
  
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🔍 Buscando turnos para mañana (24hs antes)...');
      
      // Buscamos turnos que:
      // 1. Sean para mañana (FECHA ACTUAL + 1 DÍA)
      // 2. Tengan estado 'scheduled' o 'confirmed' o 'pending'
      // 3. No se les haya enviado el recordatorio aún
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
        WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND a.status IN ('scheduled', 'confirmed', 'pending')
          AND a.reminder_sent = false
          AND p.email IS NOT NULL
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
            // Marcar como enviado
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
};
