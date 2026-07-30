import { query, transaction } from '../db/config.js';
import { sendWhatsAppConfirmationServer } from './whatsappService.js';
import { broadcastToDoctor, broadcastToAppointment } from '../websocket/server.js';

/**
 * Obtener la cola activa de hoy para un profesional
 */
export const getDoctorQueueStatus = async (doctorId) => {
  const doctorRes = await query(
    `SELECT id, name, specialization, clinic_name, phone, address, allow_self_queue FROM doctors WHERE id = $1`,
    [doctorId]
  );
  const doctor = doctorRes.rows[0];
  if (!doctor) throw new Error('Profesional no encontrado');

  const result = await query(
    `SELECT q.*, s.name as service_title, s.duration_minutes
     FROM waiting_queue q
     LEFT JOIN doctor_services s ON q.service_id = s.id
     WHERE q.doctor_id = $1 
     AND DATE(q.joined_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
     AND q.status IN ('waiting', 'in_progress', 'completed', 'skipped')
     ORDER BY q.ticket_number ASC`,
    [doctorId]
  );

  const allEntries = result.rows;
  const inProgress = allEntries.find(e => e.status === 'in_progress') || null;
  const waitingList = allEntries.filter(e => e.status === 'waiting');
  const completedList = allEntries.filter(e => e.status === 'completed');

  // Calcular tiempo promedio estimado por paciente (default 15 mins)
  const avgDuration = 15;

  // Añadir posición calculada y tiempo estimado a la lista de espera
  const enrichedWaitingList = waitingList.map((item, index) => ({
    ...item,
    position: index + 1,
    estimated_wait_minutes: (index + 1) * avgDuration
  }));

  return {
    doctor,
    inProgress,
    waitingList: enrichedWaitingList,
    completedCount: completedList.length,
    totalTodayCount: allEntries.length
  };
};

/**
 * Agregar paciente a la fila virtual de hoy
 */
export const addToQueue = async (doctorId, data) => {
  const { patientId, patientName, patientPhone, patientEmail, serviceId, serviceName, notes } = data;

  if (!patientName || !patientName.trim()) {
    throw new Error('El nombre del paciente es obligatorio.');
  }

  return await transaction(async (client) => {
    // Obtener número correlativo de ticket para hoy
    const ticketRes = await client.query(
      `SELECT COALESCE(MAX(ticket_number), 0) + 1 as next_num 
       FROM waiting_queue 
       WHERE doctor_id = $1 
       AND DATE(joined_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')`,
      [doctorId]
    );
    const nextTicketNum = parseInt(ticketRes.rows[0].next_num);
    const ticketCode = `#${String(nextTicketNum).padStart(2, '0')}`;

    // Obtener nombre del servicio si vino serviceId
    let finalServiceName = serviceName || '';
    if (serviceId && !finalServiceName) {
      const sRes = await client.query(`SELECT name FROM doctor_services WHERE id = $1`, [serviceId]);
      if (sRes.rows[0]) finalServiceName = sRes.rows[0].name;
    }

    const insertRes = await client.query(
      `INSERT INTO waiting_queue (
        doctor_id, patient_id, ticket_number, ticket_code, patient_name, patient_phone, patient_email, service_id, service_name, notes, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'waiting')
       RETURNING *`,
      [doctorId, patientId || null, nextTicketNum, ticketCode, patientName.trim(), patientPhone || null, patientEmail || null, serviceId || null, finalServiceName, notes || null]
    );

    const newEntry = insertRes.rows[0];

    // Notificar en tiempo real al panel del profesional por WebSocket
    broadcastToDoctor(doctorId, {
      type: 'queue_updated',
      action: 'patient_added',
      entry: newEntry
    });

    return newEntry;
  });
};

/**
 * Llamar al siguiente paciente de la fila
 */
