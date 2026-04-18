import { query, transaction } from '../db/config.js';
import { v4 as uuidv4 } from 'uuid';

// Crear disponibilidad para un día específico
export const createAvailability = async (doctorId, availabilityData) => {
  const { day_of_week, start_time, end_time } = availabilityData;

  const result = await query(
    `INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [uuidv4(), doctorId, day_of_week, start_time, end_time]
  );

  return result.rows[0];
};

// Obtener disponibilidades de un doctor
export const getAvailabilitiesByDoctor = async (doctorId) => {
  const result = await query(
    `SELECT * FROM doctor_availability
     WHERE doctor_id = $1 AND is_available = true
     ORDER BY day_of_week ASC, start_time ASC`,
    [doctorId]
  );

  return result.rows;
};

// Obtener disponibilidad para un día específico
export const getAvailabilityForDay = async (doctorId, dayOfWeek) => {
  const result = await query(
    `SELECT * FROM doctor_availability
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true`,
    [doctorId, dayOfWeek]
  );

  return result.rows;
};

// Actualizar disponibilidad
export const updateAvailability = async (availabilityId, doctorId, updateData) => {
  const { start_time, end_time, is_available } = updateData;

  const result = await query(
    `UPDATE doctor_availability
     SET start_time = COALESCE($1, start_time),
         end_time = COALESCE($2, end_time),
         is_available = COALESCE($3, is_available),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND doctor_id = $5
     RETURNING *`,
    [start_time, end_time, is_available, availabilityId, doctorId]
  );

  return result.rows[0];
};

// Eliminar disponibilidad
export const deleteAvailability = async (availabilityId, doctorId) => {
  const result = await query(
    `DELETE FROM doctor_availability
     WHERE id = $1 AND doctor_id = $2
     RETURNING *`,
    [availabilityId, doctorId]
  );

  return result.rows[0];
};

// Agregar vacaciones
export const addVacation = async (doctorId, vacationData) => {
  const { start_date, end_date, reason } = vacationData;

  const result = await query(
    `INSERT INTO doctor_vacation (id, doctor_id, start_date, end_date, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [uuidv4(), doctorId, start_date, end_date, reason]
  );

  return result.rows[0];
};

// Obtener vacaciones de un doctor
export const getVacationsByDoctor = async (doctorId) => {
  const result = await query(
    `SELECT * FROM doctor_vacation
     WHERE doctor_id = $1
     ORDER BY start_date ASC`,
    [doctorId]
  );

  return result.rows;
};

// Obtener vacaciones activas
export const getActiveVacations = async (doctorId) => {
  const result = await query(
    `SELECT * FROM doctor_vacation
     WHERE doctor_id = $1
       AND start_date <= CURRENT_DATE
       AND end_date >= CURRENT_DATE
     ORDER BY start_date ASC`,
    [doctorId]
  );

  return result.rows;
};

// Eliminar vacación
export const deleteVacation = async (vacationId, doctorId) => {
  const result = await query(
    `DELETE FROM doctor_vacation
     WHERE id = $1 AND doctor_id = $2
     RETURNING *`,
    [vacationId, doctorId]
  );

  return result.rows[0];
};

// Verificar si el doctor está disponible en una fecha/hora con una duración específica
export const isAvailableAt = async (doctorId, date, time, durationMinutes = 30) => {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  // 1. Verificar vacaciones
  const vacation = await query(
    `SELECT * FROM doctor_vacation
     WHERE doctor_id = $1 AND start_date <= $2 AND end_date >= $2`,
    [doctorId, date]
  );
  if (vacation.rows.length > 0) return { available: false, reason: 'En vacaciones' };

  // 2. Verificar horarios de atención
  const availabilities = await query(
    `SELECT * FROM doctor_availability
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true`,
    [doctorId, dayOfWeek]
  );
  if (availabilities.rows.length === 0) return { available: false, reason: 'No atiende este día' };

  const availability = availabilities.rows[0];
  const startMinutes = timeToMinutes(availability.start_time);
  const endMinutes = timeToMinutes(availability.end_time);
  const requestedStart = timeToMinutes(time);
  const requestedEnd = requestedStart + durationMinutes;

  if (requestedStart < startMinutes || requestedEnd > endMinutes) {
    return { available: false, reason: 'Fuera de horario de atención' };
  }

  // 3. Verificar solapamiento con otras citas
  // Una cita solapa si: (inicio_nueva < fin_existente) AND (fin_nueva > inicio_existente)
  const existingAppointments = await query(
    `SELECT appointment_time, duration_minutes FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled', 'rejected')`,
    [doctorId, date]
  );

  for (const appt of existingAppointments.rows) {
    const apptStart = timeToMinutes(appt.appointment_time);
    const apptEnd = apptStart + (appt.duration_minutes || 30);
    
    if (requestedStart < apptEnd && requestedEnd > apptStart) {
      return { available: false, reason: 'Se solapa con otra cita' };
    }
  }

  return { available: true };
};

// Obtener próximas disponibilidades para una fecha y duración específica
export const getNextAvailableSlots = async (doctorId, date, slotDurationMinutes = 30) => {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  // Verificar vacaciones
  const vacation = await query(
    `SELECT * FROM doctor_vacation
     WHERE doctor_id = $1 AND start_date <= $2 AND end_date >= $2`,
    [doctorId, date]
  );
  if (vacation.rows.length > 0) return [];

  // Obtener disponibilidades
  const availabilities = await query(
    `SELECT * FROM doctor_availability
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true`,
    [doctorId, dayOfWeek]
  );
  if (availabilities.rows.length === 0) return [];

  const availability = availabilities.rows[0];
  const startMinutes = timeToMinutes(availability.start_time);
  const endMinutes = timeToMinutes(availability.end_time);

  // Obtener citas existentes para calcular solapamientos
  const appointments = await query(
    `SELECT appointment_time, duration_minutes FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled', 'rejected')
     ORDER BY appointment_time ASC`,
    [doctorId, date]
  );

  const bookedRanges = appointments.rows.map(a => {
    const start = timeToMinutes(a.appointment_time);
    return {
      start,
      end: start + (a.duration_minutes || 30)
    };
  });

  const slots = [];
  // El intervalo de búsqueda sigue siendo de 15 min para dar flexibilidad al inicio del turno
  // pero cada "slot" debe asegurar que cabe la duración completa requerida
  const step = 15; 

  for (let minutes = startMinutes; minutes <= (endMinutes - slotDurationMinutes); minutes += step) {
    const slotStart = minutes;
    const slotEnd = minutes + slotDurationMinutes;

    // Verificar si este bloque [slotStart, slotEnd] choca con algún turno reservado
    const isOverlap = bookedRanges.some(range => 
      slotStart < range.end && slotEnd > range.start
    );

    if (!isOverlap) {
      slots.push(minutesToTime(minutes));
    }
  }

  return slots;
};

// Convertir tiempo a minutos
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convertir minutos a tiempo
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};
