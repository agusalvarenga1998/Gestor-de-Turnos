import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';
import { sendProfessionalApprovalEmail } from '../services/emailService.js';
import multer from 'multer';
import XLSX from 'xlsx';
import { getAllTicketsAdmin, updateTicketStatusAdmin } from '../controllers/supportController.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query(
      'SELECT id, email, password_hash, name FROM admins WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all doctors with their status and subscription info
router.get('/doctors', verifyAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        email,
        name,
        specialization,
        clinic_name,
        status,
        subscription_status,
        subscription_expires_at,
        trial_ends_at,
        approved_at,
        accumulated_debt,
        plan_type,
        pricing_plan_id,
        commission_rate,
        created_at
      FROM doctors
      ORDER BY created_at DESC
    `);

    res.json({ success: true, doctors: result.rows });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Approve a doctor (start trial)
router.patch('/doctors/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount = 0 } = req.body; // Accept amount from request
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 days trial

    const result = await query(
      `UPDATE doctors
       SET status = 'approved',
           subscription_status = 'trial',
           trial_ends_at = $1,
           subscription_expires_at = $1,
           approved_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, name, status, subscription_status, trial_ends_at`,
      [trialEndsAt, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Create subscription record for trial
    const doctor = result.rows[0];
    const now = new Date();
    await query(
      `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
       VALUES ($1, $2, 'approved', $3, $4)`,
      [id, parseFloat(amount), now, trialEndsAt]
    );

    // Enviar email de aprobación al profesional
    try {
      await sendProfessionalApprovalEmail({
        to: doctor.email,
        name: doctor.name,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
      });
    } catch (emailError) {
      console.error('Email error triggered but continuing:', emailError);
    }

    res.json({
      success: true,
      message: 'Doctor approved and trial started',
      doctor
    });
  } catch (error) {
    console.error('Approve doctor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject a doctor
router.patch('/doctors/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE doctors
       SET status = 'rejected'
       WHERE id = $1
       RETURNING id, email, name, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Doctor rejected',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Reject doctor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Suspend a doctor
router.patch('/doctors/:id/suspend', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE doctors
       SET status = 'suspended'
       WHERE id = $1
       RETURNING id, email, name, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Doctor suspended',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Suspend doctor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reactivate suspended/expired doctor account
router.patch('/doctors/:id/reactivate', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const result = await query(
      `UPDATE doctors
       SET status = 'approved',
           subscription_status = 'active',
           subscription_expires_at = $1
       WHERE id = $2 AND (status = 'suspended' OR subscription_status = 'expired')
       RETURNING id, email, name, status, subscription_status, trial_ends_at, subscription_expires_at`,
      [expiresAt, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Doctor not found or not suspended/expired'
      });
    }

    // Crear registro de suscripción
    const doctor = result.rows[0];
    await query(
      `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
       VALUES ($1, 0, 'approved', CURRENT_TIMESTAMP, $2)`,
      [id, expiresAt]
    );

    res.json({
      success: true,
      message: 'Cuenta reactivada con 30 días de suscripción',
      doctor
    });
  } catch (error) {
    console.error('Reactivate doctor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset doctor's debt to zero
router.patch('/doctors/:id/reset-debt', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE doctors
       SET accumulated_debt = 0
       WHERE id = $1
       RETURNING id, name, accumulated_debt`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Deuda saldada correctamente',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Reset debt error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Extend subscription manually
router.post('/doctors/:id/extend', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30, amount = 0 } = req.body; // Accept days and amount

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(days));

    const result = await query(
      `UPDATE doctors
       SET subscription_status = 'active',
           subscription_expires_at = $1
       WHERE id = $2
       RETURNING id, email, name, subscription_status, subscription_expires_at`,
      [expiresAt, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Create subscription record for extension
    const doctor = result.rows[0];
    await query(
      `INSERT INTO subscriptions (doctor_id, amount, status, period_start, period_end)
       VALUES ($1, $2, 'approved', $3, $4)`,
      [id, parseFloat(amount), now, expiresAt]
    );

    res.json({
      success: true,
      message: `Subscription extended by ${days} days`,
      doctor
    });
  } catch (error) {
    console.error('Extend subscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get subscription history
router.get('/subscriptions', verifyAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id,
        s.doctor_id,
        d.email,
        d.name,
        s.amount,
        s.status,
        s.period_start,
        s.period_end,
        s.created_at
      FROM subscriptions s
      LEFT JOIN doctors d ON s.doctor_id = d.id
      ORDER BY s.created_at DESC
    `);

    res.json({ success: true, subscriptions: result.rows });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve a subscription request and activate plan
router.patch('/subscriptions/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener la solicitud de suscripción
    const subResult = await query(
      'SELECT id, doctor_id, pricing_plan_id, amount FROM subscriptions WHERE id = $1 AND status = \'pending\'',
      [id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud de suscripción pendiente no encontrada' });
    }

    const subscription = subResult.rows[0];

    // 2. Buscar el plan solicitado
    const planResult = await query(
      'SELECT id, key FROM pricing_plans WHERE id = $1',
      [subscription.pricing_plan_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan comercial no encontrado' });
    }

    const plan = planResult.rows[0];
    const plan_type = plan.key === 'commission' ? 'commission' : 'monthly';

    // 3. Calcular vencimiento de suscripción (30 días a partir de hoy)
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 4. Actualizar doctor
    await query(
      `UPDATE doctors
       SET subscription_status = 'active',
           subscription_expires_at = $1,
           pricing_plan_id = $2,
           plan_type = $3
       WHERE id = $4`,
      [expiresAt, plan.id, plan_type, subscription.doctor_id]
    );

    // 5. Actualizar registro de suscripción
    const updatedSubResult = await query(
      `UPDATE subscriptions
       SET status = 'approved',
           period_start = $1,
           period_end = $2
       WHERE id = $3
       RETURNING *`,
      [now, expiresAt, id]
    );

    res.json({
      success: true,
      message: 'Suscripción aprobada y plan activado con éxito.',
      subscription: updatedSubResult.rows[0]
    });
  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject a subscription request
router.patch('/subscriptions/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE subscriptions
       SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud de suscripción pendiente no encontrada' });
    }

    res.json({
      success: true,
      message: 'Solicitud de suscripción rechazada.',
      subscription: result.rows[0]
    });
  } catch (error) {
    console.error('Reject subscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update doctor's plan
router.patch('/doctors/:id/plan', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { pricing_plan_id, commission_rate } = req.body;

    if (!pricing_plan_id) {
      const defaultPlanResult = await query(
        "SELECT id FROM pricing_plans WHERE key = 'monthly' LIMIT 1"
      );
      if (defaultPlanResult.rows.length > 0) {
        pricing_plan_id = defaultPlanResult.rows[0].id;
      } else {
        return res.status(400).json({ error: 'pricing_plan_id is required' });
      }
    }

    // Buscar el plan para obtener su key
    const planResult = await query(
      'SELECT id, key FROM pricing_plans WHERE id = $1',
      [pricing_plan_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan comercial no encontrado' });
    }

    const plan = planResult.rows[0];
    const plan_type = plan.key === 'commission' ? 'commission' : 'monthly';

    const result = await query(
      `UPDATE doctors
       SET pricing_plan_id = $1,
           plan_type = $2,
           commission_rate = COALESCE($3, commission_rate)
       WHERE id = $4
       RETURNING id, name, plan_type, pricing_plan_id, commission_rate`,
      [pricing_plan_id, plan_type, commission_rate, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Plan comercial asignado correctamente',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- PRICING PLANS SECTION ---

// Get all active plans (Public endpoint for Landing Page)
router.get('/public/plans', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, key, name, description, price, price_period, features, is_popular FROM pricing_plans WHERE is_enabled = true ORDER BY is_popular DESC, created_at ASC'
    );
    res.json({ success: true, plans: result.rows });
  } catch (error) {
    console.error('Get public plans error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all plans (Admin endpoint - protected)
router.get('/plans', verifyAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, key, name, description, price, price_period, features, is_popular, is_enabled, allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking, max_patients, max_appointments_monthly, created_at FROM pricing_plans ORDER BY created_at ASC'
    );
    res.json({ success: true, plans: result.rows });
  } catch (error) {
    console.error('Get admin plans error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a plan (Admin endpoint - protected)
router.put('/plans/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, description, price, price_period, features, is_popular, is_enabled,
      allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking,
      max_patients, max_appointments_monthly
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const result = await query(
      `UPDATE pricing_plans
       SET name = $1,
           description = $2,
           price = $3,
           price_period = $4,
           features = $5,
           is_popular = $6,
           is_enabled = $7,
           allow_google_calendar = $8,
           allow_mercadopago = $9,
           allow_telemedicine = $10,
           allow_reminders = $11,
           allow_insurance = $12,
           allow_patient_booking = $13,
           max_patients = $14,
           max_appointments_monthly = $15,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $16
       RETURNING id, key, name, description, price, price_period, features, is_popular, is_enabled, allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking, max_patients, max_appointments_monthly`,
      [
        name, description, price, price_period, features || [], is_popular, is_enabled,
        allow_google_calendar !== false, allow_mercadopago !== false, allow_telemedicine !== false, allow_reminders !== false, allow_insurance !== false, allow_patient_booking !== false,
        max_patients === '' || max_patients === null ? null : parseInt(max_patients),
        max_appointments_monthly === '' || max_appointments_monthly === null ? null : parseInt(max_appointments_monthly),
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      message: 'Plan comercial actualizado correctamente',
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Update pricing plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new plan (Admin endpoint - protected)
router.post('/plans', verifyAdmin, async (req, res) => {
  try {
    const { 
      key, name, description, price, price_period, features, is_popular, is_enabled,
      allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking,
      max_patients, max_appointments_monthly
    } = req.body;

    if (!key || !name || !price) {
      return res.status(400).json({ error: 'Key, Name, and Price are required' });
    }

    const result = await query(
      `INSERT INTO pricing_plans (
        key, name, description, price, price_period, features, is_popular, is_enabled,
        allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking,
        max_patients, max_appointments_monthly
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, key, name, description, price, price_period, features, is_popular, is_enabled, allow_google_calendar, allow_mercadopago, allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking, max_patients, max_appointments_monthly`,
      [
        key.trim().toLowerCase(), name, description, price, price_period, features || [], is_popular, is_enabled,
        allow_google_calendar !== false, allow_mercadopago !== false, allow_telemedicine !== false, allow_reminders !== false, allow_insurance !== false, allow_patient_booking !== false,
        max_patients === '' || max_patients === null ? null : parseInt(max_patients),
        max_appointments_monthly === '' || max_appointments_monthly === null ? null : parseInt(max_appointments_monthly)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Plan comercial creado correctamente',
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Create pricing plan error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un plan con esa clave (Key).' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a plan (Admin endpoint - protected)
router.delete('/plans/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM pricing_plans WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      message: `Plan "${result.rows[0].name}" eliminado correctamente`
    });
  } catch (error) {
    console.error('Delete pricing plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== CRUD PARA PLANTILLAS DE SERVICIOS BASE POR ESPECIALIDAD =====

// 1. Obtener todas las plantillas de servicios
router.get('/template-services', verifyAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM admin_template_services 
       ORDER BY specialization ASC, name ASC`
    );
    res.json({
      success: true,
      services: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin template services:', error);
    res.status(500).json({ error: 'Error al obtener las plantillas de servicios' });
  }
});

// 2. Crear una nueva plantilla de servicio
router.post('/template-services', verifyAdmin, async (req, res) => {
  try {
    const { specialization, name, description, price, duration_minutes, booking_fee, code, is_online } = req.body;

    if (!specialization || !name || !duration_minutes) {
      return res.status(400).json({ error: 'Especialidad, nombre y duración son campos obligatorios.' });
    }

    const result = await query(
      `INSERT INTO admin_template_services (
        specialization, name, description, price, duration_minutes, booking_fee, code, is_online
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        specialization.trim(),
        name.trim(),
        description || '',
        parseFloat(price) || 0,
        parseInt(duration_minutes),
        parseFloat(booking_fee) || 0,
        code || null,
        is_online === true || is_online === 'true'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Plantilla de servicio creada correctamente',
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating admin template service:', error);
    res.status(500).json({ error: 'Error al crear la plantilla de servicio' });
  }
});

// 3. Actualizar una plantilla de servicio existente
router.put('/template-services/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { specialization, name, description, price, duration_minutes, booking_fee, code, is_online } = req.body;

    if (!specialization || !name || !duration_minutes) {
      return res.status(400).json({ error: 'Especialidad, nombre y duración son campos obligatorios.' });
    }

    const result = await query(
      `UPDATE admin_template_services 
       SET specialization = $1,
           name = $2,
           description = $3,
           price = $4,
           duration_minutes = $5,
           booking_fee = $6,
           code = $7,
           is_online = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        specialization.trim(),
        name.trim(),
        description || '',
        parseFloat(price) || 0,
        parseInt(duration_minutes),
        parseFloat(booking_fee) || 0,
        code || null,
        is_online === true || is_online === 'true',
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plantilla de servicio no encontrada' });
    }

    res.json({
      success: true,
      message: 'Plantilla de servicio actualizada correctamente',
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating admin template service:', error);
    res.status(500).json({ error: 'Error al actualizar la plantilla de servicio' });
  }
});

// 4. Eliminar una plantilla de servicio
router.delete('/template-services/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM admin_template_services WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plantilla de servicio no encontrada' });
    }

    res.json({
      success: true,
      message: `Plantilla de servicio "${result.rows[0].name}" eliminada correctamente`
    });
  } catch (error) {
    console.error('Error deleting admin template service:', error);
    res.status(500).json({ error: 'Error al eliminar la plantilla de servicio' });
  }
});

