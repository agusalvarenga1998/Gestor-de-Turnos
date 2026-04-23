import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/config.js';
import { sendProfessionalApprovalEmail } from '../services/emailService.js';

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
        commission_rate,
        created_at
      FROM doctors
      ORDER BY created_at DESC
    `);

    res.json({ success: true, doctors: result.rows });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve a doctor (start trial)
router.patch('/doctors/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount = 0 } = req.body; // Accept amount from request
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15); // 15 days trial

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

// Reactivate suspended doctor account
router.patch('/doctors/:id/reactivate', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE doctors
       SET status = 'approved'
       WHERE id = $1 AND status = 'suspended'
       RETURNING id, email, name, status, subscription_status, trial_ends_at, subscription_expires_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Doctor not found or not suspended'
      });
    }

    res.json({
      success: true,
      message: 'Doctor account reactivated',
      doctor: result.rows[0]
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

// Update doctor's plan
router.patch('/doctors/:id/plan', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_type, commission_rate } = req.body;

    if (!plan_type || !['monthly', 'commission'].includes(plan_type)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const result = await query(
      `UPDATE doctors
       SET plan_type = $1,
           commission_rate = COALESCE($2, commission_rate)
       WHERE id = $3
       RETURNING id, name, plan_type, commission_rate`,
      [plan_type, commission_rate, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      success: true,
      message: 'Plan actualizado correctamente',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
