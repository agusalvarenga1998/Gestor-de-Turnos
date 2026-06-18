import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription, verifyApiKey } from '../middleware/auth.js';
import * as appointmentController from '../controllers/appointmentController.js';
import { query } from '../db/config.js';
import { notifyDoctor } from '../websocket/server.js';
import { sendDelayNotification, sendAppointmentConfirmation, sendAppointmentRejectionEmail, sendNewAppointmentNotificationToDoctor } from '../services/emailService.js';
import * as availabilityService from '../services/availabilityService.js';
import * as mpService from '../services/mercadopagoService.js';
import axios from 'axios';
import * as wss from '../websocket/server.js';

const router = express.Router();
const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitamos O, 0, I, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MH-${code}`;
};

// ===== RUTAS PÚBLICAS =====

// Obtener especialidades disponibles
router.get('/public/specializations', async (req, res) => {
  try {
    console.log('🔓 Obtener especialidades públicas');

    const result = await query(
      `SELECT DISTINCT TRIM(INITCAP(specialization)) as specialization
       FROM doctors
       WHERE status = 'approved'
       AND subscription_status IN ('active', 'trial')
       AND specialization IS NOT NULL
       AND specialization != ''
       ORDER BY specialization ASC`
    );

    const specializations = result.rows.map(row => row.specialization).filter(Boolean);

    console.log('✓ Especialidades encontradas:', specializations);

    res.json({
      success: true,
      specializations
    });
  } catch (error) {
    console.error('Error obteniendo especialidades:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener especialidades'
    });
  }
});

// Obtener todos los médicos aprobados (sin filtrar por especialidad)
router.get('/public/all-doctors', async (req, res) => {
  try {
    console.log('🔓 Obtener todos los médicos aprobados');
    const result = await query(
      `SELECT d.id, d.name, d.specialization, d.clinic_name, d.phone, d.address, d.latitude, d.longitude, d.booking_fee, d.appointment_price, d.plan_type
       FROM doctors d
       LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
       WHERE d.status = 'approved'
       AND d.subscription_status IN ('active', 'trial')
       AND COALESCE(p.allow_patient_booking, true) = true
       ORDER BY d.name ASC`
    );
    res.json({
      success: true,
      doctors: result.rows
    });
  } catch (error) {
    console.error('Error obtaining all doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener médicos'
    });
  }
});

// Obtener médicos por especialidad
router.get('/public/doctors/:specialization', async (req, res) => {
  try {
    const { specialization } = req.params;

    console.log('🔓 Obtener médicos de especialidad:', specialization);

    const result = await query(
      `SELECT d.id, d.name, d.specialization, d.clinic_name, d.phone, d.address, d.latitude, d.longitude, d.booking_fee, d.appointment_price, d.plan_type
       FROM doctors d
       LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
       WHERE d.status = 'approved'
       AND d.subscription_status IN ('active', 'trial')
       AND COALESCE(p.allow_patient_booking, true) = true
       AND (
         TRIM(LOWER(d.specialization)) = TRIM(LOWER($1))
         OR 
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(d.specialization), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u') = 
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER($1), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')
       )
       ORDER BY d.name ASC`,
      [specialization]
    );

    console.log('✓ Médicos encontrados:', result.rows.length);

    res.json({
      success: true,
      doctors: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo médicos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener médicos'
    });
  }
});

// Obtener disponibilidad de un doctor (Public)
router.get('/public/doctor/:doctorId/availability', async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Verificar si el plan del doctor permite auto-agendamiento
    const planCheck = await query(
      `SELECT p.allow_patient_booking 
       FROM doctors d
       LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
       WHERE d.id = $1`,
      [doctorId]
    );
    if (planCheck.rows.length > 0 && planCheck.rows[0].allow_patient_booking === false) {
      return res.status(403).json({ success: false, message: 'Online booking is disabled for this professional' });
    }
    
    // Obtener días de atención
    const workingDaysResult = await query(
      `SELECT DISTINCT day_of_week FROM doctor_availability 
       WHERE doctor_id = $1 AND is_available = true`,
      [doctorId]
    );
    
    // Obtener vacaciones próximas
    const vacationsResult = await query(
      `SELECT start_date, end_date FROM doctor_vacation 
       WHERE doctor_id = $1 AND (end_date >= CURRENT_DATE OR start_date >= CURRENT_DATE)`,
      [doctorId]
    );

    res.json({
      success: true,
      workingDays: workingDaysResult.rows.map(r => r.day_of_week),
      vacations: vacationsResult.rows
    });
  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({ success: false, message: 'Error al obtener disponibilidad' });
  }
});

// Obtener horarios disponibles para un médico en una fecha y duración
router.get('/public/available-slots/:doctorId/:date', async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const duration = parseInt(req.query.duration) || 30;

    // Verificar si el plan del doctor permite auto-agendamiento
    const planCheck = await query(
      `SELECT p.allow_patient_booking 
       FROM doctors d
       LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
       WHERE d.id = $1`,
      [doctorId]
    );
    if (planCheck.rows.length > 0 && planCheck.rows[0].allow_patient_booking === false) {
      return res.json({ success: true, slots: [] });
    }

    console.log(`🔓 Slots: Doctor ${doctorId}, Fecha ${date}, Duración ${duration}min`);

    const slots = await availabilityService.getNextAvailableSlots(doctorId, date, duration);

    res.json({
      success: true,
      slots: slots || []
    });
  } catch (error) {
    console.error('Error obteniendo horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener horarios disponibles'
    });
  }
});

// Obtener datos de paciente existente por DNI y Doctor ID (Autocompletado público)
router.get('/public/patient-details/:doctorId/:documentNumber', async (req, res) => {
  try {
    const { doctorId, documentNumber } = req.params;

    console.log(`🔓 Buscando datos de paciente por DNI: ${documentNumber} y Doctor: ${doctorId}`);

    const result = await query(
      `SELECT name, email, phone, document_number, document_type, date_of_birth, gender, address, locality, province, insurance_company_id, insurance_plan_id, insurance_policy_number
       FROM patients
       WHERE doctor_id = $1 AND document_number = $2
       LIMIT 1`,
      [doctorId, documentNumber]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Paciente no registrado'
      });
    }

    const patient = result.rows[0];

    res.json({
      success: true,
      patient: {
        name: patient.name,
        lastName: '',
        email: patient.email || '',
        phone: patient.phone || '',
        documentNumber: patient.document_number,
        documentType: patient.document_type || 'DNI',
        dateOfBirth: patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : '',
        gender: patient.gender || '',
        address: patient.address || '',
        locality: patient.locality || '',
        province: patient.province || '',
        insuranceId: patient.insurance_company_id || '',
        insurancePlanId: patient.insurance_plan_id || '',
        insurancePolicyNumber: patient.insurance_policy_number || ''
      }
    });
  } catch (error) {
    console.error('Error obteniendo datos de paciente para autocompletado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar datos del paciente'
    });
  }
});

// ===== RUTAS PÚBLICAS ADICIONALES =====

// Ruta pública para crear una cita (sin autenticación)
router.post('/public/create', async (req, res) => {
  try {
    const {
      doctorId,
      serviceId,
      appointmentDate,
      appointmentTime,
      patientName,
      patientLastName,
      patientEmail,
      patientDocumentNumber,
      patientPhone,
      insuranceId,
      insurancePlanId,
      paymentMethod = 'online', // 'online' o 'cash'
      documentType,
      dateOfBirth,
      gender,
      address,
      locality,
      province,
      insurancePolicyNumber
    } = req.body;

    console.log('📝 Creating public appointment for Doctor ID:', doctorId);

    // ... (validaciones iguales)
    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ success: false, message: 'Faltan datos de la cita' });
    }

    let meetLink = null;

    // Verificar si ya existe una cita en ese horario
    const duplicateCheck = await query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status != 'cancelled'`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'El horario seleccionado ya no está disponible. Por favor elige otro.' 
      });
    }

    // Obtener información del servicio
    let serviceDuration = 30;
    let fullPrice = 0;
    let serviceBookingFee = null;
    let isOnlineService = false;

    if (serviceId) {
      const serviceResult = await query(
        'SELECT duration_minutes, price, booking_fee, is_online FROM services WHERE id = $1 AND doctor_id = $2',
        [serviceId, doctorId]
      );
      if (serviceResult.rows.length > 0) {
        serviceDuration = serviceResult.rows[0].duration_minutes;
        fullPrice = parseFloat(serviceResult.rows[0].price);
        serviceBookingFee = serviceResult.rows[0].booking_fee !== null ? parseFloat(serviceResult.rows[0].booking_fee) : null;
        isOnlineService = serviceResult.rows[0].is_online || false;
      }
    }

    // Verificar doctor y obtener sus límites de plan comercial
    const doctorCheck = await query(
      `SELECT d.id, d.name, d.email, d.booking_fee, d.appointment_price, d.accumulated_debt, d.plan_type, d.commission_rate, p.max_appointments_monthly, p.allow_patient_booking
       FROM doctors d 
       LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
       WHERE d.id = $1 AND d.status = 'approved' AND d.subscription_status IN ('active', 'trial')`,
      [doctorId]
    );

    if (doctorCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Doctor no disponible' });
    const doctor = doctorCheck.rows[0];

    // Verificar si el plan del doctor restringe que los pacientes se agenden solos
    if (doctor.allow_patient_booking === false) {
      return res.status(403).json({
        success: false,
        message: 'Este profesional no tiene habilitado el auto-agendamiento de turnos en línea. Por favor contacta al consultorio directamente.'
      });
    }

    // Verificar si el plan del doctor restringe el número de turnos mensuales
    if (doctor.max_appointments_monthly !== null && doctor.max_appointments_monthly !== undefined) {
      const countRes = await query(
        `SELECT COUNT(*) as count 
         FROM appointments 
         WHERE doctor_id = $1 
           AND status != 'cancelled' 
           AND EXTRACT(MONTH FROM appointment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR FROM appointment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [doctorId]
      );
      const currentCount = parseInt(countRes.rows[0]?.count || 0);

      if (currentCount >= doctor.max_appointments_monthly) {
        return res.status(403).json({
          success: false,
          planRestricted: true,
          message: 'El profesional seleccionado ha alcanzado el límite de turnos mensuales para su plan actual.'
        });
      }
    }

    if (!serviceId) fullPrice = parseFloat(doctor.appointment_price) || 0;
    const bookingFee = serviceBookingFee !== null ? serviceBookingFee : (parseFloat(doctor.booking_fee) || 0);
    
    let insuranceDiscount = 0;
    if (insuranceId) {
      if (insurancePlanId) {
        // A. Usar cobertura específica del plan seleccionado
        const planCheck = await query(
          'SELECT coverage_type, coverage_value FROM insurance_plans WHERE id = $1 AND insurance_company_id = $2',
          [insurancePlanId, insuranceId]
        );
        if (planCheck.rows.length > 0) {
          const plan = planCheck.rows[0];
          if (plan.coverage_type === 'percentage') {
            insuranceDiscount = (fullPrice * parseFloat(plan.coverage_value)) / 100;
          } else {
            insuranceDiscount = parseFloat(plan.coverage_value);
          }
          console.log(`🛡️ Cobertura por Plan encontrada: ${plan.coverage_type} ${plan.coverage_value} (Total: $${insuranceDiscount})`);
        }
      } else {
        // B. Lógica anterior (coberturas por servicio o global)
        if (serviceId) {
          const serviceCoverageCheck = await query(
            'SELECT coverage_type, coverage_value FROM insurance_service_coverage WHERE insurance_company_id = $1 AND service_id = $2 AND is_active = TRUE',
            [insuranceId, serviceId]
          );
          
          if (serviceCoverageCheck.rows.length > 0) {
            const coverage = serviceCoverageCheck.rows[0];
            if (coverage.coverage_type === 'percentage') {
              insuranceDiscount = (fullPrice * parseFloat(coverage.coverage_value)) / 100;
            } else {
              insuranceDiscount = parseFloat(coverage.coverage_value);
            }
            console.log(`🛡️ Cobertura específica encontrada: ${coverage.coverage_type} ${coverage.coverage_value} (Total: $${insuranceDiscount})`);
          } else {
            const insuranceCheck = await query(
              'SELECT additional_fee FROM insurance_companies WHERE id = $1',
              [insuranceId]
            );
            if (insuranceCheck.rows.length > 0) {
              insuranceDiscount = parseFloat(insuranceCheck.rows[0].additional_fee) || 0;
              console.log(`🛡️ Usando cobertura global de obra social: $${insuranceDiscount}`);
            }
          }
        } else {
          const insuranceCheck = await query(
            'SELECT additional_fee FROM insurance_companies WHERE id = $1',
            [insuranceId]
          );
          if (insuranceCheck.rows.length > 0) {
            insuranceDiscount = parseFloat(insuranceCheck.rows[0].additional_fee) || 0;
          }
        }
      }
    }

    const systemFee = doctor.plan_type === 'commission' 
      ? (fullPrice * (parseFloat(doctor.commission_rate || 3) / 100)) 
      : 0;
    let totalToPayNow = (bookingFee + systemFee);
    let isCash = paymentMethod === 'cash';

    // Si es efectivo o cobertura total, el pago inicial es 0
    if (isCash || insuranceDiscount >= fullPrice) {
      totalToPayNow = 0;
    }

    console.log(`🏦 Método: ${paymentMethod} | Deuda a sumar: $${systemFee}`);

    // Si es efectivo, sumamos la comisión a la deuda del médico
    if (isCash) {
      await query(
        'UPDATE doctors SET accumulated_debt = COALESCE(accumulated_debt, 0) + $1 WHERE id = $2',
        [systemFee, doctorId]
      );
    }
    console.log(`💰 Resumen Financiero:
      - Servicio: ${serviceId || 'Base'}
      - Valor Turno: $${fullPrice}
      - Duración: ${serviceDuration}min
      - Cobertura OS: $${insuranceDiscount}
      - Reserva Doctor: $${bookingFee}
      - Comisión Sistema (3%): $${systemFee}
      - Total a pagar ahora: $${totalToPayNow}`);

    // Buscar o crear paciente (específico para este doctor)
    let patientId;
    const patientCheck = await query(
      `SELECT id FROM patients
       WHERE document_number = $1 AND doctor_id = $2`,
      [patientDocumentNumber, doctorId]
    );

    if (patientCheck.rows.length > 0) {
      patientId = patientCheck.rows[0].id;
      // Actualizar datos del paciente si existen cambios
      await query(
        `UPDATE patients
         SET name = $1, 
             phone = COALESCE($2, phone), 
             email = COALESCE($3, email),
             document_type = COALESCE($5, document_type),
             date_of_birth = COALESCE($6, date_of_birth),
             gender = COALESCE($7, gender),
             address = COALESCE($8, address),
             locality = COALESCE($9, locality),
             province = COALESCE($10, province),
             insurance_company_id = COALESCE($11, insurance_company_id),
             insurance_plan_id = COALESCE($12, insurance_plan_id),
             insurance_policy_number = COALESCE($13, insurance_policy_number)
         WHERE id = $4`,
        [
          (patientName + ' ' + (patientLastName || '')).trim(),
          patientPhone || null,
          patientEmail || null,
          patientId,
          documentType || null,
          dateOfBirth || null,
          gender || null,
          address || null,
          locality || null,
          province || null,
          insuranceId || null,
          insurancePlanId || null,
          insurancePolicyNumber || null
        ]
      );
    } else {
      // Crear nuevo paciente asociado al doctor
      const newPatientResult = await query(
        `INSERT INTO patients (
           name, phone, email, document_number, doctor_id,
           document_type, date_of_birth, gender, address, locality, province,
           insurance_company_id, insurance_plan_id, insurance_policy_number
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          (patientName + ' ' + (patientLastName || '')).trim(),
          patientPhone || null,
          patientEmail || null,
          patientDocumentNumber,
          doctorId,
          documentType || 'DNI',
          dateOfBirth || null,
          gender || null,
          address || null,
          locality || null,
          province || null,
          insuranceId || null,
          insurancePlanId || null,
          insurancePolicyNumber || null
        ]
      );
      patientId = newPatientResult.rows[0].id;
    }

    const appointmentResult = await query(
      `INSERT INTO appointments (
        doctor_id,
        patient_id,
        appointment_date,
        appointment_time,
        status,
        insurance_company_id,
        insurance_plan_id,
        total_amount,
        system_fee,
        payment_status,
        appointment_code,
        total_price,
        booking_fee_paid,
        coverage_amount,
        service_id,
        duration_minutes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, appointment_date, appointment_time, total_amount, appointment_code`,
      [
        doctorId,
        patientId,
        appointmentDate,
        appointmentTime,
        totalToPayNow > 0 ? 'pending_payment' : 'pending',
        insuranceId || null,
        insurancePlanId || null,
        totalToPayNow,
        systemFee,
        (isCash || totalToPayNow > 0) ? 'pending' : 'paid',
        generateShortCode(),
        fullPrice,
        (isCash || totalToPayNow > 0) ? 0 : bookingFee,
        insuranceDiscount,
        serviceId || null,
        serviceDuration
      ]
    );

    const appointment = appointmentResult.rows[0];

    console.log('✓ Cita pendiente creada:', appointment.id);

    // Si el pago es 0 (Cobertura Total), notificamos al médico de inmediato para que apruebe
    if (totalToPayNow === 0) {
      try {
        notifyDoctor(doctorId, {
          appointmentId: appointment.id,
          patientName: `${patientName} ${patientLastName}`,
          appointmentTime: appointmentTime,
          appointmentDate: appointmentDate,
          message: '¡Tienes una nueva solicitud de turno (Cobertura 100%)!'
        });
      } catch (wsErr) {
        console.error('Error enviando notificación WS:', wsErr.message);
      }

      // NOTIFICAR POR EMAIL (Cobertura Total) - SIN AWAIT para no bloquear al usuario
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/appointments`;
      let serviceLabel = 'Consulta General';
      if (serviceId) {
        const srvRes = await query('SELECT name FROM services WHERE id = $1', [serviceId]);
        if (srvRes.rows.length > 0) serviceLabel = srvRes.rows[0].name;
      }

      sendNewAppointmentNotificationToDoctor({
        to: doctor.email,
        doctorName: doctor.name,
        patientName: `${patientName} ${patientLastName}`,
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime,
        serviceName: serviceLabel,
        dashboardUrl: dashboardUrl
      }).catch(err => console.error("Error asíncrono enviando email al doctor:", err));

      // Integración con Google Calendar (Solo si NO es consulta online)
      if (!isOnlineService) {
        try {
          const { createCalendarEvent } = await import('../services/googleCalendarService.js');
          const calResult = await createCalendarEvent(doctorId, {
            ...appointment,
            patient_id: patientId,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            reason_for_visit: serviceLabel || 'Consulta Presencial',
            is_online: false
          });
          meetLink = calResult?.meetLink || null;
          if (meetLink) console.log('🎥 Meet link obtenido:', meetLink);
          else console.log('📅 Evento de calendario creado para turno presencial');
        } catch (err) {
          console.error('⚠️ Error en Google Calendar:', err.message);
        }
      } else {
        console.log('🎥 Cita online detectada. El evento de calendario y meet link se generarán al ser aceptada por el doctor.');
      }

      // NOTIFICAR AL PACIENTE (Cobertura Total / Efectivo)
      sendAppointmentConfirmation({
        to: patientEmail,
        patientName: `${patientName} ${patientLastName}`,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialization,
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime,
        appointmentCode: appointment.appointment_code,
        confirmUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient/appointment/${appointment.id}`,
        meetLink: meetLink
      }).catch(err => console.error("Error asíncrono enviando email al paciente:", err));

      console.log('✅ Cobertura total/Efectivo detectada: Turno notificado a ambos por mail.');
    } else {
      console.log('⏳ Cita en espera de pago. No se notifica al doctor todavía.');
    }

    // Guardar meetLink en DB si existe
    if (typeof meetLink !== 'undefined' && meetLink) {
      await query('UPDATE appointments SET meet_link = $1 WHERE id = $2', [meetLink, appointment.id]);
    }

    // Generar Preferencia de Mercado Pago si hay montos a cobrar
    let initPoint = null;
    if (totalToPayNow > 0) {
      const doctorTokens = await query('SELECT mp_access_token FROM doctors WHERE id = $1', [doctorId]);
      const mpToken = doctorTokens.rows[0]?.mp_access_token;

      if (mpToken) {
        try {
          const mpPreference = await mpService.createMPPreference({
            appointmentId: appointment.id,
            total_amount: totalToPayNow,
            system_fee: systemFee,
            doctorName: doctor.name
          }, mpToken);
          initPoint = mpPreference.init_point;
          console.log('💳 Preferencia MP creada:', mpPreference.id);
        } catch (mpError) {
          console.error('⚠️ Error creando preferencia MP:', mpError.message);
          
          // ROLLBACK MANUALLY: Eliminar el turno "fantasma" que se atoró
          try {
            await query('DELETE FROM appointments WHERE id = $1', [appointment.id]);
            console.log('🧹 Turno fallido eliminado exitosamente.');
          } catch (delError) {
            console.error('Error eliminando turno fallido:', delError.message);
          }

          return res.status(400).json({
            success: false,
            message: 'Error al iniciar el proceso de pago. Por favor intenta nuevamente.'
          });
        }
      }
    }

    // Notificar al doctor via WebSocket (para todos los casos que no fueron Cobertura 100%)
    if (totalToPayNow > 0) {
      try {
        notifyDoctor(doctorId, {
          appointmentId: appointment.id,
          patientName: `${patientName} ${patientLastName}`,
          appointmentTime: appointmentTime,
          appointmentDate: appointmentDate,
          message: '¡Tienes una nueva solicitud de turno!'
        });
      } catch (wsError) {
        console.error('⚠️ Error enviando notificación WS:', wsError.message);
      }
    }

    res.json({
      success: true,
      message: totalToPayNow === 0 ? '¡Turno agendado exitosamente!' : (initPoint ? 'Turno reservado. Redirigiendo a pago...' : 'Turno reservado. Pendiente de pago.'),
      appointment: {
        id: appointment.id,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
        totalAmount: appointment.total_amount,
        status: totalToPayNow > 0 ? 'pending_payment' : 'pending',
        doctorName: doctor.name,
        clinicName: doctor.clinic_name,
        address: doctor.address,
        isOnline: isOnlineService,
        meetLink: meetLink || null
      },
      paymentRequired: !!initPoint,
      initPoint: initPoint
    });
  } catch (error) {
    console.error('Error creando cita pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agendar el turno'
    });
  }
});

