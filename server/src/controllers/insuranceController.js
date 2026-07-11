import * as insuranceService from '../services/insuranceService.js';
import * as insurancePlanService from '../services/insurancePlanService.js';
import { query } from '../db/config.js';
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

    // Helper para encontrar columnas sin importar mayúsculas o espacios
    const getColumnValue = (row, possibleNames) => {
      const keys = Object.keys(row);
      for (const name of possibleNames) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
        if (foundKey) return row[foundKey];
      }
      return null;
    };

    for (const row of data) {
      try {
        const convenioName = getColumnValue(row, ['CONVENIO', 'Convenio', 'convenio']);
        const servicioName = getColumnValue(row, ['SERVICIO', 'Servicio', 'servicio']);
        const descuentoRaw = getColumnValue(row, ['DESCUENTO', 'Descuento', 'descuento']) || '0';

        if (!convenioName || !servicioName) {
          errors.push(`Fila omitida: Asegúrate de que las columnas se llamen exactamente CONVENIO y SERVICIO`);
          continue;
        }

        const cleanConvenio = String(convenioName).trim();
        const cleanServicio = String(servicioName).trim();

        // 1. Buscar Obra Social - Si no existe, crearla
        let insurance = await insuranceService.getInsuranceByName(doctorId, cleanConvenio);
        
        if (!insurance) {
          console.log(`Convenio "${cleanConvenio}" no existe. Creándolo automáticamente...`);
          insurance = await insuranceService.createInsurance(doctorId, cleanConvenio, 0);
        }

        // 2. Buscar Servicio - Este debe existir previamente
        const service = await insuranceService.getServiceByName(doctorId, cleanServicio);

        if (!service) {
          const availableServices = await insuranceService.getOnlyServicesByDoctor(doctorId);
          const serviceNames = availableServices.map(s => `"${s.name}"`).join(', ');
          errors.push(`Servicio "${cleanServicio}" no encontrado. Tus servicios actuales son: ${serviceNames}. Asegúrate de que el nombre coincida exactamente.`);
          continue;
        }

        // 3. Determinar tipo y valor de descuento
        let type = 'fixed_amount';
        let value = 0;
        const discountStr = String(descuentoRaw).trim();

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
        console.error('Error procesando fila:', err);
        errors.push(`Error en fila: ${err.message}`);
      }
    }

    console.log(`Import finished. Success: ${importedCount}, Errors: ${errors.length}`);

    res.json({
      success: true,
      message: importedCount > 0 
        ? `Se procesaron ${importedCount} beneficios correctamente`
        : `No se pudo procesar ningún beneficio. Revisa los nombres y encabezados.`,
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
    
    // Adjuntar las coberturas específicas por servicio y los planes para cada obra social
    for (let insurance of insurances) {
      const coverages = await insuranceService.getInsuranceServiceCoverages(insurance.id);
      insurance.coverages = coverages || [];
      
      const plans = await insurancePlanService.getPlansByInsurance(insurance.id);
      insurance.plans = plans || [];
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

export const getPlans = async (req, res) => {
  try {
    const { id } = req.params; // insurance company id
    const plans = await insurancePlanService.getPlansByInsurance(id);
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error obteniendo planes de obra social:', error);
    res.status(500).json({ success: false, message: 'Error al obtener planes' });
  }
};

export const createPlan = async (req, res) => {
  try {
    const { id } = req.params; // insurance company id
    const { name, coverageType, coverageValue } = req.body;
    const doctorId = req.user.id;

    // Verificar que la obra social pertenece al doctor
    const insuranceCheck = await query(
      'SELECT doctor_id FROM insurance_companies WHERE id = $1',
      [id]
    );
    if (insuranceCheck.rows.length === 0 || insuranceCheck.rows[0].doctor_id !== doctorId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para agregar planes a esta obra social' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'El nombre del plan es requerido' });
    }

    const plan = await insurancePlanService.createPlan(
      id,
      name,
      coverageType || 'fixed_amount',
      parseFloat(coverageValue) || 0
    );

    res.status(201).json({ success: true, plan });
  } catch (error) {
    console.error('Error creando plan:', error);
    res.status(500).json({ success: false, message: 'Error al crear plan' });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, coverageType, coverageValue } = req.body;
    const doctorId = req.user.id;

    const plan = await insurancePlanService.getPlanById(planId);
    if (!plan || plan.doctor_id !== doctorId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para modificar este plan' });
    }

    const updated = await insurancePlanService.updatePlan(planId, {
      name,
      coverage_type: coverageType,
      coverage_value: parseFloat(coverageValue)
    });

    res.json({ success: true, plan: updated });
  } catch (error) {
    console.error('Error actualizando plan:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar plan' });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const doctorId = req.user.id;

    const plan = await insurancePlanService.getPlanById(planId);
    if (!plan || plan.doctor_id !== doctorId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este plan' });
    }

    await insurancePlanService.deletePlan(planId);

    res.json({ success: true, message: 'Plan eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando plan:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar plan' });
  }
};

// === CATÁLOGO DE PLANTILLAS DE CONVENIOS (PARA MÉDICOS) ===

// 1. Obtener convenios disponibles del catálogo global (no importados aún)
export const getTemplateCatalog = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const result = await query(`
      SELECT 
        ti.id, ti.name, ti.acronym,
        COALESCE(
          json_agg(
            json_build_object(
              'id', tp.id,
              'name', tp.name,
              'coverage_type', tp.coverage_type,
              'coverage_value', tp.coverage_value
            )
          ) FILTER (WHERE tp.id IS NOT NULL),
          '[]'
        ) as plans
      FROM admin_template_insurances ti
      LEFT JOIN admin_template_insurance_plans tp ON ti.id = tp.insurance_template_id
      WHERE ti.name NOT IN (
        SELECT name FROM insurance_companies WHERE doctor_id = $1
      )
      GROUP BY ti.id
      ORDER BY ti.name ASC
    `, [doctorId]);

    res.json({
      success: true,
      catalog: result.rows
    });
  } catch (error) {
    console.error('Error fetching template catalog:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el catálogo de convenios' });
  }
};

