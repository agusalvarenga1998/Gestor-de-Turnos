import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { query } from '../db/config.js';
import { generateToken, verifyToken } from '../middleware/auth.js';
import * as googleAuthService from '../services/googleAuthService.js';
import { copyTemplateServicesToDoctor } from '../services/templateService.js';
import { logAction } from '../services/auditService.js';
import { generateSecret, verifyTOTP } from '../utils/totp.js';

const router = express.Router();

// URL del frontend (puede ser localhost o ngrok)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper para obtener el perfil completo con plan
export async function getDoctorProfileWithPlan(doctorId) {
  const result = await query(
    `SELECT 
      d.id, d.email, d.name, d.specialization, d.rubro, d.clinic_name, d.license_number, 
      d.phone, d.address, d.latitude, d.longitude, d.booking_fee, d.appointment_price, 
      d.status, d.subscription_status, d.trial_ends_at, d.subscription_expires_at, 
      d.mp_connected, d.plan_type, d.pricing_plan_id, d.commission_rate,
      d.notify_daily_summary_push, d.notify_advance_push, d.notify_advance_time, d.notify_email, d.notify_approval_push,
      d.two_factor_enabled, d.email_verified,
      p.name as plan_name, p.key as plan_key, p.allow_google_calendar, 
      p.allow_mercadopago, p.allow_telemedicine, p.allow_reminders, p.allow_insurance, p.allow_patient_booking,
      p.max_patients, p.max_appointments_monthly
     FROM doctors d
     LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
     WHERE d.id = $1`,
    [doctorId]
  );
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    specialization: row.specialization,
    rubro: row.rubro,
    clinic_name: row.clinic_name,
    license_number: row.license_number,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    booking_fee: row.booking_fee || 0,
    appointment_price: row.appointment_price || 0,
    status: row.status,
    subscription_status: row.subscription_status,
    trial_ends_at: row.trial_ends_at,
    subscription_expires_at: row.subscription_expires_at,
    mp_connected: row.mp_connected || false,
    plan_type: row.plan_type,
    pricing_plan_id: row.pricing_plan_id,
    commission_rate: parseFloat(row.commission_rate || 3),
    notify_daily_summary_push: row.notify_daily_summary_push !== false,
    notify_advance_push: row.notify_advance_push !== false,
    notify_advance_time: row.notify_advance_time !== null ? row.notify_advance_time : 15,
    notify_email: row.notify_email !== false,
    notify_approval_push: row.notify_approval_push !== false,
    two_factor_enabled: row.two_factor_enabled || false,
    email_verified: row.email_verified || false,
    plan: {
      name: row.plan_name || (row.plan_type === 'commission' ? 'Plan Comisión' : 'Plan Mensual'),
      key: row.plan_key || row.plan_type || 'monthly',
      allow_google_calendar: row.allow_google_calendar !== false,
      allow_mercadopago: row.allow_mercadopago !== false,
      allow_telemedicine: row.allow_telemedicine !== false,
      allow_reminders: row.allow_reminders !== false,
      allow_insurance: row.allow_insurance !== false,
      allow_patient_booking: row.allow_patient_booking !== false,
      max_patients: row.max_patients,
      max_appointments_monthly: row.max_appointments_monthly
    }
  };
}

