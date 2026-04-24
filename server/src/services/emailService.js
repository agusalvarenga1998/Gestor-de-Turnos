import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Crear transportador de email con Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// Verificar que las credenciales estén configuradas
if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
  console.warn('⚠️  SMTP_USER o SMTP_PASSWORD no están configurados en .env');
}

// Enviar email de confirmación de cita
export async function sendAppointmentConfirmation({
  to,
  patientName,
  doctorName,
  doctorSpecialty,
  appointmentDate,
  appointmentTime,
  reason,
  appointmentCode,
  confirmUrl
}) {
  try {
    // Si no hay email del paciente, omitir sin error
    if (!to) {
      console.log('⚠️  Paciente sin email, se omite envío');
      return { sent: false, reason: 'No email' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #2563eb;
            font-size: 24px;
          }
          .content {
            margin: 20px 0;
          }
          .appointment-details {
            background-color: #f9fafb;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .detail-row {
            display: flex;
            margin: 10px 0;
          }
          .detail-label {
            font-weight: 600;
            width: 120px;
            color: #555;
          }
          .detail-value {
            flex: 1;
            color: #333;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            background-color: #1d4ed8;
          }
          .access-info {
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .access-info h3 {
            margin: 0 0 10px 0;
            color: #2563eb;
          }
          .access-option {
            margin: 10px 0;
            padding: 10px;
            background-color: white;
            border-radius: 4px;
            border: 1px solid #dbeafe;
          }
          .access-option strong {
            color: #2563eb;
          }
          .footer {
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            margin-top: 30px;
            font-size: 12px;
            color: #888;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Tu Cita ha sido Programada</h1>
          </div>

          <div class="content">
            <p>Hola <strong>${patientName}</strong>,</p>
            <p>Tu cita médica ha sido programada exitosamente. Aquí están los detalles:</p>

            <div class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">👨‍⚕️ Doctor:</span>
                <span class="detail-value">${doctorName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🏥 Especialidad:</span>
                <span class="detail-value">${doctorSpecialty || 'General'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span class="detail-value">${new Date(appointmentDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span class="detail-value">${appointmentTime}</span>
              </div>
              ${reason ? `
              <div class="detail-row">
                <span class="detail-label">📝 Motivo:</span>
                <span class="detail-value">${reason}</span>
              </div>
              ` : ''}
              <div class="detail-row" style="background-color: #fef3c7; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <span class="detail-label" style="color: #92400e;">🔑 Código:</span>
                <span class="detail-value" style="font-weight: bold; font-size: 18px; color: #92400e;">${appointmentCode}</span>
              </div>
            </div>

            <div class="access-info">
              <h3>🔍 ¿Cómo ver tu turno?</h3>
              <div class="access-option">
                <strong>Opción 1: Por tu Nombre</strong><br>
                Ingresa tu nombre completo en: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient">Ver Turno</a>
              </div>
              <div class="access-option">
                <strong>Opción 2: Por Código de Turno</strong><br>
                Usa el código <strong>${appointmentCode}</strong> en la sección "Buscar Mis Turnos"
              </div>
              <div class="access-option">
                <strong>Opción 3: Por Link Directo</strong><br>
                Haz clic en el botón de abajo para ver tu cita directamente
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${confirmUrl}" class="button">Ver Mi Cita Ahora</a>
            </p>

            <p style="margin-top: 30px;">Si tienes preguntas o necesitas reprogramar tu cita, por favor contacta con la clínica.</p>
          </div>

          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este correo.</p>
            <p>&copy; 2026 Sistema de Gestión de Citas Médicas. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('📧 Enviando email a:', to);

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Cita Confirmada - ${doctorName}`,
      html: htmlContent
    });

    console.log('✓ Email enviado:', info.messageId);
    return { sent: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    // No lanzar error para no romper el flujo de creación de cita
    return { sent: false, error: error.message };
  }
}

// Enviar notificación de retraso a pacientes afectados
export async function sendDelayNotification({
  to,
  patientName,
  doctorName,
  appointmentTime,
  delayMinutes
}) {
  try {
    if (!to) {
      console.log('⚠️  Paciente sin email, se omite notificación de retraso');
      return { sent: false, reason: 'No email' };
    }

    const newTime = calculateNewTime(appointmentTime, delayMinutes);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 3px solid #f59e0b;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #f59e0b;
            font-size: 24px;
          }
          .alert-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .detail-row {
            display: flex;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            width: 150px;
            color: #555;
          }
          .detail-value {
            flex: 1;
            color: #333;
            font-size: 18px;
          }
          .footer {
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            margin-top: 30px;
            font-size: 12px;
            color: #888;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏱️ Notificación de Retraso en tu Cita</h1>
          </div>

          <p>Hola <strong>${patientName}</strong>,</p>

          <div class="alert-box">
            <p><strong>Tu cita médica ha sufrido un retraso.</strong></p>
            <p>Queremos notificarte para que puedas organizar tu tiempo.</p>
          </div>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <div class="detail-row">
              <span class="detail-label">👨‍⚕️ Doctor:</span>
              <span class="detail-value">${doctorName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">⏰ Hora Original:</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">⏱️ Retraso:</span>
              <span class="detail-value" style="color: #f59e0b;">+${delayMinutes} minutos</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🕐 Nueva Hora:</span>
              <span class="detail-value" style="color: #16a34a; font-weight: bold;">${newTime}</span>
            </div>
          </div>

          <p style="margin-top: 20px;"><strong>Por favor, llega 5 minutos antes de la nueva hora estimada.</strong></p>

          <p>Si tienes preguntas o necesitas más información, no dudes en contactar con la clínica.</p>

          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este correo.</p>
            <p>&copy; 2026 MediHub - Sistema de Gestión de Citas Médicas.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('📧 Enviando notificación de retraso a:', to);

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `⏱️ Tu cita con ${doctorName} se ha retrasado ${delayMinutes} minutos`,
      html: htmlContent
    });

    console.log('✓ Notificación de retraso enviada:', info.messageId);
    return { sent: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error enviando notificación de retraso:', error.message);
    return { sent: false, error: error.message };
  }
}

// Enviar notificación de rechazo de cita
export async function sendAppointmentRejectionEmail({
  to,
  patientName,
  doctorName,
  appointmentDate,
  appointmentTime,
  reason
}) {
  try {
    if (!to) {
      console.log('⚠️  Paciente sin email, se omite notificación de rechazo');
      return { sent: false, reason: 'No email' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 3px solid #dc2626;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #dc2626;
            font-size: 24px;
          }
          .alert-box {
            background-color: #fee2e2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .detail-row {
            display: flex;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            width: 150px;
            color: #555;
          }
          .detail-value {
            flex: 1;
            color: #333;
            font-size: 16px;
          }
          .reason-box {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .reason-label {
            font-weight: 600;
            color: #555;
            margin-bottom: 10px;
          }
          .reason-text {
            color: #333;
            line-height: 1.6;
          }
          .contact-box {
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .contact-box h3 {
            margin: 0 0 10px 0;
            color: #2563eb;
          }
          .footer {
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            margin-top: 30px;
            font-size: 12px;
            color: #888;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Cita No Confirmada</h1>
          </div>

          <p>Hola <strong>${patientName}</strong>,</p>

          <div class="alert-box">
            <p><strong>Lamentablemente, tu solicitud de cita ha sido rechazada.</strong></p>
          </div>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <div class="detail-row">
              <span class="detail-label">👨‍⚕️ Doctor:</span>
              <span class="detail-value">${doctorName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">📅 Fecha Solicitada:</span>
              <span class="detail-value">${new Date(appointmentDate).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🕐 Hora Solicitada:</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
          </div>

          ${reason ? `
          <div class="reason-box">
            <div class="reason-label">📝 Motivo del Rechazo:</div>
            <div class="reason-text">${reason}</div>
          </div>
          ` : ''}

          <div class="contact-box">
            <h3>📞 ¿Qué puedo hacer?</h3>
            <p>Puedes intentar solicitar otro turno en una fecha o hora diferente. Para consultas adicionales, no dudes en contactar directamente con la clínica.</p>
          </div>

          <p style="margin-top: 20px;">Si tienes preguntas, por favor contacta con la clínica.</p>

          <div class="footer">
            <p>Este es un email automático, por favor no respondas a este correo.</p>
            <p>&copy; 2026 MediHub - Sistema de Gestión de Citas Médicas.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('📧 Enviando notificación de rechazo a:', to);

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `❌ Tu cita con ${doctorName} ha sido rechazada`,
      html: htmlContent
    });

    console.log('✓ Notificación de rechazo enviada:', info.messageId);
    return { sent: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error enviando notificación de rechazo:', error.message);
    return { sent: false, error: error.message };
  }
}

function calculateNewTime(originalTime, delayMinutes) {
  try {
    const [hours, minutes] = originalTime.split(':').map(Number);
    let newMinutes = minutes + delayMinutes;
    let newHours = hours;

    if (newMinutes >= 60) {
      newHours += Math.floor(newMinutes / 60);
      newMinutes = newMinutes % 60;
    }

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  } catch (error) {
    console.error('Error calculando nueva hora:', error);
    return originalTime;
  }
}

// Enviar email de bienvenida y aprobación al profesional
export async function sendProfessionalApprovalEmail({
  to,
  name,
  loginUrl
}) {
  try {
    if (!to) return { sent: false, reason: 'No email' };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f7f6; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #2563eb, #1e40af); padding: 40px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .welcome-text { font-size: 18px; color: #1f2937; margin-bottom: 20px; }
          .status-badge { display: inline-block; background-color: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-bottom: 25px; }
          .info-card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
          .info-item { display: flex; align-items: center; margin-bottom: 15px; }
          .info-icon { font-size: 20px; margin-right: 12px; }
          .button { display: block; background-color: #2563eb; color: #ffffff; padding: 16px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center; font-size: 16px; transition: background-color 0.3s; }
          .button:hover { background-color: #1d4ed8; }
          .footer { padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 13px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a TurnoHub!</h1>
          </div>
          <div class="content">
            <p class="welcome-text">Hola <strong>${name}</strong>,</p>
            <div class="status-badge">✓ CUENTA ACTIVADA</div>
            <p>Nos complace informarte que tu solicitud ha sido revisada y <strong>tu cuenta ha sido aprobada con éxito.</strong></p>
            
            <div class="info-card">
              <div class="info-item">
                <span class="info-icon">🎁</span>
                <span>Has recibido <strong>15 días de prueba GRATIS</strong> para explorar todas las herramientas.</span>
              </div>
              <div class="info-item">
                <span class="info-icon">⚙️</span>
                <span>Ya puedes configurar tus horarios, rubro y empezar a recibir turnos.</span>
              </div>
            </div>

            <p style="margin-bottom: 30px;">Puedes acceder a tu panel profesional utilizando tus credenciales registradas:</p>
            
            <a href="${loginUrl}" class="button">INGRESAR A MI PANEL</a>
          </div>
          <div class="footer">
            <p>Si tienes alguna duda, responde a este correo o contacta a soporte.</p>
            <p>&copy; 2026 TurnoHub - Gestión Inteligente de Turnos.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: '¡Tu cuenta de TurnoHub ha sido aprobada!',
      html: htmlContent
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando aprobación profesional:', error);
    return { sent: false, error: error.message };
  }
}

// Enviar notificación de nuevo turno al doctor (para aprobar/rechazar)
export async function sendNewAppointmentNotificationToDoctor({
  to,
  doctorName,
  patientName,
  appointmentDate,
  appointmentTime,
  serviceName,
  dashboardUrl
}) {
  try {
    if (!to) return { sent: false, reason: 'No email' };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
          .header { background: #2563eb; padding: 30px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .content { padding: 30px; }
          .welcome { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 10px; }
          .alert-pill { display: inline-block; background-color: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 13px; margin-bottom: 20px; }
          .data-card { background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .data-row { display: flex; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
          .data-row:last-child { border-bottom: none; margin-bottom: 0; }
          .label { width: 100px; color: #64748b; font-weight: 600; font-size: 13px; }
          .value { flex: 1; color: #1e293b; font-weight: 500; }
          .button { display: block; background: #2563eb; color: white; padding: 16px; text-decoration: none; border-radius: 8px; text-align: center; font-weight: bold; margin-top: 25px; transition: background 0.2s; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nueva Solicitud de Turno</h1>
          </div>
          <div class="content">
            <p class="welcome">Hola, Dr. ${doctorName}</p>
            <div class="alert-pill">⚠️ ACCIÓN REQUERIDA</div>
            <p>Se ha registrado un nuevo turno que requiere tu aprobación manual en el panel de control.</p>
            
            <div class="data-card">
              <div class="data-row">
                <span class="label">CLIENTE:</span>
                <span class="value">${patientName}</span>
              </div>
              <div class="data-row">
                <span class="label">FECHA:</span>
                <span class="value">${new Date(appointmentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div class="data-row">
                <span class="label">HORA:</span>
                <span class="value">${appointmentTime} hs</span>
              </div>
              <div class="data-row">
                <span class="label">SERVICIO:</span>
                <span class="value">${serviceName || 'Consulta General'}</span>
              </div>
            </div>

            <p style="font-size: 14px; color: #64748b;">Recordá que podés aceptar o rechazar esta cita desde la sección de Gestión de Turnos.</p>
            
            <a href="${dashboardUrl}" class="button">GESTIONAR TURNO AHORA</a>
          </div>
          <div class="footer">
            <p>Enviado automáticamente por TurnoHub Professional Portal.</p>
            <p>&copy; 2026 TurnoHub. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Nuevo turno pendiente: ${patientName}`,
      html: htmlContent
    });

    console.log('✓ Notificación enviada al profesional:', to);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email al profesional:', error.message);
    return { sent: false, error: error.message };
  }
}

// Enviar recordatorio de cita (24hs antes)
export async function sendAppointmentReminder({
  to,
  patientName,
  doctorName,
  appointmentDate,
  appointmentTime,
  clinicName,
  clinicAddress
}) {
  try {
    if (!to) return { sent: false, reason: 'No email' };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          .warning { color: #dc2626; font-weight: bold; margin-top: 20px; border-top: 1px solid #fee2e2; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Recordatorio de Turno</h1></div>
          <div class="content">
            <p>Hola <strong>${patientName}</strong>,</p>
            <p>Este es un recordatorio de tu turno programado para mañana:</p>
            
            <div class="details">
              <p><strong>👨‍⚕️ Profesional:</strong> ${doctorName}</p>
              <p><strong>📅 Fecha:</strong> ${new Date(appointmentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p><strong>🕐 Hora:</strong> ${appointmentTime} hs</p>
              ${clinicName ? `<p><strong>🏥 Lugar:</strong> ${clinicName}</p>` : ''}
              ${clinicAddress ? `<p><strong>📍 Dirección:</strong> ${clinicAddress}</p>` : ''}
            </div>

            <div class="warning">
              ⚠️ Recordatorio: Al faltar menos de 24 hs para tu cita, ya no es posible realizar cancelaciones o reprogramaciones a través del sistema.
            </div>

            <p style="margin-top: 25px;">¡Te esperamos!</p>
          </div>
          <div class="footer">
            <p>Enviado por TurnoHub.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"TurnoHub" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Recordatorio: Tu turno con ${doctorName} es mañana`,
      html: htmlContent
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando recordatorio:', error.message);
    return { sent: false, error: error.message };
  }
}
