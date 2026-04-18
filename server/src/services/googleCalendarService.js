import { google } from 'googleapis';
import * as db from '../db/config.js';
import dotenv from 'dotenv';

dotenv.config();

// Función auxiliar para convertir fecha y hora a ISO
function getEventDateTime(appointmentDate, appointmentTime) {
  let dateStr = appointmentDate;

  // Convertir a string si es un objeto Date
  if (dateStr instanceof Date) {
    dateStr = dateStr.toISOString().split('T')[0];
  } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  // Crear fecha ISO combinando fecha y hora
  const isoString = `${dateStr}T${appointmentTime}`;
  return new Date(isoString).toISOString();
}

// Crear cliente OAuth2
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Generar URL de autenticación
export function getAuthUrl(doctorId) {
  const oauth2Client = getOAuth2Client();
  const scopes = ['https://www.googleapis.com/auth/calendar'];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: doctorId,
    prompt: 'consent' // Force Google to show consent screen and return refresh_token
  });

  return authUrl;
}

// Manejar callback de Google
export async function handleCallback(code, doctorId) {
  try {
    console.log('\n🔑 === GOOGLE CALLBACK ===');
    console.log('Code:', code.substring(0, 20) + '...');
    console.log('Doctor ID:', doctorId);

    const oauth2Client = getOAuth2Client();
    console.log('OAuth2 client creado');

    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens recibidos de Google');
    console.log('Tiene refresh_token:', !!tokens.refresh_token);
    console.log('Token type:', tokens.token_type);
    console.log('Expiry date:', tokens.expiry_date);

    if (!tokens.refresh_token) {
      console.error('❌ Google no devolvió refresh_token');
      console.log('Tokens completos:', JSON.stringify(tokens, null, 2));
    }

    // Guardar refresh token en la DB
    await db.query(
      `UPDATE doctors
       SET google_refresh_token = $1,
           google_calendar_connected = true,
           google_calendar_id = $2
       WHERE id = $3`,
      [tokens.refresh_token || null, 'primary', doctorId]
    );

    console.log('✓ Tokens guardados en DB');
    console.log('✓ Google Calendar conectado\n');

    return { success: true, message: 'Google Calendar conectado exitosamente' };
  } catch (error) {
    console.error('❌ Error en Google Calendar callback:', error.message);
    console.error('Stack:', error.stack);
    throw new Error('Error al conectar con Google Calendar: ' + error.message);
  }
}

// Desconectar Google Calendar
export async function disconnectCalendar(doctorId) {
  try {
    await db.query(
      `UPDATE doctors
       SET google_refresh_token = NULL,
           google_calendar_connected = false,
           google_calendar_id = NULL
       WHERE id = $1`,
      [doctorId]
    );

    return { success: true, message: 'Google Calendar desconectado' };
  } catch (error) {
    console.error('Error desconectando Google Calendar:', error);
    throw error;
  }
}

// Obtener estado de conexión
export async function getConnectionStatus(doctorId) {
  try {
    console.log('Obteniendo estado para doctor:', doctorId);

    const result = await db.query(
      'SELECT google_calendar_connected FROM doctors WHERE id = $1',
      [doctorId]
    );

    console.log('Resultado de query:', result.rows);

    if (!result.rows || result.rows.length === 0) {
      console.log('Doctor no encontrado');
      return { connected: false };
    }

    const connected = result.rows[0].google_calendar_connected === true;
    console.log('Estado de conexión:', connected);

    return { connected };
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return { connected: false };
  }
}