// Registro de doctor (auto-aprobado con 30 días de prueba gratis)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, specialization, clinic_name, rubro } = req.body;

    // Validación básica
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, contraseña y nombre son requeridos'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verificar que el email no exista
    const existingDoctor = await query(
      'SELECT id FROM doctors WHERE email = $1',
      [normalizedEmail]
    );

    if (existingDoctor.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calcular fecha de fin de prueba (30 días)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Buscar ID del plan mensual por defecto
    const defaultPlanResult = await query("SELECT id FROM pricing_plans WHERE key = 'monthly' LIMIT 1");
    const defaultPlanId = defaultPlanResult.rows[0]?.id || null;

    // Crear doctor auto-aprobado con 30 días de prueba gratis
    const result = await query(
      `INSERT INTO doctors (email, password_hash, name, specialization, rubro, clinic_name, status, subscription_status, trial_ends_at, subscription_expires_at, approved_at, pricing_plan_id, plan_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved', 'trial', $7, $7, CURRENT_TIMESTAMP, $8, 'monthly')
       RETURNING id, email, name, specialization, rubro, clinic_name, status, subscription_status, trial_ends_at, subscription_expires_at`,
      [normalizedEmail, hashedPassword, name, specialization, rubro, clinic_name, trialEndsAt, defaultPlanId]
    );

    const doctor = result.rows[0];

    // Crear registro de suscripción para el trial
    await query(
      `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
       VALUES ($1, 0, 'approved', CURRENT_TIMESTAMP, $2)`,
      [doctor.id, trialEndsAt]
    );

    // Copiar servicios base si existen para esta especialidad
    if (specialization) {
      try {
        await copyTemplateServicesToDoctor(doctor.id, specialization);
      } catch (copyErr) {
        console.error('Error al precargar servicios base para el doctor:', copyErr);
      }
    }

    // Obtener el perfil completo con plan para el token y la respuesta
    const doctorProfile = await getDoctorProfileWithPlan(doctor.id);

    // Generar token - el usuario puede usar la app inmediatamente
    const token = generateToken(doctorProfile);

    // Auditoría
    await logAction(doctor.id, 'register', 'Registro de cuenta de doctor', req.ip);

    res.status(201).json({
      success: true,
      message: '¡Cuenta creada! Tienes 30 días de prueba gratis.',
      token,
      doctor: doctorProfile
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar doctor'
    });
  }
});

// Login de doctor
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Buscar doctor
    const result = await query(
      'SELECT * FROM doctors WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email o contraseña incorrectos'
      });
    }

    const doctor = result.rows[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, doctor.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email o contraseña incorrectos'
      });
    }

    // Verificar estado de aprobación
    if (doctor.status === 'pending') {
      return res.status(403).json({
        success: false,
        pending: true,
        message: 'Tu cuenta está pendiente de aprobación por el administrador'
      });
    }

    if (doctor.status === 'rejected') {
      return res.status(403).json({
        success: false,
        rejected: true,
        message: 'Tu solicitud de cuenta fue rechazada'
      });
    }

    if (doctor.status === 'suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: 'Tu cuenta ha sido suspendida'
      });
    }

    // Verificar suscripción
    const now = new Date();
    let subscriptionStatus = doctor.subscription_status;

    // Actualizar estado de suscripción basado en fechas
    if (subscriptionStatus === 'trial' && doctor.trial_ends_at && new Date(doctor.trial_ends_at) < now) {
      subscriptionStatus = 'expired';
    } else if (subscriptionStatus === 'active' && doctor.subscription_expires_at && new Date(doctor.subscription_expires_at) < now) {
      subscriptionStatus = 'expired';
    }

    if (subscriptionStatus === 'expired') {
      return res.status(403).json({
        success: false,
        subscriptionExpired: true,
        message: 'Tu período de prueba gratuita ha finalizado. Contactá al administrador para rehabilitar tu cuenta.'
      });
    }

    // Verificar si tiene 2FA habilitado
    if (doctor.two_factor_enabled) {
      await logAction(doctor.id, 'login_step1_2fa', 'Inicio de sesión - Paso 1: Requiere 2FA', req.ip);
      return res.json({
        success: true,
        requires2FA: true,
        doctorId: doctor.id,
        message: 'Por favor, ingresa el código de verificación de 2 factores.'
      });
    }

    // Obtener el perfil completo con plan para el token y la respuesta
    const doctorProfile = await getDoctorProfileWithPlan(doctor.id);
    
    // Sobrescribir status de suscripción actualizado si fue necesario
    doctorProfile.subscription_status = subscriptionStatus;

    // Generar token
    const token = generateToken(doctorProfile);

    // Auditoría
    await logAction(doctor.id, 'login', 'Inicio de sesión exitoso', req.ip);

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      doctor: doctorProfile
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
});

