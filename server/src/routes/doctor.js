import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import { query, transaction } from '../db/config.js';
import { getAppointmentsForToday, getAppointmentsByDoctor } from '../services/appointmentService.js';
import { getPatientsByDoctor } from '../services/patientService.js';
import { getDashboard, getStatistics } from '../controllers/doctorController.js';
import { copyTemplateServicesToDoctor } from '../services/templateService.js';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Middleware global para todas las rutas de doctor (protegidas)
router.use(verifyToken);

// --- RUTAS DE SUSCRIPCIÓN (Accesibles aunque la suscripción esté expirada) ---
const verifyOnlyDoctorRole = (req, res, next) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo doctores pueden acceder a este recurso.'
    });
  }
  next();
};

router.get('/subscriptions/history', verifyOnlyDoctorRole, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.amount, s.status, s.period_start, s.period_end, s.created_at, p.name as plan_name, p.price_period
       FROM subscriptions s
       LEFT JOIN pricing_plans p ON s.pricing_plan_id = p.id
       WHERE s.doctor_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, subscriptions: result.rows });
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/subscriptions/request', verifyOnlyDoctorRole, async (req, res) => {
  try {
    const { pricing_plan_id } = req.body;
    if (!pricing_plan_id) {
      return res.status(400).json({ success: false, message: 'pricing_plan_id is required' });
    }

    const planResult = await query('SELECT id, name, price FROM pricing_plans WHERE id = $1', [pricing_plan_id]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const plan = planResult.rows[0];
    const result = await query(
      `INSERT INTO subscriptions (doctor_id, pricing_plan_id, amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [req.user.id, plan.id, plan.price]
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de plan creada. Pendiente de aprobación del administrador.',
      subscription: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating subscription request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/subscriptions/mercadopago-preference', verifyOnlyDoctorRole, async (req, res) => {
  try {
    const { pricing_plan_id } = req.body;
    if (!pricing_plan_id) {
      return res.status(400).json({ success: false, message: 'pricing_plan_id is required' });
    }

    const planResult = await query('SELECT id, name, price FROM pricing_plans WHERE id = $1', [pricing_plan_id]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    const plan = planResult.rows[0];

    // Obtener email del doctor
    const doctorResult = await query('SELECT email FROM doctors WHERE id = $1', [req.user.id]);
    const doctorEmail = doctorResult.rows[0]?.email;

    // Crear un registro de suscripción pendiente para trackear el pago
    const subResult = await query(
      `INSERT INTO subscriptions (doctor_id, pricing_plan_id, amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [req.user.id, plan.id, plan.price]
    );
    const subscriptionId = subResult.rows[0].id;

    // Obtener token de la plataforma (admin) para crear la preferencia
    const { createSubscriptionPreference } = await import('../services/mercadopagoService.js');
    const adminTokenResult = await query("SELECT mp_access_token FROM admins WHERE mp_connected = true LIMIT 1");
    const platformToken = (adminTokenResult.rows.length > 0 && adminTokenResult.rows[0].mp_access_token)
      ? adminTokenResult.rows[0].mp_access_token
      : (process.env.MP_ACCESS_TOKEN || 'APP_USR-3334296268871714-041414-dcbc9a327d0a87b9e037764d80e95f57-161301647');

    const preference = await createSubscriptionPreference({
      subscriptionId,
      planName: plan.name,
      price: plan.price,
      doctorEmail
    }, platformToken);

    res.json({
      success: true,
      preferenceId: preference.id,
      initPoint: preference.init_point
    });
  } catch (error) {
    console.error('Error creating subscription preference:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- RESTO DE RUTAS DE DOCTOR (Requieren suscripción activa) ---
router.use(verifyDoctorRole);
router.use(checkSubscription);

// Obtener perfil del doctor
router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, specialization, rubro, phone, clinic_name, clinic_address, profile_image_url, latitude, longitude, booking_fee
       FROM doctors WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil del doctor'
    });
  }
});

