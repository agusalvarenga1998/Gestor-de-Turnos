import * as patientRecordService from '../services/patientRecordService.js';
import * as patientService from '../services/patientService.js';
import path from 'path';
import fs from 'fs';
import { uploadsDir } from '../utils/paths.js';

export const createRecord = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;
    const { type, title, content } = req.body;

    // Verificar que el paciente pertenezca al doctor
    const patient = await patientService.getPatientById(patientId, doctorId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    let recordData = {
      type,
      title,
      content
    };

    if (req.file) {
      recordData.file_path = `/uploads/${req.file.filename}`;
      recordData.file_name = req.file.originalname;
      recordData.file_type = req.file.mimetype;
      recordData.file_size = req.file.size;
      
      if (!recordData.type) {
        recordData.type = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
      }
    }

    const record = await patientRecordService.createRecord(doctorId, patientId, recordData);

    res.status(201).json({
      success: true,
      message: 'Registro añadido exitosamente',
      record
    });
  } catch (error) {
    console.error('Error creando registro de paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al añadir el registro'
    });
  }
};

export const getRecords = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const records = await patientRecordService.getRecordsByPatient(doctorId, patientId);

    res.json({
      success: true,
      records
    });
  } catch (error) {
    console.error('Error obteniendo registros de paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los registros'
    });
  }
};

export const deleteRecord = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { recordId } = req.params;

    const record = await patientRecordService.deleteRecord(doctorId, recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }

    // Opcional: Eliminar archivo físico si existe
    if (record.file_path) {
      const filename = path.basename(record.file_path);
      const fullPath = path.join(uploadsDir, filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({
      success: true,
      message: 'Registro eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando registro de paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el registro'
    });
  }
};
