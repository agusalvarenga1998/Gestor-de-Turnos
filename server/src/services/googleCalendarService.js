import { google } from 'googleapis';
import * as db from '../db/config.js';
import dotenv from 'dotenv';

dotenv.config();

// Crear cliente OAuth2
function getOAuth2Client() {
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// Generar URL de autenticación
export function getAuthUrl(doctorId) {
  const oauth2Client = getOAuth2Client();
  // ESENCIAL: Añadimos scopes de identidad para que Google nos devuelva el id_token
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: doctorId,
    prompt: 'consent',
    include_granted_scopes: true
  });

  return authUrl;
}

// Manejar callback de Google
export async function handleCallback(code, doctorId) {
  try {
    console.log('\n🔑 === GOOGLE CALENDAR CALLBACK ===');
    const oauth2Client = getOAuth2Client();

    // 1. Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✓ Tokens obtenidos de Google');

    // 2. Extraer google_id del ID Token (opcional pero recomendado para verificar)
    let googleId = null;
    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      googleId = ticket.getPayload().sub;
    }

    // 3. Guardar tokens en la DB
    // Importante: Guardamos tanto el access como el refresh token
    await db.query(
      `UPDATE doctors
       SET google_refresh_token = COALESCE($1, google_refresh_token),
           google_access_token = $2,
           google_id = COALESCE(google_id, $3),
           google_calendar_connected = true,
           google_calendar_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        tokens.refresh_token || null, 
        tokens.access_token, 
        googleId,
        'primary', 
        doctorId
      ]
    );

    console.log('✓ Tokens y estado de calendario actualizados en DB\n');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en Google Calendar service handleCallback:', error.message);
    throw error;
  }
}

// ... (Resto de funciones como createCalendarEvent, etc. se mantienen igual)
// Función auxiliar para convertir fecha y hora a ISO
function getEventDateTime(appointmentDate, appointmentTime) {
  let dateStr = appointmentDate;
  if (dateStr instanceof Date) {
    dateStr = dateStr.toISOString().split('T')[0];
  } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  const isoString = `${dateStr}T${appointmentTime}`;
  return new Date(isoString).toISOString();
}

// Desconectar Google Calendar
export async function disconnectCalendar(doctorId) {
  try {
    await db.query(
      `UPDATE doctors
       SET google_refresh_token = NULL,
           google_access_token = NULL,
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
    const result = await db.query(
      'SELECT google_calendar_connected FROM doctors WHERE id = $1',
      [doctorId]
    );
    if (!result.rows || result.rows.length === 0) return { connected: false };
    return { connected: result.rows[0].google_calendar_connected === true };
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return { connected: false };
  }
}

// Crear evento en Google Calendar
export async function createCalendarEvent(doctorId, appointment) {
  try {
    const doctorResult = await db.query(
      'SELECT google_refresh_token, google_calendar_connected, name FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (!doctorResult.rows[0]?.google_refresh_token) return null;

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

    const startDateTime = getEventDateTime(appointment.appointment_date, appointment.appointment_time);
    const endDateTime = getEventDateTime(appointment.appointment_date, appointment.end_time || appointment.appointment_time);

    const event = {
      summary: `Cita: ${patientName}`,
      description: `Doctor: ${doctorName}\nMotivo: ${appointment.reason_for_visit || 'N/A'}`,
      start: { dateTime: startDateTime, timeZone: 'America/Argentina/Buenos_Aires' },
      end: { dateTime: endDateTime, timeZone: 'America/Argentina/Buenos_Aires' }
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    await db.query(
      'UPDATE appointments SET google_event_id = $1 WHERE id = $2',
      [result.data.id, appointment.id]
    );

    return result.data.id;
  } catch (error) {
    console.error('Error creando evento en Google Calendar:', error.message);
    return null;
  }
}

// Actualizar evento
export async function updateCalendarEvent(doctorId, googleEventId, appointment) {
  try {
    const doctorResult = await db.query(
      'SELECT google_refresh_token, name FROM doctors WHERE id = $1',
      [doctorId]
    );
    if (!doctorResult.rows[0]?.google_refresh_token || !googleEventId) return null;

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

    const startDateTime = getEventDateTime(appointment.appointment_date, appointment.appointment_time);
    const endDateTime = getEventDateTime(appointment.appointment_date, appointment.end_time || appointment.appointment_time);

    const event = {
      summary: `Cita: ${patientName}`,
      description: `Doctor: ${doctorName}\nMotivo: ${appointment.reason_for_visit || 'N/A'}`,
      start: { dateTime: startDateTime, timeZone: 'America/Argentina/Buenos_Aires' },
      end: { dateTime: endDateTime, timeZone: 'America/Argentina/Buenos_Aires' }
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: event
    });

    return googleEventId;
  } catch (error) {
    console.error('Error actualizando evento en Google Calendar:', error);
    return null;
  }
}

// Eliminar evento
export async function deleteCalendarEvent(doctorId, googleEventId) {
  try {
    if (!googleEventId) return null;
    const doctorResult = await db.query(
      'SELECT google_refresh_token FROM doctors WHERE id = $1',
      [doctorId]
    );
    if (!doctorResult.rows[0]?.google_refresh_token) return null;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: doctorResult.rows[0].google_refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
    return true;
  } catch (error) {
    console.error('Error eliminando evento de Google Calendar:', error);
    return null;
  }
}
