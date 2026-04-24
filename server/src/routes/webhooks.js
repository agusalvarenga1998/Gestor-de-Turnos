import express from 'express';
import { query } from '../db/config.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { notifyDoctor } from '../websocket/server.js';
import { sendNewAppointmentNotificationToDoctor } from '../services/emailService.js';

const router = express.Router();

router.post('/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body;
    const { appointmentId } = req.query; // Ahora lo recibimos por la URL

    if (type === 'payment' && appointmentId) {
      const paymentId = data.id;
      console.log(`🔔 Webhook MP: Procesando Pago ID ${paymentId} para Turno ${appointmentId}`);

      // 1. Buscamos el token del doctor asociado a este turno
      const apptQuery = await query(
        `SELECT d.mp_access_token, d.email as doctor_email, d.name as doctor_name 
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
          `SELECT a.system_fee, a.doctor_id, d.plan_type 
           FROM appointments a
           JOIN doctors d ON a.doctor_id = d.id
           WHERE a.id = $1`,
          [appointmentId]
        );
        
        if (feeQuery.rows.length > 0) {
          const { system_fee, doctor_id, plan_type } = feeQuery.rows[0];

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

          // 4. NOTIFICAR AL DOCTOR MEDIANTE WEBSOCKET
          notifyDoctor(doctor_id, {
            appointmentId: appointment.id,
            patientName: `${appointment.patient_name} ${appointment.patient_last_name}`,
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            message: 'Nuevo turno pagado y pendiente de aprobación'
          });

          // 5. NOTIFICAR AL DOCTOR POR EMAIL
          const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/appointments`;
          
          // Obtener nombre del servicio si existe
          let serviceName = 'Consulta General';
          if (appointment.service_id) {
            const srvResult = await query('SELECT name FROM services WHERE id = $1', [appointment.service_id]);
            if (srvResult.rows.length > 0) serviceName = srvResult.rows[0].name;
          }

          // Obtener nombre del paciente para el email
          const patResult = await query('SELECT name FROM patients WHERE id = $1', [appointment.patient_id]);
          const patientFullName = patResult.rows[0]?.name || 'Cliente';

          await sendNewAppointmentNotificationToDoctor({
            to: apptQuery.rows[0].doctor_email,
            doctorName: apptQuery.rows[0].doctor_name,
            patientName: patientFullName,
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            serviceName: serviceName,
            dashboardUrl: dashboardUrl
          });

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