// Ruta pública para buscar por datos del paciente (sin autenticación)
router.post('/public/search', async (req, res) => {
  try {
    const { name, lastName, documentNumber, doctorId } = req.body;

    // Validar doctorId (ahora requerido para precisión)
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar el profesional / local'
      });
    }

    // Validar que al menos un dato del paciente esté completo
    if ((!name || name.length < 2) && (!lastName || lastName.length < 2) && !documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Debes ingresar al menos un dato: nombre, apellido o documento'
      });
    }

    console.log('🔓 Búsqueda pública de cita por:', { name, lastName, documentNumber, doctorId });

    let params = [doctorId];
    let paramIndex = 2;
    let patientConditions = [];
    if (name && name.length >= 2) {
      patientConditions.push(`LOWER(p.name) LIKE LOWER($${paramIndex})`);
      params.push(`%${name}%`);
      paramIndex++;
    }

    if (lastName && lastName.length >= 2) {
      patientConditions.push(`LOWER(p.name) LIKE LOWER($${paramIndex})`);
      params.push(`%${lastName}%`);
      paramIndex++;
    }

    if (documentNumber && documentNumber.length > 0) {
      patientConditions.push(`LOWER(p.document_number) LIKE LOWER($${paramIndex})`);
      params.push(`%${documentNumber}%`);
      paramIndex++;
    }

    const patientClause = patientConditions.length > 0
      ? `AND (${patientConditions.join(' AND ')})`
      : '';

    console.log('🔓 Ejecutando búsqueda SQL con params:', params);

    // Buscar citas programadas o recientes del paciente
    const result = await query(
      `SELECT
        a.id,
        a.doctor_id,
        a.appointment_date,
        a.appointment_time,
        a.reason_for_visit,
        a.status,
        a.delay_minutes,
        a.delay_reason,
        a.meet_link,
        p.name as patient_name,
        p.phone as patient_phone,
        p.email as patient_email,
        d.name as doctor_name,
        d.specialization as doctor_specialization,
        s.is_online,
        ic.name as insurance_name,
        ip.name as insurance_plan_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN insurance_companies ic ON a.insurance_company_id = ic.id
      LEFT JOIN insurance_plans ip ON a.insurance_plan_id = ip.id
      WHERE a.doctor_id = $1 ${patientClause}
      AND a.status IN ('scheduled', 'pending', 'pending_payment', 'completed')
      ORDER BY 
        CASE 
          WHEN a.appointment_date = CURRENT_DATE THEN 0
          WHEN a.appointment_date > CURRENT_DATE THEN 1
          ELSE 2
        END ASC,
        CASE 
          WHEN a.appointment_date >= CURRENT_DATE THEN (a.appointment_date - CURRENT_DATE)
          ELSE (CURRENT_DATE - a.appointment_date)
        END ASC,
        a.appointment_time ASC
      LIMIT 1`,
      params
    );

    console.log('✓ Resultados de búsqueda:', result.rows.length);

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No se encontró ninguna cita con esos datos. Verifica que el nombre o DNI coincidan con los usados al agendar.'
      });
    }

    const appointment = result.rows[0];

    // Obtener todos los turnos activos del médico para ese día
    const queueResult = await query(
      `SELECT id, appointment_time, status, delay_minutes 
       FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND status IN ('scheduled', 'pending', 'pending_payment')
       ORDER BY appointment_time ASC`,
      [appointment.doctor_id, appointment.appointment_date]
    );

    const queueList = queueResult.rows;
    const myTime = appointment.appointment_time;
    const appointmentsBeforeMe = queueList.filter(app => app.appointment_time < myTime);

    appointment.appointments_before = appointmentsBeforeMe.length;
    appointment.queue_before = appointmentsBeforeMe;

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Error buscando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar la cita'
    });
  }
});

