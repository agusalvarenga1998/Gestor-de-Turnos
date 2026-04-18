import express from 'express';
import { query } from '../db/config.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Obtener servicios del profesional autenticado
router.get('/doctor/me', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await query(
      'SELECT * FROM services WHERE doctor_id = $1 ORDER BY created_at DESC',
      [doctorId]
    );
    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error('Error fetching my services:', error);
    res.status(500).json({ error: 'Error al obtener tus servicios' });
  }
});

// Obtener todos los servicios de un profesional (público)
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const result = await query(
      'SELECT * FROM services WHERE doctor_id = $1 AND is_active = TRUE ORDER BY name ASC',
      [doctorId]
    );
    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// --- Rutas protegidas para el profesional ---

// Crear un nuevo servicio
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, price, duration_minutes, booking_fee } = req.body;
    const doctorId = req.user.id;

    if (!name || !duration_minutes) {
      return res.status(400).json({ error: 'Nombre y duración son requeridos' });
    }

    const result = await query(
      `INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [doctorId, name, description, price || 0, duration_minutes, booking_fee || 0]
    );

    res.status(201).json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

// Actualizar un servicio
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration_minutes, is_active, booking_fee } = req.body;
    const doctorId = req.user.id;

    const result = await query(
      `UPDATE services 
       SET name = $1, description = $2, price = $3, duration_minutes = $4, is_active = $5, booking_fee = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND doctor_id = $8
       RETURNING *`,
      [name, description, price, duration_minutes, is_active, booking_fee, id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado o no tienes permiso' });
    }

    res.json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// Eliminar un servicio (soft delete o hard delete)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const result = await query(
      'DELETE FROM services WHERE id = $1 AND doctor_id = $2 RETURNING id',
      [id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    res.json({ success: true, message: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

export default router;
