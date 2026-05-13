import * as db from '../db/config.js';

// Obtener horarios de trabajo del doctor
export const getWorkingHours = async (req, res) => {
  try {
    const doctorId = req.user.id;

    console.log('GET /working-hours - Doctor ID:', doctorId);

    const result = await db.query(
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
};

// Actualizar horarios de trabajo del doctor
export const updateWorkingHours = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { availability } = req.body;

    console.log('POST /working-hours - Doctor ID:', doctorId);
    console.log('Horarios a guardar:', availability.length);

    await db.transaction(async (client) => {
      // Eliminar horarios existentes
      await client.query(
        'DELETE FROM doctor_availability WHERE doctor_id = $1',
        [doctorId]
      );

      // Insertar nuevos horarios
      for (const hours of availability) {
        if (hours.is_available) {
          await client.query(
            `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
             VALUES ($1, $2, $3, $4, $5)`,
            [doctorId, hours.day_of_week, hours.start_time, hours.end_time, true]
          );
        }
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
};

// Obtener perfil del doctor
export const getProfile = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const result = await db.query(
      'SELECT id, name, email, phone, specialization, clinic_name FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (!result.rows[0]) {
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
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};

// Actualizar perfil del doctor
export const updateProfile = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { name, phone, specialization, clinic_name } = req.body;

    const result = await db.query(
      `UPDATE doctors
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           specialization = COALESCE($3, specialization),
           clinic_name = COALESCE($4, clinic_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, phone, specialization, clinic_name`,
      [name, phone, specialization, clinic_name, doctorId]
    );

    if (!result.rows[0]) {
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
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
};

// Obtener dashboard del doctor
export const getDashboard = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Citas de hoy
    const appointmentsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = CURRENT_DATE AND status = 'scheduled'`,
      [doctorId]
    );

    // Total de pacientes
    const patientsResult = await db.query(
      `SELECT COUNT(DISTINCT patient_id) as count
       FROM appointments
       WHERE doctor_id = $1`,
      [doctorId]
    );

    const completedResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1
         AND status = 'completed'
         AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [doctorId]
    );

    // Próximos cumpleaños (próximos 7 días)
    const birthdaysResult = await db.query(
      `SELECT DISTINCT p.id, p.name, p.date_of_birth
       FROM patients p
       JOIN appointments a ON p.id = a.patient_id
       WHERE a.doctor_id = $1
         AND p.date_of_birth IS NOT NULL
         AND (
           EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(DAY FROM p.date_of_birth) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '7 days'))
         OR
           EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '7 days'))
           AND EXTRACT(DAY FROM p.date_of_birth) <= EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '7 days'))
           AND EXTRACT(MONTH FROM CURRENT_DATE) != EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '7 days'))
         )
       ORDER BY EXTRACT(MONTH FROM p.date_of_birth), EXTRACT(DAY FROM p.date_of_birth)`,
      [doctorId]
    );

    // Citas pendientes (esperando aprobación)
    const pendingResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1 AND status = 'pending'`,
      [doctorId]
    );

    const dashboardData = {
      appointmentsToday: parseInt(appointmentsResult.rows[0].count),
      totalPatients: parseInt(patientsResult.rows[0].count),
      completedThisMonth: parseInt(completedResult.rows[0].count),
      pendingAppointments: parseInt(pendingResult.rows[0].count),
      upcomingBirthdays: birthdaysResult.rows
    };

    console.log('📊 Dashboard data generated:', dashboardData);

    res.json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard'
    });
  }
};
