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
    let targetDate = req.query.date;

    if (!targetDate) {
      try {
        const options = { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('fr-CA', options);
        targetDate = formatter.format(new Date());
      } catch (e) {
        const now = new Date();
        const offset = -3; // Argentina offset
        const localTime = new Date(now.getTime() + (offset * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
        const year = localTime.getFullYear();
        const month = String(localTime.getMonth() + 1).padStart(2, '0');
        const day = String(localTime.getDate()).padStart(2, '0');
        targetDate = `${year}-${month}-${day}`;
      }
    }

    console.log(`🔍 Fetching dashboard for Doctor ID: ${doctorId} using date: ${targetDate}`);

    // Citas de hoy
    const appointmentsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status = 'scheduled'`,
      [doctorId, targetDate]
    );

    // Total de pacientes (asociados directamente o con turnos)
    const patientsResult = await db.query(
      `SELECT COUNT(DISTINCT p_id) as count FROM (
        SELECT id as p_id FROM patients WHERE doctor_id = $1
        UNION
        SELECT patient_id as p_id FROM appointments WHERE doctor_id = $1
      ) as combined_patients`,
      [doctorId]
    );

    const completedResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1
         AND status = 'completed'
         AND appointment_date >= DATE_TRUNC('month', $2::date)`,
      [doctorId, targetDate]
    );

    // Próximos cumpleaños (próximos 7 días)
    let upcomingBirthdays = [];
    try {
      const birthdaysResult = await db.query(
        `SELECT DISTINCT p.id, p.name, p.date_of_birth
         FROM patients p
         JOIN appointments a ON p.id = a.patient_id
         WHERE a.doctor_id = $1
           AND p.date_of_birth IS NOT NULL
           AND (
             EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM $2::date)
             AND EXTRACT(DAY FROM p.date_of_birth) BETWEEN EXTRACT(DAY FROM $2::date) AND EXTRACT(DAY FROM ($2::date + INTERVAL '7 days'))
           OR
             EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM ($2::date + INTERVAL '7 days'))
             AND EXTRACT(DAY FROM p.date_of_birth) <= EXTRACT(DAY FROM ($2::date + INTERVAL '7 days'))
             AND EXTRACT(MONTH FROM $2::date) != EXTRACT(MONTH FROM ($2::date + INTERVAL '7 days'))
           )
         ORDER BY EXTRACT(MONTH FROM p.date_of_birth), EXTRACT(DAY FROM p.date_of_birth)`,
        [doctorId, targetDate]
      );
      upcomingBirthdays = birthdaysResult.rows;
    } catch (bdayError) {
      console.error('⚠️ Error fetching birthdays:', bdayError.message);
    }

    // Citas pendientes (esperando aprobación o pago)
    const pendingResult = await db.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1 AND status IN ('pending', 'pending_payment')`,
      [doctorId]
    );

    const dashboardData = {
      appointmentsToday: parseInt(appointmentsResult.rows[0].count),
      totalPatients: parseInt(patientsResult.rows[0].count),
      completedThisMonth: parseInt(completedResult.rows[0].count),
      pendingAppointments: parseInt(pendingResult.rows[0].count),
      upcomingBirthdays: upcomingBirthdays
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
