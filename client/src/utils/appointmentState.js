export function needsAppointmentClosure(appointment, now = Date.now()) {
  if (!appointment || appointment.status !== 'scheduled') return false;
  const date = String(appointment.appointment_date || '').split('T')[0];
  const time = String(appointment.appointment_time || '');
  const start = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}-03:00`);
  const duration = Number(appointment.duration_minutes ?? 30);
  return Number.isFinite(start) && start + duration * 60000 < now;
}

export function appointmentStatusInfo(appointment, { patient = false, now = Date.now() } = {}) {
  if (!patient && needsAppointmentClosure(appointment, now)) return { label: 'Pendiente de cierre', tone: 'pending' };
  const statuses = {
    pending: { label: 'Esperando confirmación', tone: 'pending' },
    pending_payment: { label: 'Pago pendiente', tone: 'pending' },
    scheduled: { label: 'Turno confirmado', tone: 'scheduled' },
    completed: { label: 'Atención finalizada', tone: 'completed' },
    cancelled: { label: 'Turno cancelado', tone: 'cancelled' },
    rejected: { label: 'Solicitud rechazada', tone: 'rejected' },
    absent: { label: 'Ausente', tone: 'absent' },
    expired: { label: 'Solicitud vencida', tone: 'expired' }
  };
  return statuses[appointment?.status] || { label: 'Estado por revisar', tone: 'pending' };
}

export function appointmentPaymentInfo(appointment) {
  if (appointment?.payment_status === 'paid') return { label: 'Pago completo registrado', received: true };
  if (appointment?.payment_status === 'partial' || Number(appointment?.booking_fee_paid) > 0) return { label: 'Pago parcial registrado', received: true };
  if (appointment?.status === 'pending_payment') return { label: 'Esperando acreditación del pago', received: false };
  if (appointment?.payment_status === 'pending') return { label: 'Sin pago registrado', received: false };
  return { label: 'Pago sin información', received: false };
}