// Ruta pública para verificación activa de pago manual (fallback si ngrok está offline)
router.post('/public/verify-payment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // 1. Obtener la cita
    const appointmentResult = await query('SELECT doctor_id, status FROM appointments WHERE id = $1', [appointmentId]);
    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Turno no encontrado' });
    }
    const appointment = appointmentResult.rows[0];
    if (appointment.status !== 'pending_payment') {
      return res.json({ success: true, status: appointment.status, message: 'El turno ya fue procesado o confirmado previamente.' });
    }

    // 2. Obtener el token de Mercado Pago y datos del médico
    const doctorResult = await query('SELECT name, email, mp_access_token FROM doctors WHERE id = $1', [appointment.doctor_id]);
    const mpToken = doctorResult.rows[0]?.mp_access_token;
    const doctor = doctorResult.rows[0];
    if (!mpToken) {
      return res.status(400).json({ success: false, message: 'El doctor no tiene Mercado Pago configurado.' });
    }

    console.log(`🔍 Verificando manualmente pagos en MP para el turno: ${appointmentId}`);

    // 3. Buscar pagos en Mercado Pago asociados a esta referencia externa
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/search?external_reference=${appointmentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });

    const payments = response.data.results || [];
    const approvedPayment = payments.find(p => p.status === 'approved');

    if (approvedPayment) {
      console.log('✅ Pago encontrado aprobado en la revisión manual. Confirmando cita...', approvedPayment.id);
      
      // Actualizar a pagado y notificar
      await query(
        `UPDATE appointments 
         SET status = 'pending', payment_status = 'paid', booking_fee_paid = (total_amount - system_fee), updated_at = NOW() 
         WHERE id = $1`,
        [appointmentId]
      );
      
      // Notificar al médico por WebSocket
      wss.notifyDoctor(appointment.doctor_id, {
        type: 'NEW_APPOINTMENT',
        message: '¡Cita Pagada (Verificación Activa)! Tienes un nuevo turno confirmado.',
        appointmentId: appointmentId
      });

      // NOTIFICAR POR EMAIL (Pago Verificado Manualmente)
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/appointments`;
      
      // Obtener datos del turno y paciente para el email
      const apptDataResult = await query(
        `SELECT a.appointment_date, a.appointment_time, a.appointment_code, p.name as patient_name, p.email as patient_email, s.name as service_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         LEFT JOIN services s ON a.service_id = s.id
         WHERE a.id = $1`,
        [appointmentId]
      );

      if (apptDataResult.rows.length > 0) {
        const ad = apptDataResult.rows[0];
        sendNewAppointmentNotificationToDoctor({
          to: doctor.email,
          doctorName: doctor.name,
          patientName: ad.patient_name,
          appointmentDate: ad.appointment_date,
          appointmentTime: ad.appointment_time,
          serviceName: ad.service_name || 'Consulta General',
          dashboardUrl: dashboardUrl
        }).catch(err => console.error("Error asíncrono email doctor:", err));

        // Notificar al paciente por Email (Pago Verificado)
        sendAppointmentConfirmation({
          to: ad.patient_email,
          patientName: ad.patient_name,
          doctorName: doctor.name,
          doctorSpecialty: doctor.specialization,
          appointmentDate: ad.appointment_date,
          appointmentTime: ad.appointment_time,
          appointmentCode: ad.appointment_code,
          confirmUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient/appointment/${appointmentId}`
        }).catch(err => console.error("Error asíncrono email paciente:", err));
      }

      return res.json({ success: true, status: 'pending', message: '¡Pago verificado y turno confirmado exitosamente!' });
    } else {
      console.log('⏳ Aún no se registra el pago aprobado en MP para el turno:', appointmentId);
      return res.json({ success: false, message: 'El pago aún no se ha reflejado. Intenta de nuevo en unos segundos.' });
    }

  } catch (error) {
    console.error('Error verificando pago activamente:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Fallo al verificar el pago con Mercado Pago' });
  }
});

