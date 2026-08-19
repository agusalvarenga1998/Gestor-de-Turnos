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

// Obtener listado de profesionales con información de vencimiento y estado
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

// Impersonar / Ingresar en Modo Demo a la cuenta de un profesional
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