// Verificar token
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const doctorProfile = await getDoctorProfileWithPlan(req.user.id);

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    const now = new Date();
    let subscriptionStatus = doctorProfile.subscription_status;

    // Actualizar estado de suscripción basado en fechas
    if (subscriptionStatus === 'trial' && doctorProfile.trial_ends_at && new Date(doctorProfile.trial_ends_at) < now) {
      subscriptionStatus = 'expired';
    } else if (subscriptionStatus === 'active' && doctorProfile.subscription_expires_at && new Date(doctorProfile.subscription_expires_at) < now) {
      subscriptionStatus = 'expired';
    }

    doctorProfile.subscription_status = subscriptionStatus;

    res.json({
      success: true,
      doctor: doctorProfile
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar token'
    });
  }
});

// Logout (en cliente se borra el token)
router.post('/logout', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

// Actualizar perfil del doctor
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { 
      specialization, rubro, clinic_name, license_number, phone, address, 
      latitude: reqLat, longitude: reqLng, booking_fee, appointment_price, 
      mp_connected, mp_access_token,
      notify_daily_summary_push, notify_advance_push, notify_advance_time, 
      notify_email, notify_approval_push
    } = req.body;
    const doctorId = req.user.id;

    let latitude = null;
    let longitude = null;

    // Obtener datos actuales para comparar
    const currentDoctor = await query('SELECT address, latitude, longitude, specialization FROM doctors WHERE id = $1', [doctorId]);
    const oldAddress = currentDoctor.rows[0]?.address;
    const oldSpecialization = currentDoctor.rows[0]?.specialization;

    // Si se envían coordenadas directas, usarlas. 
    // De lo contrario, si la dirección cambió o no tiene coordenadas, geocodificar.
    if (reqLat !== undefined && reqLng !== undefined && reqLat !== null && reqLng !== null) {
      latitude = reqLat;
      longitude = reqLng;
      console.log(`📍 Usando coordenadas enviadas: ${latitude}, ${longitude}`);
    } else if (address && (address !== oldAddress || !currentDoctor.rows[0]?.latitude)) {
      try {
        console.log(`🌍 Geocodificando nueva dirección: ${address}`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'TurnoHub-App/1.0' }
        });
        const data = await geoRes.json();
        if (data && data.length > 0) {
          latitude = data[0].lat;
          longitude = data[0].lon;
          console.log(`✅ Ubicación encontrada automáticamente: ${latitude}, ${longitude}`);
        }
      } catch (err) {
        console.error('⚠️ Error en geocodificación automática:', err.message);
        // Mantenemos las coordenadas viejas si falla la búsqueda pero no bloqueamos el guardado
        latitude = currentDoctor.rows[0]?.latitude;
        longitude = currentDoctor.rows[0]?.longitude;
      }
    } else {
      latitude = currentDoctor.rows[0]?.latitude;
      longitude = currentDoctor.rows[0]?.longitude;
    }

    const result = await query(
      `UPDATE doctors
       SET specialization = COALESCE($1, specialization),
           clinic_name = COALESCE($2, clinic_name),
           license_number = COALESCE($3, license_number),
           phone = COALESCE($4, phone),
           address = COALESCE($5, address),
           clinic_address = COALESCE($5, clinic_address),
           latitude = $6,
           longitude = $7,
           booking_fee = COALESCE($8, booking_fee),
           appointment_price = COALESCE($12, appointment_price),
           mp_connected = COALESCE($10, mp_connected),
           mp_access_token = COALESCE($11, mp_access_token),
           rubro = COALESCE($13, rubro),
           notify_daily_summary_push = COALESCE($14, notify_daily_summary_push),
           notify_advance_push = COALESCE($15, notify_advance_push),
           notify_advance_time = COALESCE($16, notify_advance_time),
           notify_email = COALESCE($17, notify_email),
           notify_approval_push = COALESCE($18, notify_approval_push),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id`,
      [
        specialization, clinic_name, license_number, phone, address, 
        latitude, longitude, booking_fee, doctorId, mp_connected, 
        mp_access_token, appointment_price, rubro,
        notify_daily_summary_push, notify_advance_push, notify_advance_time, 
        notify_email, notify_approval_push
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    // Si la especialización cambió, copiar los servicios base correspondientes
    if (specialization && specialization !== oldSpecialization) {
      try {
        await copyTemplateServicesToDoctor(doctorId, specialization);
      } catch (copyErr) {
        console.error('Error al precargar servicios base tras actualización de especialidad:', copyErr);
      }
    }

    const doctorProfile = await getDoctorProfileWithPlan(doctorId);

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente con geolocalización',
      doctor: doctorProfile
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// ============ GOOGLE OAUTH ============

// Iniciar flujo de autenticación con Google
router.get('/google', (req, res) => {
  try {
    const authUrl = googleAuthService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error iniciando Google Auth:', error);
    res.status(500).json({
      success: false,
      message: 'Error iniciando sesión con Google'
    });
  }
});

// Callback de Google OAuth
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.log('❌ Error de Google:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

    console.log('\n🔵 === GOOGLE AUTH CALLBACK ===');
    console.log('Code recibido:', code.substring(0, 20) + '...');

    // Obtener información del usuario de Google
    const userInfo = await googleAuthService.getUserInfo(code);
    console.log('👤 Usuario Google:', userInfo.email);

    // Buscar doctor existente por google_id o email
    console.log('🔍 Buscando doctor existente...');
    const normalizedGoogleEmail = userInfo.email ? userInfo.email.trim().toLowerCase() : '';
    const result = await query(
      `SELECT * FROM doctors WHERE google_id = $1 OR email = $2`,
      [userInfo.id, normalizedGoogleEmail]
    );

    let doctor;

    if (result.rows.length > 0) {
      doctor = result.rows[0];
      console.log('✓ Doctor encontrado');

      // Si existe por email pero sin google_id, vinculamos
      if (!doctor.google_id) {
        console.log('🔗 Vinculando google_id y tokens a cuenta existente...');
        const updateResult = await query(
          `UPDATE doctors SET 
            google_id = $1, 
            google_access_token = $2, 
            google_refresh_token = $3,
            google_calendar_connected = true,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING *`,
          [userInfo.id, userInfo.tokens.access_token, userInfo.tokens.refresh_token, doctor.id]
        );
        doctor = updateResult.rows[0];
      } else {
        // Si ya tenía google_id, igual actualizamos los tokens por si cambiaron o para asegurar que tenemos el refresh_token
        console.log('🔄 Actualizando tokens de Google...');
        const updateResult = await query(
          `UPDATE doctors SET 
            google_access_token = $1, 
            google_refresh_token = COALESCE($2, google_refresh_token),
            google_calendar_connected = true,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [userInfo.tokens.access_token, userInfo.tokens.refresh_token, doctor.id]
        );
        doctor = updateResult.rows[0];
      }
    } else {
      // Buscar ID del plan mensual por defecto
      const defaultPlanResult = await query("SELECT id FROM pricing_plans WHERE key = 'monthly' LIMIT 1");
      const defaultPlanId = defaultPlanResult.rows[0]?.id || null;

      // Crear nuevo doctor auto-aprobado con 30 días de prueba
      console.log('➕ Creando nuevo doctor con Google (auto-aprobado)...');
      const newDoctorId = uuidv4();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      const insertResult = await query(
        `INSERT INTO doctors (id, google_id, email, name, google_access_token, google_refresh_token, google_calendar_connected, status, subscription_status, trial_ends_at, subscription_expires_at, approved_at, pricing_plan_id, plan_type)
         VALUES ($1, $2, $3, $4, $5, $6, true, 'approved', 'trial', $7, $7, CURRENT_TIMESTAMP, $8, 'monthly')
         RETURNING *`,
        [newDoctorId, userInfo.id, normalizedGoogleEmail, userInfo.name, userInfo.tokens.access_token, userInfo.tokens.refresh_token, trialEndsAt, defaultPlanId]
      );
      doctor = insertResult.rows[0];

      // Crear registro de suscripción para el trial
      await query(
        `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
         VALUES ($1, 0, 'approved', CURRENT_TIMESTAMP, $2)`,
        [doctor.id, trialEndsAt]
      );
      console.log('✓ Doctor creado con 30 días de prueba gratis');
    }

    // Verificar estado del doctor (solo aplica a cuentas existentes)
    if (doctor.status === 'pending') {
      console.log('⏳ Doctor pendiente de aprobación, redirigiendo a página de estado...');
      const redirectUrl = `${FRONTEND_URL}/account-pending`;
      console.log('🔄 Redirigiendo a:', redirectUrl);
      console.log('✓ Flujo completado\n');
      return res.redirect(redirectUrl);
    }

    if (doctor.status === 'suspended') {
      console.log('❌ Doctor suspendido, redirigiendo a página de cuenta suspendida...');
      const redirectUrl = `${FRONTEND_URL}/account-suspended`;
      console.log('🔄 Redirigiendo a:', redirectUrl);
      console.log('✓ Flujo completado\n');
      return res.redirect(redirectUrl);
    }

    if (doctor.status === 'rejected') {
      console.log('❌ Doctor rechazado, redirigiendo a login...');
      const redirectUrl = `${FRONTEND_URL}/login?error=${encodeURIComponent('Tu solicitud de cuenta fue rechazada')}`;
      console.log('🔄 Redirigiendo a:', redirectUrl.split('?')[0]);
      console.log('✓ Flujo completado\n');
      return res.redirect(redirectUrl);
    }

    // Verificar suscripción
    const now = new Date();
    let isExpired = false;
    if (doctor.subscription_status === 'trial' && doctor.trial_ends_at && new Date(doctor.trial_ends_at) < now) {
      isExpired = true;
    } else if (doctor.subscription_status === 'active' && doctor.subscription_expires_at && new Date(doctor.subscription_expires_at) < now) {
      isExpired = true;
    } else if (doctor.subscription_status === 'expired') {
      isExpired = true;
    }

    if (isExpired) {
      console.log('⏳ Suscripción expirada, redirigiendo a página de expiración...');
      const redirectUrl = `${FRONTEND_URL}/subscription-expired`;
      console.log('🔄 Redirigiendo a:', redirectUrl);
      console.log('✓ Flujo completado\n');
      return res.redirect(redirectUrl);
    }

    // Generar JWT
    const token = generateToken(doctor);
    console.log('✓ JWT generado');

    // Redirigir al cliente con el token
    // Si viene del flujo de vincular calendario (tiene doctorId en state), redirigimos a settings
    let redirectUrl = `${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`;
    
    if (state && state.length > 20) { // Si el state parece un UUID (doctorId)
      redirectUrl = `${FRONTEND_URL}/settings?token=${encodeURIComponent(token)}&connected=true`;
    }
    
    console.log('🔄 Redirigiendo a:', redirectUrl.split('?')[0]);
    console.log('✓ Flujo completado\n');

    // Auditoría de login con Google
    await logAction(doctor.id, 'login_google', 'Inicio de sesión con Google exitoso', req.ip);

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Error en Google callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
  }
});

// ==========================================
// NUEVOS ENDPOINTS DE SEGURIDAD Y AUDITORÍA
// ==========================================

// Login Step 2: Verificar 2FA
router.post('/login/2fa', async (req, res) => {
  try {
    const { doctorId, code } = req.body;
    if (!doctorId || !code) {
      return res.status(400).json({ success: false, message: 'ID de doctor y código son requeridos' });
    }

    const result = await query('SELECT * FROM doctors WHERE id = $1', [doctorId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
    }

    const doctor = result.rows[0];

    if (!verifyTOTP(doctor.two_factor_secret, code)) {
      await logAction(doctor.id, 'login_2fa_failed', 'Intento de 2FA fallido (código inválido)', req.ip);
      return res.status(401).json({ success: false, message: 'Código de segundo factor incorrecto' });
    }

    const doctorProfile = await getDoctorProfileWithPlan(doctor.id);
    const token = generateToken(doctorProfile);

    await logAction(doctor.id, 'login', 'Inicio de sesión con 2FA exitoso', req.ip);

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      doctor: doctorProfile
    });
  } catch (error) {
    console.error('Error en login 2FA:', error);
    res.status(500).json({ success: false, message: 'Error al procesar login 2FA' });
  }
});

// Recuperar contraseña - Paso 1: Enviar correo/token
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'El email es requerido' });
    }

    const result = await query('SELECT id, name FROM doctors WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rows.length === 0) {
      // Por seguridad, retornamos éxito simulado para evitar escaneo de cuentas
      return res.json({ success: true, message: 'Si el correo existe, se enviará un enlace de recuperación.' });
    }

    const doctor = result.rows[0];
    const resetToken = uuidv4();

    // Guardar token en base de datos
    await query('UPDATE doctors SET verification_token = $1 WHERE id = $2', [resetToken, doctor.id]);

    // Auditoría
    await logAction(doctor.id, 'forgot_password', { token: resetToken }, req.ip);

    // Nota: Aquí se enviaría el correo real mediante nodemailer. 
    // Para simulaciones y desarrollo local, retornamos el token en la respuesta para facilitar la prueba
    res.json({
      success: true,
      message: 'Se ha generado el token de recuperación.',
      resetToken, // En producción real esto no se retornaría en el JSON sino solo en el email
      simulatedEmailSent: true
    });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Recuperar contraseña - Paso 2: Reseteo
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token y contraseña nueva son requeridos' });
    }

    const result = await query('SELECT id FROM doctors WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Token inválido o expirado' });
    }

    const doctor = result.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña e invalidar token de recuperación e invalidar sesiones previas incrementando token_version
    await query(
      `UPDATE doctors 
       SET password_hash = $1, 
           verification_token = NULL,
           token_version = token_version + 1
       WHERE id = $2`, 
      [hashedPassword, doctor.id]
    );

    await logAction(doctor.id, 'reset_password', 'Contraseña restablecida correctamente', req.ip);

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Por favor, inicia sesión con tu nueva contraseña.'
    });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ success: false, message: 'Error al restablecer contraseña' });
  }
});

// Enviar verificación de email (Protegida)
router.post('/profile/send-verification', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const verificationToken = uuidv4();

    await query('UPDATE doctors SET verification_token = $1 WHERE id = $2', [verificationToken, doctorId]);
    await logAction(doctorId, 'send_verification', { token: verificationToken }, req.ip);

    res.json({
      success: true,
      message: 'Código de verificación generado.',
      verificationToken, // Retornado para fines de simulación local
      simulatedEmailSent: true
    });
  } catch (error) {
    console.error('Error al enviar verificación:', error);
    res.status(500).json({ success: false, message: 'Error al enviar código de verificación' });
  }
});

// Verificar email con Token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send('<h1>Error</h1><p>Falta el token de verificación</p>');
    }

    const result = await query('SELECT id FROM doctors WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) {
      return res.status(400).send('<h1>Error</h1><p>Token inválido o expirado</p>');
    }

    const doctorId = result.rows[0].id;
    await query('UPDATE doctors SET email_verified = true, verification_token = NULL WHERE id = $1', [doctorId]);
    await logAction(doctorId, 'verify_email', 'Correo verificado exitosamente', req.ip);

    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 3rem;">
        <h1 style="color: #16a34a;">✓ Correo Verificado</h1>
        <p>Tu correo ha sido verificado con éxito. Ya puedes volver a la aplicación de TurnoHub.</p>
        <button onclick="window.close()" style="padding: 0.5rem 1.5rem; background: #16a34a; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 1rem;">Cerrar pestaña</button>
      </div>
    `);
  } catch (error) {
    console.error('Error al verificar email:', error);
    res.status(500).send('<h1>Error</h1><p>Error interno del servidor</p>');
  }
});

// Cerrar sesión en todos los dispositivos (Protegida)
router.post('/profile/logout-all', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Incrementar token_version invalida todos los JWTs anteriores de inmediato
    await query('UPDATE doctors SET token_version = token_version + 1 WHERE id = $1', [doctorId]);
    await logAction(doctorId, 'logout_all_devices', 'Sesión cerrada en todos los dispositivos', req.ip);

    res.json({
      success: true,
      message: 'Se ha cerrado la sesión en todos tus dispositivos correctamente.'
    });
  } catch (error) {
    console.error('Error en logout global:', error);
    res.status(500).json({ success: false, message: 'Error al cerrar sesión global' });
  }
});

// Configurar 2FA - Paso 1: Generar secreto y código QR (Protegida)
router.post('/profile/2fa/setup', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const doctorRes = await query('SELECT email FROM doctors WHERE id = $1', [doctorId]);
    const email = doctorRes.rows[0]?.email || 'doctor';

    const secret = generateSecret();
    
    // Guardar secreto de forma temporal (todavía no activado)
    await query('UPDATE doctors SET two_factor_secret = $1 WHERE id = $2', [secret, doctorId]);
    await logAction(doctorId, 'setup_2fa_started', 'Iniciada configuración de 2FA', req.ip);

    const qrData = `otpauth://totp/TurnoHub:${email}?secret=${secret}&issuer=TurnoHub`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

    res.json({
      success: true,
      secret,
      qrCodeUrl
    });
  } catch (error) {
    console.error('Error en setup 2FA:', error);
    res.status(500).json({ success: false, message: 'Error al configurar 2FA' });
  }
});

