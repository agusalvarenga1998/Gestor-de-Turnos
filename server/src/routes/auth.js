import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { query } from '../db/config.js';
import { generateToken, verifyToken } from '../middleware/auth.js';
import * as googleAuthService from '../services/googleAuthService.js';

const router = express.Router();

// URL del frontend (puede ser localhost o ngrok)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Registro de doctor (auto-aprobado con 30 días de prueba gratis)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, specialization, clinic_name } = req.body;

    // Validación básica
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, contraseña y nombre son requeridos'
      });
    }

    // Verificar que el email no exista
    const existingDoctor = await query(
      'SELECT id FROM doctors WHERE email = $1',
      [email]
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

    // Crear doctor auto-aprobado con 30 días de prueba gratis
    const result = await query(
      `INSERT INTO doctors (email, password_hash, name, specialization, clinic_name, status, subscription_status, trial_ends_at, subscription_expires_at, approved_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', 'trial', $6, $6, CURRENT_TIMESTAMP)
       RETURNING id, email, name, specialization, clinic_name, status, subscription_status, trial_ends_at, subscription_expires_at`,
      [email, hashedPassword, name, specialization, clinic_name, trialEndsAt]
    );

    const doctor = result.rows[0];

    // Crear registro de suscripción para el trial
    await query(
      `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
       VALUES ($1, 0, 'approved', CURRENT_TIMESTAMP, $2)`,
      [doctor.id, trialEndsAt]
    );

    // Generar token - el usuario puede usar la app inmediatamente
    const token = generateToken(doctor);

    res.status(201).json({
      success: true,
      message: '¡Cuenta creada! Tienes 30 días de prueba gratis.',
      token,
      doctor: {
        id: doctor.id,
        email: doctor.email,
        name: doctor.name,
        specialization: doctor.specialization,
        clinic_name: doctor.clinic_name,
        status: doctor.status,
        subscription_status: doctor.subscription_status,
        trial_ends_at: doctor.trial_ends_at,
        subscription_expires_at: doctor.subscription_expires_at
      }
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

    // Buscar doctor
    const result = await query(
      'SELECT * FROM doctors WHERE email = $1',
      [email]
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

    // Generar token
    const token = generateToken({
      ...doctor,
      subscription_status: subscriptionStatus
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      doctor: {
        id: doctor.id,
        email: doctor.email,
        name: doctor.name,
        specialization: doctor.specialization,
        clinic_name: doctor.clinic_name,
        license_number: doctor.license_number,
        phone: doctor.phone,
        address: doctor.address,
        latitude: doctor.latitude,
        longitude: doctor.longitude,
        booking_fee: doctor.booking_fee || 0,
        appointment_price: doctor.appointment_price || 0,
        status: doctor.status,
        subscription_status: subscriptionStatus,
        trial_ends_at: doctor.trial_ends_at,
        subscription_expires_at: doctor.subscription_expires_at,
        mp_connected: doctor.mp_connected || false
      }
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
    const doctor = await query(
      `SELECT id, email, name, specialization, clinic_name, license_number, phone, address, latitude, longitude, booking_fee, appointment_price, status, subscription_status, trial_ends_at, subscription_expires_at, mp_connected
       FROM doctors WHERE id = $1`,
      [req.user.id]
    );

    if (doctor.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    const doctorData = doctor.rows[0];
    const now = new Date();
    let subscriptionStatus = doctorData.subscription_status;

    // Actualizar estado de suscripción basado en fechas
    if (subscriptionStatus === 'trial' && doctorData.trial_ends_at && new Date(doctorData.trial_ends_at) < now) {
      subscriptionStatus = 'expired';
    } else if (subscriptionStatus === 'active' && doctorData.subscription_expires_at && new Date(doctorData.subscription_expires_at) < now) {
      subscriptionStatus = 'expired';
    }

    res.json({
      success: true,
      doctor: {
        ...doctorData,
        subscription_status: subscriptionStatus
      }
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
    const { specialization, clinic_name, license_number, phone, address, latitude: reqLat, longitude: reqLng, booking_fee, appointment_price, mp_connected, mp_access_token } = req.body;
    const doctorId = req.user.id;

    let latitude = null;
    let longitude = null;

    // Obtener datos actuales para comparar
    const currentDoctor = await query('SELECT address, latitude, longitude FROM doctors WHERE id = $1', [doctorId]);
    const oldAddress = currentDoctor.rows[0]?.address;

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
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, email, name, specialization, clinic_name, license_number, phone, address, latitude, longitude, booking_fee, appointment_price, mp_connected`,
      [specialization, clinic_name, license_number, phone, address, latitude, longitude, booking_fee, doctorId, mp_connected, mp_access_token, appointment_price]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente con geolocalización',
      doctor: result.rows[0]
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
    const result = await query(
      `SELECT * FROM doctors WHERE google_id = $1 OR email = $2`,
      [userInfo.id, userInfo.email]
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
      // Crear nuevo doctor auto-aprobado con 30 días de prueba
      console.log('➕ Creando nuevo doctor con Google (auto-aprobado)...');
      const newDoctorId = uuidv4();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      const insertResult = await query(
        `INSERT INTO doctors (id, google_id, email, name, google_access_token, google_refresh_token, google_calendar_connected, status, subscription_status, trial_ends_at, subscription_expires_at, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, 'approved', 'trial', $7, $7, CURRENT_TIMESTAMP)
         RETURNING *`,
        [newDoctorId, userInfo.id, userInfo.email, userInfo.name, userInfo.tokens.access_token, userInfo.tokens.refresh_token, trialEndsAt]
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

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Error en Google callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
  }
});

export default router;