// Crear evento en Google Calendar
export async function createCalendarEvent(doctorId, appointment) {
  try {
    console.log('\n📅 === SINCRONIZAR CON GOOGLE CALENDAR ===');
    console.log('Doctor ID:', doctorId);
    console.log('Appointment ID:', appointment.id);

    // Obtener refresh token del doctor
    const doctorResult = await db.query(
      'SELECT google_refresh_token, google_calendar_connected, name FROM doctors WHERE id = $1',
      [doctorId]
    );

    console.log('Doctor encontrado:', !!doctorResult.rows[0]);
    console.log('Google conectado:', doctorResult.rows[0]?.google_calendar_connected);
    console.log('Tiene refresh token:', !!doctorResult.rows[0]?.google_refresh_token);

    if (!doctorResult.rows[0]?.google_refresh_token) {
      console.log('⚠️  Doctor sin Google Calendar conectado');
      return null;
    }

    const refreshToken = doctorResult.rows[0].google_refresh_token;
    const doctorName = doctorResult.rows[0].name;

    console.log('📝 Obteniendo datos del paciente...');

    // Obtener nombre del paciente
    const patientResult = await db.query(
      'SELECT name FROM patients WHERE id = $1',
      [appointment.patient_id]
    );

    const patientName = patientResult.rows[0]?.name || 'Paciente';

    console.log('🔑 Configurando OAuth2 con refresh token...');

    // Configurar cliente OAuth2 con refresh token
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Construir las fechas/horas ISO
    const startDateTime = getEventDateTime(appointment.appointment_date, appointment.appointment_time);
    const endDateTime = getEventDateTime(appointment.appointment_date, appointment.end_time || appointment.appointment_time);

    console.log('📋 Evento:');
    console.log('  Paciente:', patientName);
    console.log('  Hora inicio:', startDateTime);
    console.log('  Hora fin:', endDateTime);

    const event = {
      summary: `Cita: ${patientName}`,
      description: `Doctor: ${doctorName}\nMotivo: ${appointment.reason_for_visit || 'N/A'}`,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Argentina/Buenos_Aires'
      }
    };

    console.log('📤 Enviando evento a Google Calendar...');
    console.log('Evento:', JSON.stringify(event, null, 2));

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    console.log('✓ Evento creado en Google Calendar:', result.data.id);

    // Guardar google_event_id en la cita
    await db.query(
      'UPDATE appointments SET google_event_id = $1 WHERE id = $2',
      [result.data.id, appointment.id]
    );

    console.log(`✓ google_event_id guardado en BD\n`);
    return result.data.id;
  } catch (error) {
    console.error('❌ Error creando evento en Google Calendar:', error.message);
    console.error('Stack:', error.stack);
    // No lanzar error para no romper el flujo de creación de cita
    return null;
  }
}

// Actualizar evento en Google Calendar
export async function updateCalendarEvent(doctorId, googleEventId, appointment) {
  try {
    const doctorResult = await db.query(
      'SELECT google_refresh_token, name FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (!doctorResult.rows[0]?.google_refresh_token || !googleEventId) {
      return null;
    }

    const refreshToken = doctorResult.rows[0].google_refresh_token;
    const doctorName = doctorResult.rows[0].name;

    const patientResult = await db.query(
      'SELECT name FROM patients WHERE id = $1',
      [appointment.patient_id]
    );

    const patientName = patientResult.rows[0]?.name || 'Paciente';

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Construir las fechas/horas ISO
    const startDateTime = getEventDateTime(appointment.appointment_date, appointment.appointment_time);
    const endDateTime = getEventDateTime(appointment.appointment_date, appointment.end_time || appointment.appointment_time);

    const event = {
      summary: `Cita: ${patientName}`,
      description: `Doctor: ${doctorName}\nMotivo: ${appointment.reason_for_visit || 'N/A'}`,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Argentina/Buenos_Aires'
      }
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: event
    });

    console.log(`✓ Evento actualizado en Google Calendar: ${googleEventId}`);
    return googleEventId;
  } catch (error) {
    console.error('Error actualizando evento en Google Calendar:', error);
    return null;
  }
}

// Eliminar evento de Google Calendar
export async function deleteCalendarEvent(doctorId, googleEventId) {
  try {
    if (!googleEventId) {
      return null;
    }

    const doctorResult = await db.query(
      'SELECT google_refresh_token FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (!doctorResult.rows[0]?.google_refresh_token) {
      return null;
    }

    const refreshToken = doctorResult.rows[0].google_refresh_token;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId
    });

    console.log(`✓ Evento eliminado de Google Calendar: ${googleEventId}`);
    return true;
  } catch (error) {
    console.error('Error eliminando evento de Google Calendar:', error);
    return null;
  }
}
