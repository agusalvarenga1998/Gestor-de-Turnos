import * as db from '../db/config.js';
import * as appointmentService from '../services/appointmentService.js';
import * as availabilityService from '../services/availabilityService.js';

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
    await appointmentService.autoUpdatePastAppointments(doctorId);
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

    console.log(`🔍 Fetching action-oriented dashboard for Doctor ID: ${doctorId} on: ${targetDate}`);

    // 1. Próximo turno de hoy
    const nextApptResult = await db.query(
      `SELECT a.id, a.appointment_time, a.reason_for_visit, a.total_price, a.booking_fee_paid, a.coverage_amount,
              p.id as patient_id, p.name as patient_name, p.phone as patient_phone,
              s.name as service_name, s.duration_minutes
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.doctor_id = $1 
         AND a.appointment_date = $2 
         AND a.status = 'scheduled'
       ORDER BY a.appointment_time ASC 
       LIMIT 1`,
      [doctorId, targetDate]
    );
    const nextAppointment = nextApptResult.rows[0] || null;

    // 2. Turnos que requieren aprobación (status = 'pending')
    const pendingApprovalResult = await db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND status = 'pending'`,
      [doctorId]
    );
    const pendingApprovalCount = parseInt(pendingApprovalResult.rows[0]?.count || 0);

    // 3. Pagos pendientes (status = 'pending_payment')
    const pendingPaymentResult = await db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND status = 'pending_payment'`,
      [doctorId]
    );
    const pendingPaymentCount = parseInt(pendingPaymentResult.rows[0]?.count || 0);

    // 4. Cancelaciones recientes (últimos 7 días)
    const recentCancellationsResult = await db.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = $1 AND status = 'cancelled' AND updated_at >= NOW() - INTERVAL '7 days'`,
      [doctorId]
    );
    const recentCancellationsCount = parseInt(recentCancellationsResult.rows[0]?.count || 0);

    // 5. Clientes con deuda (monto 'A Cobrar' mayor a 0 y payment_status != 'paid')
    const indebtedPatientsResult = await db.query(
      `SELECT COUNT(DISTINCT patient_id) as count FROM appointments 
       WHERE doctor_id = $1 AND payment_status != 'paid' AND (total_price - booking_fee_paid - coverage_amount) > 0`,
      [doctorId]
    );
    const indebtedPatientsCount = parseInt(indebtedPatientsResult.rows[0]?.count || 0);

    // 6. Horarios disponibles hoy
    let availableSlotsCount = 0;
    try {
      const slots = await availabilityService.getNextAvailableSlots(doctorId, targetDate);
      availableSlotsCount = slots.length;
    } catch (e) {
      console.error('Error al calcular slots disponibles hoy:', e.message);
    }

    // 7. Turnos sin confirmar (por ejemplo, creados directamente pero pendientes de confirmación)
    const unconfirmedResult = await db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND status = 'pending'`,
      [doctorId]
    );
    const unconfirmedAppointmentsCount = parseInt(unconfirmedResult.rows[0]?.count || 0);

    // 8. Configuraciones de onboarding incompletas
    const doctorProfileResult = await db.query(
      'SELECT rubro, specialization, clinic_address, address FROM doctors WHERE id = $1',
      [doctorId]
    );
    const doctor = doctorProfileResult.rows[0];
    const incompleteConfig = [];

    if (!doctor?.rubro || !doctor?.specialization || (!doctor?.address && !doctor?.clinic_address)) {
      incompleteConfig.push('profile');
    }

    const hoursResult = await db.query(
      'SELECT COUNT(*) as count FROM doctor_availability WHERE doctor_id = $1 AND is_available = true',
      [doctorId]
    );
    if (parseInt(hoursResult.rows[0]?.count || 0) === 0) {
      incompleteConfig.push('hours');
    }

    const servicesResult = await db.query(
      'SELECT COUNT(*) as count FROM services WHERE doctor_id = $1 AND is_active = true',
      [doctorId]
    );
    if (parseInt(servicesResult.rows[0]?.count || 0) === 0) {
      incompleteConfig.push('services');
    }

    // Total de pacientes en la lista
    const totalPatientsResult = await db.query(
      `SELECT COUNT(*) as count FROM patients WHERE doctor_id = $1`,
      [doctorId]
    );

    // Citas agendadas para hoy (para el contador rápido)
    const appointmentsTodayResult = await db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'cancelled'`,
      [doctorId, targetDate]
    );

    const dashboardData = {
      appointmentsToday: parseInt(appointmentsTodayResult.rows[0]?.count || 0),
      totalPatients: parseInt(totalPatientsResult.rows[0]?.count || 0),
      nextAppointment,
      pendingApprovalCount,
      pendingPaymentCount,
      recentCancellationsCount,
      indebtedPatientsCount,
      availableSlotsCount,
      unconfirmedAppointmentsCount,
      incompleteConfig
    };

    console.log('📊 Dashboard actionable metrics generated:', dashboardData);

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

// Obtener estadísticas avanzadas del doctor
export const getStatistics = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { startDate, endDate } = req.query;

    // Rango de fechas por defecto: últimos 30 días
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Total turnos por estado en el período
    const statusCounts = await db.query(
      `SELECT status, COUNT(*) as count 
       FROM appointments 
       WHERE doctor_id = $1 AND appointment_date BETWEEN $2::date AND $3::date
       GROUP BY status`,
      [doctorId, start, end]
    );

    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let absent = 0;
    let pending = 0;

    statusCounts.rows.forEach(r => {
      const cnt = parseInt(r.count);
      total += cnt;
      if (r.status === 'completed') completed += cnt;
      else if (r.status === 'cancelled') cancelled += cnt;
      else if (r.status === 'absent') absent += cnt;
      else if (r.status === 'pending' || r.status === 'pending_payment') pending += cnt;
    });

    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : 0;
    const noShowRate = total > 0 ? ((absent / total) * 100).toFixed(1) : 0;

    // 2. Ingresos por período (desde movimientos)
    const incomeResult = await db.query(
      `SELECT SUM(amount) as total 
       FROM movements 
       WHERE doctor_id = $1 AND type IN ('cobro', 'seña') AND created_at::date BETWEEN $2::date AND $3::date`,
      [doctorId, start, end]
    );
    const totalIncome = parseFloat(incomeResult.rows[0]?.total || 0);

    // 3. Porcentaje de ocupación
    // Calcular minutos de atención ocupados en citas completadas
    const durationResult = await db.query(
      `SELECT SUM(duration_minutes) as sum 
       FROM appointments 
       WHERE doctor_id = $1 AND appointment_date BETWEEN $2::date AND $3::date AND status = 'completed'`,
      [doctorId, start, end]
    );
    const occupiedMinutes = parseInt(durationResult.rows[0]?.sum || 0);

    // Calcular minutos disponibles de trabajo en el período
    const availabilityResult = await db.query(
      `SELECT start_time, end_time, day_of_week 
       FROM doctor_availability 
       WHERE doctor_id = $1 AND is_available = true`,
      [doctorId]
    );
    
    let weeklyWorkingMinutes = 0;
    availabilityResult.rows.forEach(av => {
      const startParts = av.start_time.split(':').map(Number);
      const endParts = av.end_time.split(':').map(Number);
      const diffMin = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]);
      weeklyWorkingMinutes += diffMin;
    });

    const daysDiff = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
    const weeksCount = Math.max(1, daysDiff / 7);
    const totalWorkingMinutes = weeklyWorkingMinutes * weeksCount;
    const occupancyRate = totalWorkingMinutes > 0 ? Math.min(100, ((occupiedMinutes / totalWorkingMinutes) * 100)).toFixed(1) : 0;

    // 4. Servicios más solicitados
    const topServices = await db.query(
      `SELECT s.name, COUNT(a.id) as count 
       FROM appointments a 
       JOIN services s ON a.service_id = s.id 
       WHERE a.doctor_id = $1 AND a.appointment_date BETWEEN $2::date AND $3::date
       GROUP BY s.name 
       ORDER BY count DESC 
       LIMIT 5`,
      [doctorId, start, end]
    );

    // 5. Horarios más demandados
    const topHours = await db.query(
      `SELECT appointment_time as time, COUNT(*) as count 
       FROM appointments 
       WHERE doctor_id = $1 AND a.appointment_date BETWEEN $2::date AND $3::date AND status != 'cancelled'
       GROUP BY appointment_time 
       ORDER BY count DESC 
       LIMIT 5`,
      [doctorId, start, end]
    ).catch(e => {
      // Fallback si la query falla por alias
      return db.query(
        `SELECT appointment_time as time, COUNT(*) as count 
         FROM appointments 
         WHERE doctor_id = $1 AND appointment_date BETWEEN $2::date AND $3::date AND status != 'cancelled'
         GROUP BY appointment_time 
         ORDER BY count DESC 
         LIMIT 5`,
        [doctorId, start, end]
      );
    });

    // 6. Clientes nuevos y recurrentes
    const patientsStats = await db.query(
      `SELECT 
        COUNT(CASE WHEN app_count = 1 THEN 1 END) as new_patients,
        COUNT(CASE WHEN app_count > 1 THEN 1 END) as recurrent_patients
       FROM (
         SELECT patient_id, COUNT(*) as app_count 
         FROM appointments 
         WHERE doctor_id = $1 
         GROUP BY patient_id
       ) as patient_counts`,
      [doctorId]
    );
    const newPatients = parseInt(patientsStats.rows[0]?.new_patients || 0);
    const recurrentPatients = parseInt(patientsStats.rows[0]?.recurrent_patients || 0);

    // 7. Tiempo promedio hasta conseguir turno (diferencia en días entre creación y fecha de cita)
    const waitTimeResult = await db.query(
      `SELECT AVG(appointment_date - created_at::date) as avg_days 
       FROM appointments 
       WHERE doctor_id = $1 AND appointment_date BETWEEN $2::date AND $3::date`,
      [doctorId, start, end]
    );
    const avgWaitDays = parseFloat(waitTimeResult.rows[0]?.avg_days || 0).toFixed(1);

    // 8. Porcentaje de reservas online
    const onlineResult = await db.query(
      `SELECT 
        COUNT(CASE WHEN booking_fee_paid > 0 OR status = 'pending' THEN 1 END) as online_count,
        COUNT(*) as total_count
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date BETWEEN $2::date AND $3::date`,
      [doctorId, start, end]
    );
    const onlineCount = parseInt(onlineResult.rows[0]?.online_count || 0);
    const totalCount = parseInt(onlineResult.rows[0]?.total_count || 0);
    const onlineBookingPercentage = totalCount > 0 ? ((onlineCount / totalCount) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      statistics: {
        occupancyRate: parseFloat(occupancyRate),
        cancellationRate: parseFloat(cancellationRate),
        noShowRate: parseFloat(noShowRate),
        totalIncome,
        newPatients,
        recurrentPatients,
        avgWaitDays: parseFloat(avgWaitDays),
        onlineBookingPercentage: parseFloat(onlineBookingPercentage),
        topServices: topServices.rows,
        topHours: topHours.rows.map(h => ({ ...h, time: h.time.substring(0, 5) })),
        summary: { total, completed, cancelled, absent, pending }
      }
    });
  } catch (error) {
    console.error('Error calculando estadísticas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
};
