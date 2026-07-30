import express from 'express';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import * as queueService from '../services/queueService.js';
import { query } from '../db/config.js';

const router = express.Router();

// -------------------------------------------------------------
// RUTAS PRIVADAS (PROFESIONAL)
// -------------------------------------------------------------

// Obtener estado actual de la fila del día
router.get('/status', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const queueStatus = await queueService.getDoctorQueueStatus(req.user.id);
    res.json({
      success: true,
      ...queueStatus
    });
  } catch (error) {
    console.error('Error al obtener estado de la fila:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener estado de la fila' });
  }
});

// Anunciar/Registrar llegada de paciente a la fila
router.post('/register', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const newEntry = await queueService.addToQueue(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Paciente registrado en la fila correctamente',
      entry: newEntry
    });
  } catch (error) {
    console.error('Error al agregar paciente a la fila:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al registrar paciente en la fila' });
  }
});

// Llamar al siguiente paciente
router.post('/call-next', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const calledPatient = await queueService.callNextPatient(req.user.id);
    res.json({
      success: true,
      message: `Llamando a ${calledPatient.patient_name}`,
      calledPatient
    });
  } catch (error) {
    console.error('Error al llamar siguiente paciente:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al llamar al siguiente paciente' });
  }
});

// Finalizar atención del paciente
router.post('/complete', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const { queueId } = req.body;
    if (!queueId) return res.status(400).json({ success: false, message: 'queueId requerido' });

    const completed = await queueService.completePatient(req.user.id, queueId);
    res.json({
      success: true,
      message: 'Atención finalizada correctamente',
      completed
    });
  } catch (error) {
    console.error('Error al finalizar atención:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al finalizar atención' });
  }
});

// Saltear o cancelar turno de la fila
router.post('/skip', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const { queueId, action } = req.body;
    if (!queueId) return res.status(400).json({ success: false, message: 'queueId requerido' });

    const skipped = await queueService.skipPatient(req.user.id, queueId, action);
    res.json({
      success: true,
      message: 'Turno actualizado en la fila',
      skipped
    });
  } catch (error) {
    console.error('Error al saltear turno:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al actualizar turno' });
  }
});

// Cambiar configuración de auto-registro por QR
router.patch('/toggle-self-registration', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const { allow_self_queue } = req.body;
    const result = await query(
      `UPDATE doctors SET allow_self_queue = $1 WHERE id = $2 RETURNING id, allow_self_queue`,
      [Boolean(allow_self_queue), req.user.id]
    );
    res.json({
      success: true,
      allow_self_queue: result.rows[0].allow_self_queue,
      message: 'Configuración de fila actualizada'
    });
  } catch (error) {
    console.error('Error al cambiar configuración de fila:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar configuración' });
  }
});

// -------------------------------------------------------------
// RUTAS PÚBLICAS (PACIENTES Y PANTALLA DE SALA)
// -------------------------------------------------------------

// Seguimiento en vivo para el celular del paciente
router.get('/public/track/:token', async (req, res) => {
  try {
    const trackingInfo = await queueService.getPatientTrackingStatus(req.params.token);
    res.json({
      success: true,
      ...trackingInfo
    });
  } catch (error) {
    console.error('Error en seguimiento de ticket:', error);
    res.status(404).json({ success: false, message: error.message || 'Ticket no encontrado' });
  }
});

// Auto-registro por QR para el paciente (si el profesional lo tiene activado)
router.post('/public/self-register/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const docRes = await query(`SELECT allow_self_queue FROM doctors WHERE id = $1`, [doctorId]);
    if (!docRes.rows[0] || !docRes.rows[0].allow_self_queue) {
      return res.status(403).json({
        success: false,
        message: 'El profesional no tiene activado el auto-registro por QR. Por favor solicite su turno al personal de recepción.'
      });
    }

    const newEntry = await queueService.addToQueue(doctorId, req.body);
    res.status(201).json({
      success: true,
      message: 'Te has anotado en la fila correctamente',
      entry: newEntry
    });
  } catch (error) {
    console.error('Error en auto-registro de fila por QR:', error);
    res.status(400).json({ success: false, message: error.message || 'Error al anotarse en la fila' });
  }
});

// Pantalla pública general de Sala de Espera (para TV/Tablet)
router.get('/public/board/:doctorId', async (req, res) => {
  try {
    const queueStatus = await queueService.getDoctorQueueStatus(req.params.doctorId);
    res.json({
      success: true,
      ...queueStatus
    });
  } catch (error) {
    console.error('Error al obtener pantalla de sala:', error);
    res.status(404).json({ success: false, message: error.message || 'Sala no encontrada' });
  }
});

export default router;
