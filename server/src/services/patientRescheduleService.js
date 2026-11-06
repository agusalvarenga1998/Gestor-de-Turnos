import { query, transaction, afterCommit } from '../db/config.js';
import { requireUuid, calendarDate, httpError } from '../utils/validation.js';
import { validatePatientReschedule } from '../utils/rescheduleValidation.js';
import { getNextAvailableSlots, isAvailableAt } from './availabilityService.js';
import { enqueueEmail } from './emailOutbox.js';
import { updateCalendarEvent } from './googleCalendarService.js';
import { notifyDoctor } from '../websocket/server.js';
import { notifyWaitlistForSlot } from './waitlistService.js';

async function findAppointment(token, lock = false) {
  requireUuid(token, 'Enlace de turno');
  const appointment = (await query(`SELECT a.*, d.status AS doctor_status, d.subscription_status,
      d.subscription_expires_at, d.trial_ends_at, d.email AS doctor_email, d.name AS doctor_name,
      CASE WHEN a.booking_contact IS NULL THEN p.email ELSE a.booking_contact->>'email' END AS patient_email
    FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN patients p ON p.id=a.patient_id
    WHERE a.portal_token::text=lower($1) OR a.confirmation_token::text=lower($1)
      OR (a.appointment_code ~* '^[0-9a-f-]{36}$' AND lower(a.appointment_code)=lower($1))
    ${lock ? 'FOR UPDATE OF a' : ''}`, [token])).rows[0];
  if (!appointment) throw httpError('Turno no encontrado.', 404);
  return appointment;
}

function checkDoctor(appointment) {
  const expiration = appointment.subscription_status === 'trial' ? appointment.trial_ends_at : appointment.subscription_expires_at;
  if (appointment.doctor_status !== 'approved' || !['active', 'trial'].includes(appointment.subscription_status) || (expiration && Date.parse(expiration) <= Date.now())) throw httpError('El profesional no está disponible para cambios online. Comunicate con el consultorio.', 409);
}

export async function getPatientRescheduleSlots(token, date) {
  calendarDate(date);
  const appointment = await findAppointment(token);
  validatePatientReschedule(appointment);
  checkDoctor(appointment);
  const slots = await getNextAvailableSlots(appointment.doctor_id, date, appointment.duration_minutes || 30, appointment.id);
  return slots.filter(time => {
    try { validatePatientReschedule(appointment, date, time); return true; } catch { return false; }
  });
}

export async function reschedulePatientAppointment(token, date, time) {
  calendarDate(date);
  const reference = await findAppointment(token);
  return transaction(async () => {
    // Mismo bloqueo que las reservas, para impedir que dos pacientes ocupen el mismo horario.
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`booking:${reference.doctor_id}`]);
    const appointment = await findAppointment(token, true);
    validatePatientReschedule(appointment, date, time);
    checkDoctor(appointment);
    if (date === appointment.appointment_date && time.slice(0, 5) === appointment.appointment_time.slice(0, 5)) return { status: appointment.status, appointment_date: date, appointment_time: time };
    const availability = await isAvailableAt(appointment.doctor_id, date, time, appointment.duration_minutes || 30, appointment.id);
    if (!availability.available) throw httpError(availability.reason, 409);
    const updated = (await query(`UPDATE appointments SET appointment_date=$2, appointment_time=$3,
      end_time=($3::time + make_interval(mins=>COALESCE(duration_minutes,30)))::time,
      delay_minutes=0, delay_reason=NULL, reminder_sent=false, doctor_push_sent=false, updated_at=now()
      WHERE id=$1 RETURNING *`, [appointment.id, date, time])).rows[0];
    await query(`WITH positions AS (
      SELECT id, row_number() OVER (PARTITION BY appointment_date ORDER BY appointment_time,id) AS position
      FROM appointments WHERE doctor_id=$1 AND appointment_date IN ($2::date,$3::date)
      AND status NOT IN ('cancelled','rejected','absent','expired')
    ) UPDATE appointments a SET queue_position=positions.position::integer FROM positions WHERE a.id=positions.id`, [appointment.doctor_id, appointment.appointment_date, date]);
    await query(`INSERT INTO audit_logs(doctor_id,action,details) VALUES($1,'patient_reschedule',$2)`, [appointment.doctor_id,
      JSON.stringify({ appointmentId: appointment.id, previousDate: appointment.appointment_date, previousTime: appointment.appointment_time, date, time })]);
    const text = `El turno con ${appointment.doctor_name} fue reprogramado.\nAnterior: ${appointment.appointment_date} ${appointment.appointment_time.slice(0, 5)}\nNuevo: ${date} ${time.slice(0, 5)} (hora de Argentina).\n${appointment.status === 'scheduled' ? 'El turno sigue confirmado.' : 'La solicitud sigue pendiente de confirmación.'}\nSe conservan los pagos registrados. Consultá el turno desde tu enlace privado habitual.`;
    for (const to of new Set([appointment.doctor_email, appointment.patient_email].filter(Boolean))) {
      await enqueueEmail({ from: `"TurnoHub" <${process.env.SMTP_USER || 'turno-no-reply@turnohub.com.ar'}>`, to, subject: 'Turno reprogramado', text }, { doctorId: appointment.doctor_id, category: 'reschedule' });
    }
    afterCommit(async () => {
      notifyDoctor(appointment.doctor_id, { appointmentId: appointment.id, message: 'Un paciente reprogramó su turno.' });
      const effects = [notifyWaitlistForSlot(appointment)];
      if (appointment.google_event_id) effects.push(updateCalendarEvent(appointment.doctor_id, appointment.google_event_id, updated));
      const results = await Promise.allSettled(effects);
      for (const result of results) if (result.status === 'rejected') console.error('No se pudo completar una notificación de reprogramación:', result.reason.message);
    });
    return { status: updated.status, appointment_date: updated.appointment_date, appointment_time: updated.appointment_time };
  });
}