// 2. Importar convenios y planes seleccionados del catálogo al perfil del doctor
import { v4 as uuidv4 } from 'uuid';

export const importFromCatalog = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { insuranceIds } = req.body;

    if (!insuranceIds || !Array.isArray(insuranceIds) || insuranceIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No se especificaron convenios para importar' });
    }

    let importedCount = 0;

    await query('BEGIN');

    for (const templateId of insuranceIds) {
      // 1. Obtener datos de la plantilla
      const insRes = await query(
        'SELECT name, acronym FROM admin_template_insurances WHERE id = $1',
        [templateId]
      );

      if (insRes.rows.length === 0) {
        continue;
      }

      const { name, acronym } = insRes.rows[0];

      // 2. Verificar si el doctor ya lo tiene importado (por nombre)
      const existingRes = await query(
        'SELECT id FROM insurance_companies WHERE doctor_id = $1 AND TRIM(LOWER(name)) = TRIM(LOWER($2))',
        [doctorId, name]
      );

      let companyId;
      if (existingRes.rows.length === 0) {
        // 3. Crear obra social para el doctor
        companyId = uuidv4();
        await query(
          `INSERT INTO insurance_companies (id, doctor_id, name, additional_fee)
           VALUES ($1, $2, $3, $4)`,
          [companyId, doctorId, name, 0]
        );
        importedCount++;
      } else {
        companyId = existingRes.rows[0].id;
      }

      // 4. Copiar los planes de esta plantilla
      const plansRes = await query(
        'SELECT name, coverage_type, coverage_value FROM admin_template_insurance_plans WHERE insurance_template_id = $1',
        [templateId]
      );

      for (const plan of plansRes.rows) {
        // Verificar si ya existe este plan para este convenio del doctor
        const planExist = await query(
          'SELECT id FROM insurance_plans WHERE insurance_company_id = $1 AND TRIM(LOWER(name)) = TRIM(LOWER($2))',
          [companyId, plan.name]
        );

        if (planExist.rows.length === 0) {
          await query(
            `INSERT INTO insurance_plans (id, insurance_company_id, name, coverage_type, coverage_value)
             VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), companyId, plan.name, plan.coverage_type, plan.coverage_value]
          );
        }
      }
    }

    await query('COMMIT');

    res.json({
      success: true,
      message: `Se importaron ${importedCount} convenios con sus planes correctamente`,
      importedCount
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error importing from catalog:', error);
    res.status(500).json({ success: false, message: 'Error al importar los convenios del catálogo' });
  }
};

