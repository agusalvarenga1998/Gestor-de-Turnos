import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';
import { getDoctorProfileWithPlan } from './auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Middleware para verificar que el usuario sea Vendedor
export const verifySeller = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'seller') {
      return res.status(403).json({ error: 'Acceso de vendedor requerido' });
    }

    req.seller = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Login de Vendedor
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const result = await query(
      'SELECT id, email, password_hash, name, phone, is_active FROM sellers WHERE LOWER(TRIM(email)) = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const seller = result.rows[0];

    if (!seller.is_active) {
      return res.status(403).json({ error: 'Cuenta de vendedor desactivada' });
    }

    const passwordMatch = await bcrypt.compare(cleanPassword, seller.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: seller.id,
        email: seller.email,
        name: seller.name,
        role: 'seller'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      seller: {
        id: seller.id,
        email: seller.email,
        name: seller.name,
        phone: seller.phone
      }
    });
  } catch (error) {
    console.error('Error en seller login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar token de vendedor
router.get('/verify', verifySeller, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, phone, is_active FROM sellers WHERE id = $1',
      [req.seller.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Vendedor no disponible' });
    }

    res.json({
      success: true,
      seller: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar sesión' });
  }
});

// Obtener listado de profesionales con seguimiento y notas comerciales
router.get('/doctors', verifySeller, async (req, res) => {
  try {
    // Sincronizar estados de prueba o suscripción vencidos primero
    await query(`
      UPDATE doctors
      SET subscription_status = 'expired'
      WHERE status = 'approved'
        AND (
          (subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < CURRENT_TIMESTAMP)
          OR (subscription_status = 'active' AND subscription_expires_at IS NOT NULL AND subscription_expires_at < CURRENT_TIMESTAMP)
        )
    `);

    const result = await query(`
      SELECT 
        d.id,
        d.name,
        d.email,
        d.phone,
        d.specialization,
        d.rubro,
        d.clinic_name,
        d.status,
        d.subscription_status,
        d.subscription_expires_at,
        d.trial_ends_at,
        d.seller_notes,
        d.created_at,
        p.name as plan_name,
        p.key as plan_key,
        (SELECT COUNT(*) FROM patients pat WHERE pat.doctor_id = d.id AND pat.is_active = true) as total_patients,
        (SELECT COUNT(*) FROM appointments app WHERE app.doctor_id = d.id) as total_appointments
      FROM doctors d
      LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
      ORDER BY 
        CASE 
          WHEN d.subscription_status = 'trial' THEN COALESCE(d.trial_ends_at, d.created_at)
          ELSE COALESCE(d.subscription_expires_at, d.created_at)
        END ASC
    `);

    const now = new Date();

    const doctors = result.rows.map(doc => {
      let expirationDate = null;
      if (doc.subscription_status === 'trial') {
        expirationDate = doc.trial_ends_at;
      } else {
        expirationDate = doc.subscription_expires_at;
      }

      let daysRemaining = null;
      let expirationStatus = 'active'; // active, expiring_soon, expired

      if (expirationDate) {
        const expDateObj = new Date(expirationDate);
        const diffTime = expDateObj.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0 || doc.subscription_status === 'expired') {
          expirationStatus = 'expired';
          daysRemaining = Math.max(0, daysRemaining);
        } else if (daysRemaining <= 7) {
          expirationStatus = 'expiring_soon';
        }
      } else if (doc.subscription_status === 'expired') {
        expirationStatus = 'expired';
        daysRemaining = 0;
      }

      return {
        id: doc.id,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        specialization: doc.specialization || 'Sin especialidad',
        rubro: doc.rubro || 'General',
        clinic_name: doc.clinic_name || '',
        status: doc.status,
        subscription_status: doc.subscription_status || 'trial',
        plan_name: doc.plan_name || 'Plan Estándar',
        plan_key: doc.plan_key || 'mensual_pro',
        seller_notes: doc.seller_notes || '',
        expiration_date: expirationDate,
        days_remaining: daysRemaining,
        expiration_status: expirationStatus,
        total_patients: parseInt(doc.total_patients || 0, 10),
        total_appointments: parseInt(doc.total_appointments || 0, 10),
        created_at: doc.created_at
      };
    });

    res.json({
      success: true,
      count: doctors.length,
      doctors
    });
  } catch (error) {
    console.error('Error al obtener profesionales para vendedor:', error);
    res.status(500).json({ error: 'Error al obtener la lista de profesionales' });
  }
});

// Guardar / Actualizar nota comercial de seguimiento para un profesional
router.put('/doctors/:doctorId/notes', verifySeller, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { notes } = req.body;

    await query(`
      UPDATE doctors
      SET seller_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [notes || '', doctorId]);

    res.json({
      success: true,
      message: 'Nota de seguimiento actualizada correctamente',
      seller_notes: notes
    });
  } catch (error) {
    console.error('Error al actualizar nota comercial:', error);
    res.status(500).json({ error: 'Error al guardar la nota comercial' });
  }
});

// Obtener la lista de los 4 Planes con sus cuentas de Demo Pre-cargadas
router.get('/plans-demo', verifySeller, async (req, res) => {
  try {
    const demoEmails = [
      'demo.mensual@turnohub.com',
      'demo.odontologia@turnohub.com',
      'demo.filavirtual@turnohub.com',
      'demo.comision@turnohub.com'
    ];

    const result = await query(`
      SELECT id, email, name, specialization, clinic_name, pricing_plan_id
      FROM doctors
      WHERE email = ANY($1)
    `, [demoEmails]);

    const demoMap = {};
    result.rows.forEach(doc => {
      demoMap[doc.email] = doc;
    });

    const planDemos = [
      {
        planKey: 'mensual_pro',
        title: 'Plan Mensual Pro + Consultas Online',
        subtitle: 'Para Medicina, Psicología, Estética y Consultorios Médicos',
        price: '$24.999 / mes',
        badgeText: '⭐ Más Vendido',
        badgeColor: '#4f46e5',
        features: [
          'Portal de Reservas Online 24/7 con link personalizable',
          'Cobro automático de señas por Mercado Pago',
          'Telemedicina con enlace Google Meet automático',
          'Notificaciones e Historial Clínico completo',
          'Módulo de Caja, Finanzas y balances en vivo'
        ],
        demoDataSummary: '15 Pacientes, 10 Turnos agendados, Caja con movimientos e Historia Clínica médica',
        demoEmail: 'demo.mensual@turnohub.com',
        doctorId: demoMap['demo.mensual@turnohub.com']?.id || null
      },
      {
        planKey: 'odontologia',
        title: 'Plan Odontología & Clínicas Dentales',
        subtitle: 'Para Dentistas, Odontólogos y Centros Odontológicos',
        price: '$29.999 / mes',
        badgeText: '🦷 Odontograma Digital',
        badgeColor: '#0284c7',
        features: [
          'Odontograma Digital Interactivo pieza por pieza',
          'Ficha Clínica Odontológica con imágenes y adjuntos',
          'Gestión de Obras Sociales, Coberturas y Coseguros',
          'Cobro de señas por Mercado Pago y Recordatorios',
          'Módulo de Finanzas y Ausentismo de pacientes'
        ],
        demoDataSummary: 'Odontograma dental pre-cargado con restauraciones, Ficha dental y Pacientes de odontología',
        demoEmail: 'demo.odontologia@turnohub.com',
        doctorId: demoMap['demo.odontologia@turnohub.com']?.id || null
      },
      {
        planKey: 'orden_llegada',
        title: 'Plan Fila Virtual & Orden de Llegada',
        subtitle: 'Para Guardias, Barberías, Estética sin cita previa y Laboratorios',
        price: '$18.999 / mes',
        badgeText: '👥 Sin Cita Previa',
        badgeColor: '#d97706',
        features: [
          'Gestión de Fila en Vivo y Turnero por Orden de Llegada',
          'Pantalla Llamadora TV en vivo para sala de espera',
          'Ingreso con Código QR autónomo desde celular del cliente',
          'Avisos por WhatsApp y Push cuando es el turno del cliente',
          'Módulo de Caja y reporte de tiempos de espera'
        ],
        demoDataSummary: 'Turnero activo en vivo, 3 Clientes en Fila (Esperando, Llamado, Completado) y Pantalla Llamadora',
        demoEmail: 'demo.filavirtual@turnohub.com',
        doctorId: demoMap['demo.filavirtual@turnohub.com']?.id || null
      },
      {
        planKey: 'commission',
        title: 'Plan Comisión Inicial',
        subtitle: 'Para profesionales que recién comienzan sin costo fijo',
        price: '3% por turno efectivo',
        badgeText: '🌱 Sin Costo Fijo',
        badgeColor: '#16a34a',
        features: [
          'Sin costo de mantenimiento fijo mensual',
          'Portal de Reservas Online 24/7',
          'Cobro de señas con Mercado Pago',
          'Notificaciones por WhatsApp y Email',
          'Ideal para comenzar a trabajar de inmediato'
        ],
        demoDataSummary: 'Turnos con seña cobrada por Mercado Pago, Pacientes y cálculo de comisiones',
        demoEmail: 'demo.comision@turnohub.com',
        doctorId: demoMap['demo.comision@turnohub.com']?.id || null
      }
    ];

    res.json({
      success: true,
      plans: planDemos
    });
  } catch (error) {
    console.error('Error al obtener demos de planes:', error);
    res.status(500).json({ error: 'Error al obtener la lista de demos por plan' });
  }
});

// Lanzar Demo de un Plan específico por su planKey
router.post('/launch-plan-demo/:planKey', verifySeller, async (req, res) => {
  try {
    const { planKey } = req.params;

    const emailMap = {
      mensual_pro: 'demo.mensual@turnohub.com',
      odontologia: 'demo.odontologia@turnohub.com',
      orden_llegada: 'demo.filavirtual@turnohub.com',
      commission: 'demo.comision@turnohub.com'
    };

    const targetEmail = emailMap[planKey];
    if (!targetEmail) {
      return res.status(400).json({ error: 'Clave de plan no válida' });
    }

    const docRes = await query('SELECT id FROM doctors WHERE email = $1', [targetEmail]);
    if (docRes.rows.length === 0) {
      return res.status(444).json({ error: 'La cuenta demo de este plan no fue inicializada' });
    }

    const doctorId = docRes.rows[0].id;
    const doctorProfile = await getDoctorProfileWithPlan(doctorId);

    // Generar token con flag demo
    const token = jwt.sign(
      {
        id: doctorProfile.id,
        email: doctorProfile.email,
        name: doctorProfile.name,
        role: 'doctor',
        isDemoMode: true,
        sellerId: req.seller.id,
        sellerName: req.seller.name
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      message: `Demo del ${doctorProfile.name} iniciada`,
      token,
      doctor: {
        ...doctorProfile,
        isDemoMode: true,
        sellerName: req.seller.name
      }
    });
  } catch (error) {
    console.error('Error al lanzar demo por plan:', error);
    res.status(500).json({ error: 'Error al iniciar la demostración del plan' });
  }
});

// Impersonar / Ingresar en Modo Demo a la cuenta de cualquier profesional
router.post('/impersonate/:doctorId', verifySeller, async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctorProfile = await getDoctorProfileWithPlan(doctorId);

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    // Generar un token con flag de isDemoMode y sellerId
    const token = jwt.sign(
      {
        id: doctorProfile.id,
        email: doctorProfile.email,
        name: doctorProfile.name,
        role: 'doctor',
        isDemoMode: true,
        sellerId: req.seller.id,
        sellerName: req.seller.name
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      message: `Iniciada sesión demo como ${doctorProfile.name}`,
      token,
      doctor: {
        ...doctorProfile,
        isDemoMode: true,
        sellerName: req.seller.name
      }
    });
  } catch (error) {
    console.error('Error al ingresar en modo demo:', error);
    res.status(500).json({ error: 'Error al ingresar a las pantallas del profesional' });
  }
});

export default router;