// Actualizar perfil del doctor
router.patch('/profile', async (req, res) => {
  try {
    const { name, specialization, rubro, phone, clinic_name, clinic_address, latitude, longitude, booking_fee } = req.body;

    const oldDoctorRes = await query('SELECT specialization FROM doctors WHERE id = $1', [req.user.id]);
    const oldSpecialization = oldDoctorRes.rows[0]?.specialization;

    const result = await query(
      `UPDATE doctors
       SET name = COALESCE($1, name),
           specialization = COALESCE($2, specialization),
           phone = COALESCE($3, phone),
           clinic_name = COALESCE($4, clinic_name),
           clinic_address = COALESCE($5, clinic_address),
           latitude = COALESCE($6, latitude),
           longitude = COALESCE($7, longitude),
           booking_fee = COALESCE($8, booking_fee),
           rubro = COALESCE($10, rubro),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, email, name, specialization, rubro, phone, clinic_name, clinic_address, latitude, longitude, booking_fee`,
      [name, specialization, phone, clinic_name, clinic_address, latitude, longitude, booking_fee, req.user.id, rubro]
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
        await copyTemplateServicesToDoctor(req.user.id, specialization);
      } catch (copyErr) {
        console.error('Error al precargar servicios base tras actualizar perfil (PATCH):', copyErr);
      }
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// Dashboard del doctor (resumen)
router.get('/dashboard', getDashboard);

// Estadísticas del doctor
router.get('/statistics', getStatistics);

// Obtener horarios de trabajo del doctor
router.get('/working-hours', async (req, res) => {
  try {
    const doctorId = req.user.id;

    console.log('GET /working-hours - Doctor ID:', doctorId);

    const result = await query(
      'SELECT * FROM doctor_availability WHERE doctor_id = $1 ORDER BY day_of_week',
      [doctorId]
    );

    console.log('Horarios obtenidos:', result.rows.length);

    res.json({
      success: true,
      availability: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener horarios de trabajo'
    });
  }
});

// Actualizar horarios de trabajo del doctor
router.post('/working-hours', async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { availability } = req.body;

    console.log('POST /working-hours - Doctor ID:', doctorId);
    console.log('Horarios a guardar:', availability.length);

    await transaction(async (client) => {
      // Eliminar horarios existentes
      await client.query(
        'DELETE FROM doctor_availability WHERE doctor_id = $1',
        [doctorId]
      );

      // Insertar nuevos horarios (todos, activos e inactivos)
      for (const hours of availability) {
        await client.query(
          `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
           VALUES ($1, $2, $3, $4, $5)`,
          [doctorId, hours.day_of_week, hours.start_time, hours.end_time, hours.is_available]
        );
      }
    });

    console.log('✓ Horarios guardados correctamente');

    res.json({
      success: true,
      message: 'Horarios actualizados correctamente'
    });
  } catch (error) {
    console.error('Error actualizando horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar horarios'
    });
  }
});

// Obtener VAPID Public Key
router.get('/push-subscription/public-key', async (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ success: false, message: 'VAPID public key not generated' });
    }
    res.json({ success: true, publicKey });
  } catch (error) {
    console.error('Error al obtener la clave pública VAPID:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Guardar suscripción Push
router.post('/push-subscription', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Suscripción inválida' });
    }

    const { endpoint } = subscription;
    const p256dh = subscription.keys?.p256dh || '';
    const auth = subscription.keys?.auth || '';

    // Insertar o actualizar la suscripción
    await query(`
      INSERT INTO doctor_push_subscriptions (doctor_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) 
      DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = CURRENT_TIMESTAMP
    `, [req.user.id, endpoint, p256dh, auth]);

    res.json({ success: true, message: 'Suscripción registrada exitosamente' });
  } catch (error) {
    console.error('Error al guardar suscripción push:', error);
    res.status(500).json({ success: false, message: 'Error interno al guardar suscripción' });
  }
});

// Eliminar suscripción Push (dar de baja dispositivo)
router.post('/push-subscription/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint requerido' });
    }

    await query('DELETE FROM doctor_push_subscriptions WHERE endpoint = $1', [endpoint]);

    res.json({ success: true, message: 'Suscripción eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar suscripción push:', error);
    res.status(500).json({ success: false, message: 'Error interno al eliminar suscripción' });
  }
});

// Enviar push de prueba
router.post('/push-subscription/test', async (req, res) => {
  try {
    const result = await query(
      'SELECT endpoint, p256dh, auth FROM doctor_push_subscriptions WHERE doctor_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No tienes ningún dispositivo suscrito. Por favor, activa las notificaciones primero.' });
    }

    const payload = {
      title: '¡Funciona! 🎉',
      body: 'Esta es una notificación de prueba de TurnoHub.',
      url: '/settings'
    };

    const notificationsPromises = result.rows.map(sub => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(
        pushConfig,
        JSON.stringify(payload)
      ).catch(err => {
        console.error(`❌ Error enviando push de prueba al endpoint ${sub.endpoint}:`, err.message);
        throw err;
      });
    });

    await Promise.all(notificationsPromises);
    res.json({ success: true, message: `Notificación de prueba enviada con éxito a ${result.rows.length} dispositivo(s).` });
  } catch (error) {
    console.error('Error al enviar push de prueba:', error);
    res.status(500).json({ success: false, message: 'Error al enviar notificación: ' + error.message });
  }
});

// Obtener logs de depuración de notificaciones push
router.get('/push-subscription/debug-logs', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'push_debug.log');
    if (!fs.existsSync(logPath)) {
      return res.json({ success: true, logs: 'No hay logs de depuración registrados aún.' });
    }
    const logs = fs.readFileSync(logPath, 'utf8');
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error al leer logs de depuración:', error);
    res.status(500).json({ success: false, message: 'Error al obtener logs: ' + error.message });
  }
});

export default router;
