import * as patientService from '../services/patientService.js';

// Crear un nuevo paciente
export const createPatient = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { name, email, phone, date_of_birth, gender, address, document_number } = req.body;

    // Validaciones
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del paciente es requerido'
      });
    }

    const patient = await patientService.createPatient(doctorId, {
      name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      document_number
    });

    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      patient
    });
  } catch (error) {
    console.error('Error creando paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el paciente'
    });
  }
};

// Obtener todos los pacientes del doctor
export const getPatients = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { search } = req.query;

    const patients = await patientService.getPatientsByDoctor(doctorId, search);

    res.json({
      success: true,
      patients,
      count: patients.length
    });
  } catch (error) {
    console.error('Error obteniendo pacientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes'
    });
  }
};

// Obtener detalle de un paciente
export const getPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user.id;

    const patient = await patientService.getPatientWithAppointments(patientId, doctorId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Obtener estadísticas
    const stats = await patientService.getPatientStats(patientId, doctorId);

    res.json({
      success: true,
      patient: {
        ...patient,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Error obteniendo paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el paciente'
    });
  }
};

// Actualizar paciente
export const updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user.id;
    const updateData = req.body;

    // Verificar que el paciente exista
    const patient = await patientService.getPatientById(patientId, doctorId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const updatedPatient = await patientService.updatePatient(patientId, doctorId, updateData);

    res.json({
      success: true,
      message: 'Paciente actualizado exitosamente',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('Error actualizando paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el paciente'
    });
  }
};

// Eliminar paciente (soft delete)
export const deletePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user.id;

    const patient = await patientService.getPatientById(patientId, doctorId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const deletedPatient = await patientService.deletePatient(patientId, doctorId);

    res.json({
      success: true,
      message: 'Paciente eliminado exitosamente',
      patient: deletedPatient
    });
  } catch (error) {
    console.error('Error eliminando paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el paciente'
    });
  }
};

// Buscar pacientes
export const searchPatients = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const patients = await patientService.searchPatients(doctorId, q);

    res.json({
      success: true,
      patients,
      count: patients.length
    });
  } catch (error) {
    console.error('Error buscando pacientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar pacientes'
    });
  }
};

// Obtener pacientes inactivos
export const getInactivePatients = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { daysThreshold = 90 } = req.query;

    const patients = await patientService.getInactivePatients(doctorId, daysThreshold);

    res.json({
      success: true,
      patients,
      count: patients.length,
      daysThreshold: parseInt(daysThreshold)
    });
  } catch (error) {
    console.error('Error obteniendo pacientes inactivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes inactivos'
    });
  }
};
