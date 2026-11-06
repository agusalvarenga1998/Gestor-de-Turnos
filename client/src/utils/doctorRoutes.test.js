import { isDoctorArea } from './doctorRoutes';
import { needsAppointmentClosure } from './appointmentState';

test('la configuración obligatoria solo corresponde al área profesional', () => {
  for (const path of ['/dashboard', '/appointments', '/patients', '/patient-history/123', '/settings', '/doctor/profile']) expect(isDoctorArea(path)).toBe(true);
  for (const path of ['/admin/dashboard', '/seller/dashboard', '/patient', '/patient/appointment/123', '/fila/123', '/turnero/123', '/support', '/subscription-expired', '/reset-password']) expect(isDoctorArea(path)).toBe(false);
});

test('muestra pendiente de cierre solo después de terminar un turno confirmado', () => {
  const appointment = { status: 'scheduled', appointment_date: '2026-11-06', appointment_time: '10:00:00', duration_minutes: 30 };
  expect(needsAppointmentClosure(appointment, Date.parse('2026-11-06T10:29:00-03:00'))).toBe(false);
  expect(needsAppointmentClosure(appointment, Date.parse('2026-11-06T10:31:00-03:00'))).toBe(true);
  expect(needsAppointmentClosure({ ...appointment, status: 'completed' }, Date.parse('2026-11-07T10:31:00-03:00'))).toBe(false);
});