// Configurar 2FA - Paso 2: Activar o desactivar verificando código (Protegida)
router.post('/profile/2fa/verify', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { code, enable } = req.body; // enable: true para activar, false para desactivar

    if (!code) {
      return res.status(400).json({ success: false, message: 'Código de verificación requerido' });
    }

    const doctorRes = await query('SELECT two_factor_secret, two_factor_enabled FROM doctors WHERE id = $1', [doctorId]);
    const doctor = doctorRes.rows[0];

    if (!doctor || !doctor.two_factor_secret) {
      return res.status(400).json({ success: false, message: 'No se ha iniciado la configuración de 2FA. Iníciala primero.' });
    }

    if (!verifyTOTP(doctor.two_factor_secret, code)) {
      return res.status(400).json({ success: false, message: 'Código de verificación incorrecto' });
    }

    if (enable) {
      await query('UPDATE doctors SET two_factor_enabled = true WHERE id = $1', [doctorId]);
      await logAction(doctorId, 'enable_2fa', 'Doble factor de autenticación habilitado', req.ip);
      res.json({ success: true, message: 'Autenticación de dos factores habilitada exitosamente.' });
    } else {
      await query('UPDATE doctors SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1', [doctorId]);
      await logAction(doctorId, 'disable_2fa', 'Doble factor de autenticación deshabilitado', req.ip);
      res.json({ success: true, message: 'Autenticación de dos factores deshabilitada exitosamente.' });
    }
  } catch (error) {
    console.error('Error al verificar código 2FA:', error);
    res.status(500).json({ success: false, message: 'Error interno en verificación 2FA' });
  }
});

