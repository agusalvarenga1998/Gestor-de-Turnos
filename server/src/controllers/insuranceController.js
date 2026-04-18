import * as insuranceService from '../services/insuranceService.js';

export const getInsurances = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const insurances = await insuranceService.getInsurancesByDoctor(doctorId);

    res.json({
      success: true,
      insurances
    });
  } catch (error) {
    console.error('Error obteniendo obras sociales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener obras sociales'
    });
  }
};

export const createInsurance = async (req, res) => {
  try {
    const { name, additional_fee } = req.body;
    const doctorId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la obra social es requerido'
      });
    }

    const insurance = await insuranceService.createInsurance(
      doctorId,
      name,
      additional_fee || 0
    );

    res.status(201).json({
      success: true,
      insurance
    });
  } catch (error) {
    console.error('Error creando obra social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear obra social'
    });
  }
};

export const updateInsurance = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, additional_fee } = req.body;
    const doctorId = req.user.id;

    const insurance = await insuranceService.updateInsurance(id, doctorId, {
      name,
      additional_fee
    });

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Obra social no encontrada'
      });
    }

    res.json({
      success: true,
      insurance
    });
  } catch (error) {
    console.error('Error actualizando obra social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar obra social'
    });
  }
};

export const deleteInsurance = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const insurance = await insuranceService.deleteInsurance(id, doctorId);

    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Obra social no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Obra social eliminada'
    });
  } catch (error) {
    console.error('Error eliminando obra social:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar obra social'
    });
  }
};

export const getPatientInsurances = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user.id;

    const insurances = await insuranceService.getPatientInsurances(
      patientId,
      doctorId
    );

    res.json({
      success: true,
      insurances
    });
  } catch (error) {
    console.error('Error obteniendo obras sociales del paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener obras sociales del paciente'
    });
  }
};

export const setPatientInsurances = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { insuranceIds } = req.body;

    const insurances = await insuranceService.setPatientInsurances(
      patientId,
      insuranceIds
    );

    res.json({
      success: true,
      insurances
    });
  } catch (error) {
    console.error('Error asignando obras sociales al paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar obras sociales'
    });
  }
};

export const getPublicInsurances = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const insurances = await insuranceService.getInsurancesByDoctor(doctorId);

    res.json({
      success: true,
      insurances
    });
  } catch (error) {
    console.error('Error obteniendo obras sociales públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener obras sociales'
    });
  }
};