// 5. Importar plantillas de servicios desde Excel
router.post('/template-services/import', verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    // Limpiar la tabla antes de importar para evitar duplicados
    await query('DELETE FROM admin_template_services');

    let importedCount = 0;
    let errors = [];

    for (const row of data) {
      try {
        const specialization = row.Especialidad || row.specialization || row.Especialid || '';
        const name = row['Nombre del Servicio'] || row.nombre || row.name || row.Nombre || '';
        const description = row['Descripción'] || row.descripcion || row.description || '';
        const price = parseFloat(row['Precio Base (ARS)'] || row.precio || row.price || 0);
        const duration_minutes = parseInt(row['Duración (min)'] || row['Duración'] || row.duracion || row.duration || 30);
        const booking_fee = parseFloat(row['Comisión Reserva (ARS)'] || row.comision || row.booking_fee || 0);
        const code = row['Código Interno'] || row.codigo || row.code || null;
        
        const isOnlineVal = String(row['Modalidad Online'] || row.online || row.is_online || '').toLowerCase().trim();
        const is_online = isOnlineVal === 'sí' || isOnlineVal === 'si' || isOnlineVal === 'yes' || isOnlineVal === 'true';

        if (!specialization || !name) {
          errors.push(`Fila omitida: Falta especialidad o nombre.`);
          continue;
        }

        await query(
          `INSERT INTO admin_template_services (
            specialization, name, description, price, duration_minutes, booking_fee, code, is_online
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [specialization.trim(), name.trim(), description, price, duration_minutes, booking_fee, code, is_online]
        );
        importedCount++;
      } catch (err) {
        errors.push(`Error en fila ${row.name || row['Nombre del Servicio'] || ''}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Se importaron ${importedCount} plantillas correctamente`,
      importedCount,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Error importing admin template services:', error);
    res.status(500).json({ error: 'Error al procesar el archivo Excel' });
  }
});

// === PLANILLAS DE CONVENIOS (OBRAS SOCIALES) BASE ===

// 1. Obtener todas las obras sociales base del catálogo
router.get('/template-insurances', verifyAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ti.id, ti.name, ti.acronym, ti.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', tp.id,
              'name', tp.name,
              'coverage_type', tp.coverage_type,
              'coverage_value', tp.coverage_value
            )
          ) FILTER (WHERE tp.id IS NOT NULL),
          '[]'
        ) as plans
      FROM admin_template_insurances ti
      LEFT JOIN admin_template_insurance_plans tp ON ti.id = tp.insurance_template_id
      GROUP BY ti.id
      ORDER BY ti.name ASC
    `);
    res.json({ success: true, insurances: result.rows });
  } catch (error) {
    console.error('Error fetching admin template insurances:', error);
    res.status(500).json({ error: 'Error al obtener las obras sociales base' });
  }
});

