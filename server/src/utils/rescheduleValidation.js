import { calendarDate, httpError } from './validation.js';

export function validatePatientReschedule(appointment, date, time, now = Date.now()) {
  if (!['scheduled', 'pending'].includes(appointment.status)) throw httpError('Este turno no admite reprogramación. Contactá al profesional.', 409);
  const original = Date.parse(`${appointment.appointment_date}T${appointment.appointment_time}-03:00`);
  if (!Number.isFinite(original) || original - now < 86400000) throw httpError('Para reprogramar necesitás al menos 24 horas de anticipación. Contactá al profesional.', 409);
  if (date === undefined) return;
  if (typeof date !== 'string') throw httpError('Elegí una fecha válida.');
  calendarDate(date);
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(time)) throw httpError('Elegí un horario válido.');
  const target = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}-03:00`);
  if (!Number.isFinite(target) || target - now < 86400000) throw httpError('El nuevo turno debe tener al menos 24 horas de anticipación.');
}
