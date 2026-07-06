import { query } from '../db/config.js';

/**
 * Copia los servicios base configurados por el administrador para una especialidad a la cuenta del doctor.
 * Evita duplicados comparando por nombre de servicio (insensible a mayúsculas y espacios).
 * 
 * @param {string} doctorId - ID del profesional
 * @param {string} specialization - Especialización del profesional
 * @returns {Promise<number>} Cantidad de servicios precargados insertados
 */
export const copyTemplateServicesToDoctor = async (doctorId, specialization) => {
  if (!doctorId || !specialization) {
    console.log('⚠️ [copyTemplateServicesToDoctor] Falta doctorId o specialization');
    return 0;
  }

  const cleanSpecialization = specialization.trim();
  console.log(`📦 [copyTemplateServicesToDoctor] Buscando plantillas para especialidad: "${cleanSpecialization}"...`);

  try {
    // 1. Obtener plantillas para la especialidad exacta (insensible a mayúsculas y espacios trimados)
    const templatesResult = await query(
      `SELECT * FROM admin_template_services 
       WHERE TRIM(LOWER(specialization)) = TRIM(LOWER($1))`,
      [cleanSpecialization]
    );

    const templates = templatesResult.rows;
    if (templates.length === 0) {
      console.log(`ℹ️ [copyTemplateServicesToDoctor] No se encontraron plantillas de servicios para: "${cleanSpecialization}"`);
      return 0;
    }

    console.log(`✓ [copyTemplateServicesToDoctor] Se encontraron ${templates.length} plantillas.`);

    // 2. Obtener servicios actuales del doctor para evitar duplicados por nombre
    const currentServicesResult = await query(
      `SELECT TRIM(LOWER(name)) as name_lower FROM services WHERE doctor_id = $1`,
      [doctorId]
    );
    const existingServiceNames = new Set(currentServicesResult.rows.map(row => row.name_lower));

    let insertedCount = 0;

    // 3. Insertar los servicios que no estén duplicados
    for (const template of templates) {
      const templateNameLower = template.name.trim().toLowerCase();
      
      if (existingServiceNames.has(templateNameLower)) {
        console.log(`ℹ️ [copyTemplateServicesToDoctor] El servicio "${template.name}" ya existe para el doctor. Omitiendo.`);
        continue;
      }

      console.log(`➕ [copyTemplateServicesToDoctor] Copiando servicio base "${template.name}"...`);
      await query(
        `INSERT INTO services (
          doctor_id, 
          name, 
          description, 
          price, 
          duration_minutes, 
          booking_fee, 
          code, 
          is_online
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          doctorId,
          template.name,
          template.description || '',
          template.price || 0,
          template.duration_minutes,
          template.booking_fee || 0,
          template.code || null,
          template.is_online || false
        ]
      );
      insertedCount++;
    }

    console.log(`✅ [copyTemplateServicesToDoctor] Copiado de plantillas finalizado. Total insertados: ${insertedCount}`);
    return insertedCount;
  } catch (error) {
    console.error('❌ [copyTemplateServicesToDoctor] Error copiando servicios base:', error);
    throw error;
  }
};
