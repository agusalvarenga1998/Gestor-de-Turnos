import * as insuranceService from '../services/insuranceService.js';
import * as XLSX from 'xlsx';

export const exportInsuranceCoverages = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const services = await insuranceService.getOnlyServicesByDoctor(doctorId);

    // Formatear para Excel (Solo nombres de servicios como plantilla)
    const worksheetData = services.map(s => ({
      'CONVENIO': '',
      'SERVICIO': s.name,
      'DESCUENTO': ''
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Beneficios');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_beneficios.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exportando plantilla:', error);
    res.status(500).json({ success: false, message: 'Error al exportar plantilla' });
  }
};

export const importInsuranceCoverages = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    const doctorId = req.user.id;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'El archivo Excel está vacío' });
    }

    let importedCount = 0;
    let errors = [];

    for (const row of data) {
      try {
        const convenioName = row['CONVENIO'] || row['Convenio'];
        const servicioName = row['SERVICIO'] || row['Servicio'];
        const descuentoRaw = row['DESCUENTO'] || row['Descuento'] || '0';

        if (!convenioName || !servicioName) continue;

        // Buscar IDs por nombre
        const insurance = await insuranceService.getInsuranceByName(doctorId, String(convenioName).trim());
        const service = await insuranceService.getServiceByName(doctorId, String(servicioName).trim());

        if (!insurance) {
          errors.push(`Convenio "${convenioName}" no encontrado`);
          continue;
        }
        if (!service) {
          errors.push(`Servicio "${servicioName}" no encontrado`);
          continue;
        }

        // Determinar tipo y valor
        let type = 'fixed_amount';
        let value = 0;
        const discountStr = String(descuentoRaw);

        if (discountStr.includes('%')) {
          type = 'percentage';
          value = parseFloat(discountStr.replace('%', '')) || 0;
        } else {
          value = parseFloat(discountStr) || 0;
        }

        await insuranceService.setInsuranceServiceCoverage(
          insurance.id,
          service.id,
          type,
          value
        );
        importedCount++;
      } catch (err) {
        errors.push(`Error en fila: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Se procesaron ${importedCount} beneficios correctamente`,
      importedCount,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Error importando beneficios:', error);
    res.status(500).json({ success: false, message: 'Error al procesar el archivo Excel' });
  }
};

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
    
    // Adjuntar las coberturas específicas por servicio para cada obra social
    for (let insurance of insurances) {
      const coverages = await insuranceService.getInsuranceServiceCoverages(insurance.id);
      insurance.coverages = coverages || [];
    }

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

export const getServiceCoverages = async (req, res) => {
  try {
    const { id } = req.params; // insurance id
    console.log('🔍 [DEBUG] getServiceCoverages requested for ID:', id);
    
    if (!id) {
      console.log('❌ [DEBUG] No ID provided in params');
      return res.status(400).json({ success: false, message: 'ID de obra social no proporcionado' });
    }

    const coverages = await insuranceService.getInsuranceServiceCoverages(id);
    console.log(`✅ [DEBUG] Found ${coverages ? coverages.length : 0} coverages`);
    
    res.json({
      success: true,
      coverages: coverages || []
    });
  } catch (error) {
    console.error('❌ [ERROR] getServiceCoverages failed:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener coberturas por servicio',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



export const setServiceCoverage = async (req, res) => {
  try {
    const { id } = req.params; // insurance id
    const { serviceId, coverageType, coverageValue } = req.body;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: 'El ID del servicio es requerido'
      });
    }

    const coverage = await insuranceService.setInsuranceServiceCoverage(
      id,
      serviceId,
      coverageType || 'fixed_amount',
      coverageValue || 0
    );

    res.json({
      success: true,
      coverage
    });
  } catch (error) {
    console.error('Error configurando cobertura por servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al configurar cobertura'
    });
  }
};