export const callNextPatient = async (doctorId) => {
  const status = await getDoctorQueueStatus(doctorId);
  
  if (status.waitingList.length === 0) {
    throw new Error('No hay pacientes esperando en la fila.');
  }

  const nextPatient = status.waitingList[0];

  return await transaction(async (client) => {
    // Si había alguien en atención, marcarlo completado
    if (status.inProgress) {
      await client.query(
        `UPDATE waiting_queue SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [status.inProgress.id]
      );
    }

    // Pasar el siguiente paciente a 'in_progress'
    const updateRes = await client.query(
      `UPDATE waiting_queue SET status = 'in_progress', called_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [nextPatient.id]
    );
    const calledPatient = updateRes.rows[0];

    // Si el paciente tiene teléfono registrado, intentar enviar aviso por WhatsApp
    if (calledPatient.patient_phone) {
      try {
        console.log(`📧 Enviando aviso de turno llamado por WhatsApp a: ${calledPatient.patient_phone}`);
        await sendWhatsAppConfirmationServer({
          phone: calledPatient.patient_phone,
          patientName: calledPatient.patient_name,
          doctorName: status.doctor.name,
          serviceName: calledPatient.service_name || 'Consulta',
          appointmentDate: new Date().toISOString().split('T')[0],
          appointmentTime: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          customMessage: `¡Hola ${calledPatient.patient_name}! Es tu turno con ${status.doctor.name}. Por favor pasa al consultorio.`
        });
      } catch (wsErr) {
        console.error('Error enviando aviso WhatsApp de turno llamado:', wsErr);
      }
    }

    // Transmitir por WebSocket al canal del profesional y del paciente en vivo
    broadcastToDoctor(doctorId, {
      type: 'queue_updated',
      action: 'patient_called',
      calledPatient
    });

    if (calledPatient.tracking_token) {
      broadcastToAppointment(calledPatient.tracking_token, {
        type: 'your_turn_now',
        calledPatient
      });
    }

    return calledPatient;
  });
};

/**
 * Finalizar la atención del paciente actual o específico
 */
export const completePatient = async (doctorId, queueId) => {
  const res = await query(
    `UPDATE waiting_queue 
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND doctor_id = $2 
     RETURNING *`,
    [queueId, doctorId]
  );
  if (!res.rows[0]) throw new Error('Registro no encontrado');

  broadcastToDoctor(doctorId, {
    type: 'queue_updated',
    action: 'patient_completed',
    completedPatient: res.rows[0]
  });

  return res.rows[0];
};

/**
 * Saltear o cancelar un paciente de la fila
 */
export const skipPatient = async (doctorId, queueId, action = 'skipped') => {
  const newStatus = action === 'cancel' ? 'cancelled' : 'skipped';
  const res = await query(
    `UPDATE waiting_queue 
     SET status = $1, completed_at = CURRENT_TIMESTAMP 
     WHERE id = $2 AND doctor_id = $3 
     RETURNING *`,
    [newStatus, queueId, doctorId]
  );
  if (!res.rows[0]) throw new Error('Registro no encontrado');

  broadcastToDoctor(doctorId, {
    type: 'queue_updated',
    action: 'patient_skipped',
    skippedPatient: res.rows[0]
  });

  return res.rows[0];
};

/**
 * Obtener seguimiento en vivo para el paciente mediante trackingToken
 */
export const getPatientTrackingStatus = async (trackingToken) => {
  const res = await query(
    `SELECT q.*, d.name as doctor_name, d.specialization as doctor_specialization, d.clinic_name, d.address as doctor_address, d.phone as doctor_phone
     FROM waiting_queue q
     JOIN doctors d ON q.doctor_id = d.id
     WHERE q.tracking_token = $1`,
    [trackingToken]
  );
  const entry = res.rows[0];
  if (!entry) throw new Error('Ticket no encontrado o inválido');

  if (entry.status === 'in_progress') {
    return {
      entry,
      status: 'in_progress',
      position: 0,
      aheadCount: 0,
      estimatedWaitMinutes: 0,
      message: '¡ES TU TURNO! Por favor ingresa al consultorio/establecimiento.'
    };
  }

  if (entry.status === 'completed') {
    return {
      entry,
      status: 'completed',
      position: 0,
      aheadCount: 0,
      estimatedWaitMinutes: 0,
      message: 'Tu atención ha sido completada. ¡Muchas gracias!'
    };
  }

  if (entry.status === 'skipped' || entry.status === 'cancelled') {
    return {
      entry,
      status: entry.status,
      position: 0,
      aheadCount: 0,
      estimatedWaitMinutes: 0,
      message: 'Este turno ha sido cancelado o postergado.'
    };
  }

  // Si está en espera, calcular cuántos pacientes tiene adelante
  const aheadRes = await query(
    `SELECT COUNT(*) as count 
     FROM waiting_queue 
     WHERE doctor_id = $1 
     AND DATE(joined_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
     AND status = 'waiting'
     AND ticket_number < $2`,
    [entry.doctor_id, entry.ticket_number]
  );
  const aheadCount = parseInt(aheadRes.rows[0].count || 0);
  const position = aheadCount + 1;
  const estimatedWaitMinutes = position * 15;

  return {
    entry,
    status: 'waiting',
    position,
    aheadCount,
    estimatedWaitMinutes,
    message: aheadCount === 0 ? 'Eres el próximo en la fila.' : `Faltan ${aheadCount} persona(s) antes que tú.`
  };
};
