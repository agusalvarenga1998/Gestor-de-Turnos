import * as appointmentService from '../services/appointmentService.js';
import * as availabilityService from '../services/availabilityService.js';

// Crear una nueva cita
export const createAppointment = async (req, res) => {
  try {
    console.log('\n🔵 === POST /api/appointments ===');
    console.log('Body:', req.body);

    const { 
      patientId, 
      serviceId,
      appointment_date, 
      appointment_time, 
      end_time, 
      reason_for_visit, 
      insurance_company_id 
    } = req.body;
    const doctorId = req.user.id;

    console.log('Doctor ID:', doctorId);
    console.log('Patient ID:', patientId);
    console.log('Service ID:', serviceId);

    // Validaciones
    if (!patientId || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        message: 'patientId, appointment_date y appointment_time son requeridos'
      });
    }

    // Obtener información del servicio si existe
    let duration = 30;
    let servicePrice = null;

    if (serviceId) {
      const serviceResult = await query(
        'SELECT duration_minutes, price FROM services WHERE id = $1 AND doctor_id = $2',
        [serviceId, doctorId]
      );
      if (serviceResult.rows.length > 0) {
        duration = serviceResult.rows[0].duration_minutes;
        servicePrice = parseFloat(serviceResult.rows[0].price);
      }
    }

    console.log('✓ Validaciones pasadas');

    // Verificar disponibilidad con la duración real
    console.log(`Verificando disponibilidad para ${duration} min...`);
    const availability = await availabilityService.isAvailableAt(doctorId, appointment_date, appointment_time, duration);

    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: availability.reason
      });
    }

    console.log('✓ Disponibilidad verificada');

    // Crear cita
    console.log('Llamando a appointmentService.createAppointment...');
    const appointment = await appointmentService.createAppointment(doctorId, patientId, {
      appointment_date,
      appointment_time,
      end_time,
      reason_for_visit,
      insurance_company_id,
      serviceId,
      durationMinutes: duration,
      servicePrice
    });

    console.log('✓ Cita creada');

    // Recalcular cola
    await appointmentService.recalculateQueueForDate(doctorId, appointment_date);

    console.log('✓ Cola recalculada\n');

    res.status(201).json({
      success: true,
      message: 'Cita creada exitosamente',
      appointment
    });
  } catch (error) {
    console.error('\n❌ Error creando cita:', error.message);
    console.error('Stack:', error.stack, '\n');
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear la cita'
    });
  }
};

// Obtener citas del doctor
export const getAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { date, status } = req.query;

    const appointments = await appointmentService.getAppointmentsByDoctor(doctorId, {
      date,
      status
    });

    res.json({
      success: true,
      appointments,
      count: appointments.length
    });
  } catch (error) {
    console.error('Error obteniendo citas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener citas'
    });
  }
};

// Obtener citas del día
export const getTodayAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const appointments = await appointmentService.getAppointmentsForToday(doctorId);

    res.json({
      success: true,
      appointments,
      count: appointments.length
    });
  } catch (error) {
    console.error('Error obteniendo citas del día:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener citas del día'
    });
  }
};

// Obtener detalle de una cita
export const getAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user.id;

    const appointment = await appointmentService.getAppointmentById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Verificar que la cita pertenezca al doctor
    if (appointment.doctor_id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a esta cita'
      });
    }

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Error obteniendo cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la cita'
    });
  }
};

// Actualizar cita
export const updateAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user.id;
    const updateData = req.body;

    // Verificar que la cita exista y pertenezca al doctor
    const appointment = await appointmentService.getAppointmentById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    if (appointment.doctor_id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar esta cita'
      });
    }

    // Si se actualiza la fecha/hora, verificar disponibilidad
    if (updateData.appointment_date || updateData.appointment_time) {
      const newDate = updateData.appointment_date || appointment.appointment_date;
      const newTime = updateData.appointment_time || appointment.appointment_time;

      const availability = await availabilityService.isAvailableAt(doctorId, newDate, newTime);

      if (!availability.available) {
        return res.status(400).json({
          success: false,
          message: availability.reason
        });
      }
    }

    const updatedAppointment = await appointmentService.updateAppointment(appointmentId, updateData);

    // Recalcular cola si cambió la fecha
    if (updateData.appointment_date) {
      await appointmentService.recalculateQueueForDate(doctorId, updateData.appointment_date);
    }

    res.json({
      success: true,
      message: 'Cita actualizada exitosamente',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error actualizando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la cita'
    });
  }
};

// Cancelar cita
export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user.id;

    const appointment = await appointmentService.getAppointmentById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    if (appointment.doctor_id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cancelar esta cita'
      });
    }

    const cancelledAppointment = await appointmentService.cancelAppointment(appointmentId);

    // Recalcular cola
    await appointmentService.recalculateQueueForDate(doctorId, appointment.appointment_date);

    res.json({
      success: true,
      message: 'Cita cancelada exitosamente',
      appointment: cancelledAppointment
    });
  } catch (error) {
    console.error('Error cancelando cita:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la cita'
    });
  }
};

// Obtener estadísticas de citas
export const getStatistics = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate y endDate son requeridos'
      });
    }

    const stats = await appointmentService.getAppointmentStats(doctorId, startDate, endDate);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// Obtener slots disponibles
export const getAvailableSlots = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date es requerido'
      });
    }

    const slots = await availabilityService.getNextAvailableSlots(doctorId, date);

    res.json({
      success: true,
      date,
      slots,
      count: slots.length
    });
  } catch (error) {
    console.error('Error obteniendo slots disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener slots disponibles'
    });
  }
};
