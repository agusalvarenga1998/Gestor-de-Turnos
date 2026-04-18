import * as availabilityService from '../services/availabilityService.js';

// Crear disponibilidad
export const createAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { day_of_week, start_time, end_time } = req.body;

    // Validaciones
    if (!day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'day_of_week, start_time y end_time son requeridos'
      });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({
        success: false,
        message: 'day_of_week debe ser entre 0 (domingo) y 6 (sábado)'
      });
    }

    const availability = await availabilityService.createAvailability(doctorId, {
      day_of_week,
      start_time,
      end_time
    });

    res.status(201).json({
      success: true,
      message: 'Disponibilidad creada exitosamente',
      availability
    });
  } catch (error) {
    console.error('Error creando disponibilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear disponibilidad'
    });
  }
};

// Obtener disponibilidades
export const getAvailabilities = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const availabilities = await availabilityService.getAvailabilitiesByDoctor(doctorId);

    res.json({
      success: true,
      availabilities,
      count: availabilities.length
    });
  } catch (error) {
    console.error('Error obteniendo disponibilidades:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener disponibilidades'
    });
  }
};

// Actualizar disponibilidad
export const updateAvailability = async (req, res) => {
  try {
    const { availabilityId } = req.params;
    const doctorId = req.user.id;
    const updateData = req.body;

    const availability = await availabilityService.updateAvailability(
      availabilityId,
      doctorId,
      updateData
    );

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Disponibilidad no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Disponibilidad actualizada exitosamente',
      availability
    });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar disponibilidad'
    });
  }
};

// Eliminar disponibilidad
export const deleteAvailability = async (req, res) => {
  try {
    const { availabilityId } = req.params;
    const doctorId = req.user.id;

    const availability = await availabilityService.deleteAvailability(availabilityId, doctorId);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Disponibilidad no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Disponibilidad eliminada exitosamente',
      availability
    });
  } catch (error) {
    console.error('Error eliminando disponibilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar disponibilidad'
    });
  }
};

// Agregar vacación
export const addVacation = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { start_date, end_date, reason } = req.body;

    // Validaciones
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'start_date y end_date son requeridos'
      });
    }

    const vacation = await availabilityService.addVacation(doctorId, {
      start_date,
      end_date,
      reason
    });

    res.status(201).json({
      success: true,
      message: 'Vacación agregada exitosamente',
      vacation
    });
  } catch (error) {
    console.error('Error agregando vacación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar vacación'
    });
  }
};

// Obtener vacaciones
export const getVacations = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const vacations = await availabilityService.getVacationsByDoctor(doctorId);

    res.json({
      success: true,
      vacations,
      count: vacations.length
    });
  } catch (error) {
    console.error('Error obteniendo vacaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vacaciones'
    });
  }
};

// Obtener vacaciones activas
export const getActiveVacations = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const vacations = await availabilityService.getActiveVacations(doctorId);

    res.json({
      success: true,
      vacations,
      count: vacations.length
    });
  } catch (error) {
    console.error('Error obteniendo vacaciones activas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vacaciones activas'
    });
  }
};

// Eliminar vacación
export const deleteVacation = async (req, res) => {
  try {
    const { vacationId } = req.params;
    const doctorId = req.user.id;

    const vacation = await availabilityService.deleteVacation(vacationId, doctorId);

    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'Vacación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Vacación eliminada exitosamente',
      vacation
    });
  } catch (error) {
    console.error('Error eliminando vacación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar vacación'
    });
  }
};