// Exportación de datos de usuario completa (Protegida)
router.get('/profile/export', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Obtener toda la información relacionada del doctor
    const [doctorRes, appointmentsRes, servicesRes, patientsRes, movementsRes, logsRes] = await Promise.all([
      query('SELECT id, email, name, specialization, rubro, phone, clinic_name, clinic_address, created_at FROM doctors WHERE id = $1', [doctorId]),
      query('SELECT id, patient_id, appointment_date, appointment_time, status, reason_for_visit, total_price, booking_fee_paid, payment_status, created_at FROM appointments WHERE doctor_id = $1', [doctorId]),
      query('SELECT id, name, description, price, duration_minutes, booking_fee, is_active FROM services WHERE doctor_id = $1', [doctorId]),
      query('SELECT id, email, phone, name, date_of_birth, address, is_active FROM patients WHERE doctor_id = $1', [doctorId]),
      query('SELECT id, appointment_id, amount, type, payment_method, description, created_at FROM movements WHERE doctor_id = $1', [doctorId]),
      query('SELECT action, details, ip_address, created_at FROM audit_logs WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 100', [doctorId])
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: doctorRes.rows[0] || {},
      services: servicesRes.rows || [],
      patients: patientsRes.rows || [],
      appointments: appointmentsRes.rows || [],
      movements: movementsRes.rows || [],
      recent_audit_logs: logsRes.rows || []
    };

    await logAction(doctorId, 'export_data', 'Exportación de datos de la cuenta completada', req.ip);

    res.setHeader('Content-disposition', `attachment; filename=turnohub_backup_${doctorId}.json`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(exportData, null, 2));
    res.end();
  } catch (error) {
    console.error('Error al exportar datos:', error);
    res.status(500).json({ success: false, message: 'Error al exportar datos' });
  }
});

