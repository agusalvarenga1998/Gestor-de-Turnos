import express from 'express';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import { query, transaction } from '../db/config.js';
import { getAppointmentsForToday, getAppointmentsByDoctor } from '../services/appointmentService.js';
import { getPatientsByDoctor } from '../services/patientService.js';

const router = express.Router();

// Obtener perfil del doctor
router.get('/profile', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, specialization, phone, clinic_name, clinic_address, profile_image_url, latitude, longitude, booking_fee
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
router.patch('/profile', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const { name, specialization, phone, clinic_name, clinic_address, latitude, longitude, booking_fee } = req.body;

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
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, email, name, specialization, phone, clinic_name, clinic_address, latitude, longitude, booking_fee`,
      [name, specialization, phone, clinic_name, clinic_address, latitude, longitude, booking_fee, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
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
router.get('/dashboard', verifyToken, verifyDoctorRole, async (req, res) => {
  try {
    const todayAppointments = await getAppointmentsForToday(req.user.id);
    const allAppointments = await getAppointmentsByDoctor(req.user.id);
    const patients = await getPatientsByDoctor(req.user.id);
    const pendingAppointments = allAppointments.filter(a => a.status === 'pending' || a.status === 'pending_payment').length;

    res.json({
      success: true,
      stats: {
        total_appointments: allAppointments.length,
        total_patients: patients.length,
        appointments_today: todayAppointments.length,
        pending_appointments: pendingAppointments,
        completed_appointments: allAppointments.filter(a => a.status === 'completed').length,
        cancelled_appointments: allAppointments.filter(a => a.status === 'cancelled').length
      }
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard'
    });
  }
});

// Obtener horarios de trabajo del doctor
router.get('/working-hours', verifyToken, verifyDoctorRole, async (req, res) => {
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
router.post('/working-hours', verifyToken, verifyDoctorRole, async (req, res) => {
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

export default router;