// Ruta pública para confirmar cita (sin autenticación)
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔓 Acceso público a cita con token:', token.substring(0, 8) + '...');

    const result = await query(
      `SELECT
        a.id,
        a.doctor_id,
        a.appointment_date,
        a.appointment_time,
        a.reason_for_visit,
        a.status,
        a.delay_minutes,
        a.delay_reason,
        a.meet_link,
        p.name as patient_name,
        p.phone as patient_phone,
        p.document_number as patient_dni,
        d.name as doctor_name,
        d.specialization as doctor_specialization,
        s.is_online,
        ic.name as insurance_name,
        ip.name as insurance_plan_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN insurance_companies ic ON a.insurance_company_id = ic.id
      LEFT JOIN insurance_plans ip ON a.insurance_plan_id = ip.id
      WHERE a.confirmation_token::text = $1 OR a.id::text = $1 OR a.appointment_code = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointment = result.rows[0];
    console.log('✓ Cita encontrada:', appointment.patient_name);

    // Obtener todos los turnos activos del médico para ese día
    const queueResult = await query(
      `SELECT id, appointment_time, status, delay_minutes 
       FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND status IN ('scheduled', 'pending', 'pending_payment')
       ORDER BY appointment_time ASC`,
      [appointment.doctor_id, appointment.appointment_date]
    );

    const queueList = queueResult.rows;
    const myTime = appointment.appointment_time;
    const appointmentsBeforeMe = queueList.filter(app => app.appointment_time < myTime);

    appointment.appointments_before = appointmentsBeforeMe.length;
    appointment.queue_before = appointmentsBeforeMe;

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Error obteniendo cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la cita'
    });
  }
});

// ===== RUTAS DE SISTEMA (API Key) =====
router.get('/system/next-day', verifyApiKey, appointmentController.getNextDayAppointmentsSystem);

// ===== RUTAS PROTEGIDAS PARA DOCTORES =====

// Todas las rutas de este router requieren token de doctor y suscripción activa
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

router.post('/', appointmentController.createAppointment);
router.get('/', appointmentController.getAppointments);
router.get('/today', appointmentController.getTodayAppointments);
router.get('/available-slots', appointmentController.getAvailableSlots);
router.get('/statistics', appointmentController.getStatistics);
router.get('/proximos', appointmentController.getProximosTurnos);
router.get('/:appointmentId', appointmentController.getAppointment);
router.patch('/:appointmentId', appointmentController.updateAppointment);
router.delete('/:appointmentId', appointmentController.cancelAppointment);

// Aceptar una cita pendiente (doctor aprueba la solicitud)
router.patch('/:appointmentId/accept', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user.id;

    // Verificar que el doctor es el propietario de la cita
    const appointmentCheck = await query(
      `SELECT a.status, a.doctor_id, a.appointment_date, a.appointment_time,
              p.name as patient_name, p.email as patient_email,
              d.name as doctor_name, d.specialization as doctor_specialization,
              a.appointment_code, a.patient_id, a.meet_link,
              s.is_online, s.name as service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointmentData = appointmentCheck.rows[0];

    if (appointmentData.doctor_id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para aceptar esta cita'
      });
    }

    if (appointmentData.status === 'scheduled') {
      // Si ya estaba programada (ej. por un clic anterior que falló en la UI), 
      // devolvemos éxito para que la UI se sincronice
      return res.json({
        success: true,
        message: 'La cita ya se encontraba aceptada',
        appointment: appointmentData
      });
    }

    if (appointmentData.status !== 'pending' && appointmentData.status !== 'pending_payment') {
      console.log(`⚠️ Intentando aceptar cita ${appointmentId} pero el estado actual es: '${appointmentData.status}'`);
      return res.status(400).json({
        success: false,
        message: 'Esta cita no está pendiente de aprobación o pago (Estado actual: ' + appointmentData.status + ')'
      });
    }

    // Cambiar status a 'scheduled'
    const result = await query(
      `UPDATE appointments
       SET status = 'scheduled',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, status`,
      [appointmentId]
    );

    console.log('✓ Cita aceptada:', appointmentId);

    // Integración diferida con Google Calendar si la consulta es online
    let meetLink = appointmentData.meet_link || null;
    if (appointmentData.is_online) {
      try {
        const { createCalendarEvent } = await import('../services/googleCalendarService.js');
        const calResult = await createCalendarEvent(doctorId, {
          id: appointmentId,
          patient_id: appointmentData.patient_id,
          appointment_date: appointmentData.appointment_date,
          appointment_time: appointmentData.appointment_time,
          reason_for_visit: appointmentData.service_name ? `🎥 Consulta Online: ${appointmentData.service_name}` : '🎥 Consulta Online',
          is_online: true
        });
        meetLink = calResult?.meetLink || null;
        if (meetLink) {
          console.log('🎥 Meet link generado en la aceptación:', meetLink);
        } else {
          console.log('📅 Evento de calendario creado al aceptar (sin link generado)');
        }
      } catch (err) {
        console.error('⚠️ Error en Google Calendar al aceptar la cita:', err.message);
      }
    }

    // Enviar email de confirmación al paciente de manera asíncrona
    if (appointmentData.patient_email) {
      sendAppointmentConfirmation({
        to: appointmentData.patient_email,
        patientName: appointmentData.patient_name,
        doctorName: appointmentData.doctor_name,
        doctorSpecialty: appointmentData.doctor_specialization,
        appointmentDate: appointmentData.appointment_date,
        appointmentTime: appointmentData.appointment_time,
        appointmentCode: appointmentData.appointment_code,
        confirmUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient/appointment/${appointmentId}`,
        meetLink: meetLink
      }).catch(err => console.error('Error asíncrono enviando confirmación:', err));
      console.log('📧 Email de confirmación programado para:', appointmentData.patient_email);
    }

    res.json({
      success: true,
      message: 'Cita aceptada y confirmada al paciente',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error aceptando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aceptar la cita'
    });
  }
});

// Rechazar una cita pendiente (doctor rechaza la solicitud)
router.patch('/:appointmentId/reject', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const doctorId = req.user.id;

    // Verificar que el doctor es el propietario de la cita
    const appointmentCheck = await query(
      `SELECT a.status, a.doctor_id, a.appointment_date, a.appointment_time,
              p.name as patient_name, p.email as patient_email,
              d.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointmentData = appointmentCheck.rows[0];

    console.log(`🔍 Intentando rechazar cita ${appointmentId}. Doctor solicitante: ${doctorId}. Doctor cita: ${appointmentData.doctor_id}. Estado actual: ${appointmentData.status}`);

    if (appointmentData.doctor_id !== doctorId) {
      console.log('❌ Rechazo denegado: ID de doctor no coincide');
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para rechazar esta cita'
      });
    }

    if (appointmentData.status === 'rejected') {
      return res.json({
        success: true,
        message: 'La cita ya se encontraba rechazada',
        appointment: appointmentData
      });
    }

    if (appointmentData.status !== 'pending' && appointmentData.status !== 'pending_payment' && appointmentData.status !== 'scheduled') {
      console.log(`❌ Rechazo denegado: Estado '${appointmentData.status}' no permitido`);
      return res.status(400).json({
        success: false,
        message: 'Esta cita no está en un estado que permita rechazo (Estado actual: ' + appointmentData.status + ')'
      });
    }

    // Cambiar status a 'rejected'
    const result = await query(
      `UPDATE appointments
       SET status = 'rejected',
           notes = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, status`,
      [reason || null, appointmentId]
    );

    console.log('✗ Cita rechazada:', appointmentId);

    // Enviar email de rechazo al paciente de manera asíncrona
    if (appointmentData.patient_email) {
      sendAppointmentRejectionEmail({
        to: appointmentData.patient_email,
        patientName: appointmentData.patient_name,
        doctorName: appointmentData.doctor_name,
        appointmentDate: appointmentData.appointment_date,
        appointmentTime: appointmentData.appointment_time,
        reason: reason || null
      }).catch(err => console.error('Error asíncrono enviando rechazo:', err));
      console.log('📧 Email de rechazo programado para:', appointmentData.patient_email);
    }

    res.json({
      success: true,
      message: 'Cita rechazada y paciente notificado',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error rechazando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar la cita'
    });
  }
});

