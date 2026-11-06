export function needsAppointmentClosure(appointment, now = Date.now()) {
  if (!appointment || appointment.status !== 'scheduled') return false;
  const date = String(appointment.appointment_date || '').split('T')[0];
  const time = String(appointment.appointment_time || '');
  const start = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}-03:00`);
  const duration = Number(appointment.duration_minutes ?? 30);
  return Number.isFinite(start) && start + duration * 60000 < now;
}