// 2. Importar obras sociales y planes base desde Excel
router.post('/template-insurances/import', verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    // Limpiar tabla antes de importar (limpieza en cascada)
    await query('DELETE FROM admin_template_insurances');

    let importedCount = 0;
    let errors = [];
    const insuranceMap = new Map();

    for (const row of data) {
      try {
        const convenioName = row.CONVENIO || row.convenio || row['Obra Social'] || row.prepaga || row.Nombre || '';
        const acronym = row.SIGLA || row.sigla || row.Acronym || '';
        const planName = row.PLAN || row.plan || '';
        const typeRaw = row.COBERTURA_TIPO || row.cobertura_tipo || row['Tipo Cobertura'] || 'percentage';
        const valRaw = row.COBERTURA_VALOR || row.cobertura_valor || row['Valor Cobertura'] || 0;

        if (!convenioName || String(convenioName).trim() === '') {
          continue;
        }

        const cleanConvenio = String(convenioName).trim();
        const cleanAcronym = String(acronym).trim();
        const cleanPlanName = String(planName).trim();

        // 1. Buscar o crear ID de convenio base
        let templateId = insuranceMap.get(cleanConvenio.toLowerCase());
        if (!templateId) {
          const insRes = await query(
            `INSERT INTO admin_template_insurances (name, acronym)
             VALUES ($1, $2)
             RETURNING id`,
            [cleanConvenio, cleanAcronym]
          );
          templateId = insRes.rows[0].id;
          insuranceMap.set(cleanConvenio.toLowerCase(), templateId);
        }

        // 2. Si se especifica un plan, insertarlo
        if (cleanPlanName) {
          const cleanType = (String(typeRaw).toLowerCase().includes('fij') || String(typeRaw).toLowerCase().includes('fixed') || String(typeRaw).toLowerCase().includes('monto'))
            ? 'fixed_amount'
            : 'percentage';
          const cleanVal = parseFloat(valRaw) || 0;

          await query(
            `INSERT INTO admin_template_insurance_plans (insurance_template_id, name, coverage_type, coverage_value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (insurance_template_id, name) DO NOTHING`,
            [templateId, cleanPlanName, cleanType, cleanVal]
          );
        }

        importedCount++;
      } catch (err) {
        errors.push(`Error en fila: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Se procesaron ${importedCount} registros de obras sociales y planes base correctamente`,
      importedCount,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Error importing admin template insurances:', error);
    res.status(500).json({ error: 'Error al procesar el archivo Excel de convenios' });
  }
});

// 3. Eliminar una obra social base del catálogo
router.delete('/template-insurances/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM admin_template_insurances WHERE id = $1 RETURNING name',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Obra social base no encontrada' });
    }
    res.json({
      success: true,
      message: `Obra social base "${result.rows[0].name}" eliminada correctamente`
    });
  } catch (error) {
    console.error('Error deleting admin template insurance:', error);
    res.status(500).json({ error: 'Error al eliminar la obra social base' });
  }
});

// --- RUTAS DE SOPORTE / TICKETS DE PROBLEMAS ---
router.get('/support-tickets', verifyAdmin, getAllTicketsAdmin);
router.put('/support-tickets/:id', verifyAdmin, updateTicketStatusAdmin);

export default router;