// Actualizar retraso de cita
router.patch('/:appointmentId/delay', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { delay_minutes, delay_reason } = req.body;
    const doctorId = req.user.id;

    // Validar que el doctor es el propietario de la cita
    const appointmentCheck = await query(
      `SELECT a.doctor_id, a.appointment_time, p.name as patient_name, p.email as patient_email, d.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointmentData = appointmentCheck.rows[0];

    if (appointmentData.doctor_id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar esta cita'
      });
    }

    // Actualizar el retraso
    const result = await query(
      `UPDATE appointments
       SET delay_minutes = $1,
           delay_reason = $2,
           delayed_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, appointment_time, delay_minutes, delay_reason, patient_id`,
      [delay_minutes || 0, delay_reason || null, appointmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error al actualizar la cita'
      });
    }

    const appointment = result.rows[0];

    // Enviar notificación por email al paciente
    if (appointmentData.patient_email && delay_minutes > 0) {
      await sendDelayNotification({
        to: appointmentData.patient_email,
        patientName: appointmentData.patient_name,
        doctorName: appointmentData.doctor_name,
        appointmentTime: appointmentData.appointment_time,
        delayMinutes: delay_minutes
      });
    }

    res.json({
      success: true,
      message: `Retraso actualizado: +${delay_minutes} minutos`,
      appointment
    });
  } catch (error) {
    console.error('Error actualizando retraso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el retraso'
    });
  }
});

// Cancelar cita por parte del paciente (público) - Límite 24hs antes
router.post('/public/:token/cancel', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔓 Solicitud de cancelación pública para token:', token.substring(0, 8) + '...');

    // Buscar la cita y obtener fecha/hora
    const result = await query(
      `SELECT id, appointment_date, appointment_time, status, doctor_id
       FROM appointments 
       WHERE confirmation_token::text = $1 OR id::text = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const appointment = result.rows[0];

    if (appointment.status !== 'scheduled' && appointment.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Esta cita no puede ser cancelada porque ya está en estado: ' + appointment.status 
      });
    }

    // Validar límite de 24 horas
    const apptDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    const diffHours = (apptDateTime - now) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar el turno con menos de 24 horas de antelación. Por favor, comunícate directamente con la clínica.'
      });
    }

    // Cancelar la cita
    await query(
      `UPDATE appointments 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [appointment.id]
    );

    console.log('✓ Cita cancelada por el paciente:', appointment.id);

    res.json({
      success: true,
      message: 'Tu turno ha sido cancelado exitosamente.'
    });
  } catch (error) {
    console.error('Error cancelando cita pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la cancelación'
    });
  }
});

export default router;