// Eliminar cuenta completa (Protegida)
router.delete('/profile/delete-account', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Primero auditamos la eliminación (aunque se borre el doctor en cascada, guardamos log en consola y ejecutamos borrado)
    console.log(`⚠️ ELIMINANDO CUENTA DEL DOCTOR ID: ${doctorId}`);
    
    await query('DELETE FROM doctors WHERE id = $1', [doctorId]);

    res.json({
      success: true,
      message: 'Tu cuenta ha sido eliminada permanentemente del sistema de TurnoHub.'
    });
  } catch (error) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar cuenta' });
  }
});

// Solicitud de recuperación de contraseña (Pública)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'El correo electrónico es requerido.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Buscar doctor
    const result = await query(
      'SELECT id, name, email FROM doctors WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      // Retornar éxito de todas formas por seguridad (para evitar enumeración de cuentas)
      return res.json({
        success: true,
        message: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.'
      });
    }

    const doctor = result.rows[0];
    const token = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Expira en 1 hora

    // Guardar token y expiración
    await query(
      `UPDATE doctors 
       SET reset_password_token = $1, 
           reset_password_expires = $2 
       WHERE id = $3`,
      [token, expires, doctor.id]
    );

    // Enviar email
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    await sendPasswordResetEmail({
      to: doctor.email,
      doctorName: doctor.name,
      resetUrl
    });

    res.json({
      success: true,
      message: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.'
    });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Restablecer contraseña con token (Pública)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'El token y la nueva contraseña son requeridos.' });
    }

    // Buscar doctor con token válido y que no haya expirado
    const result = await query(
      `SELECT id FROM doctors 
       WHERE reset_password_token = $1 
         AND reset_password_expires > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El enlace de recuperación es inválido o ha expirado.'
      });
    }

    const doctor = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y limpiar campos de token
    await query(
      `UPDATE doctors 
       SET password_hash = $1, 
           reset_password_token = NULL, 
           reset_password_expires = NULL,
           token_version = token_version + 1
       WHERE id = $2`,
      [passwordHash, doctor.id]
    );

    res.json({
      success: true,
      message: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

export default router;
