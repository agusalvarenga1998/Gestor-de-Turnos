import { query } from '../db/config.js';

export const checkPlanFeature = (featureField) => {
  return async (req, res, next) => {
    try {
      const doctorId = req.user?.id;
      if (!doctorId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

            // Consultar el plan y sus permisos directamente de la base de datos
      const result = await query(
        `SELECT 
          d.plan_type,
          p.allow_google_calendar,
          p.allow_mercadopago,
          p.allow_telemedicine,
          p.allow_reminders,
          p.allow_insurance
         FROM doctors d
         LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
         WHERE d.id = $1`,
        [doctorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profesional no encontrado' });
      }

      const row = result.rows[0];

      // Si no tiene plan asignado o la columna es nula, por defecto permitimos (evita bloqueos inesperados)
      const isAllowed = row[featureField] !== false;

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          planRestricted: true,
          message: 'Esta funcionalidad no está incluida en tu plan actual. Contacta al administrador para actualizar tu plan.'
        });
      }

      next();
    } catch (error) {
      console.error(`Error verificando característica de plan (${featureField}):`, error);
      next(); // En caso de error de base de datos, permitimos pasar para no degradar el servicio
    }
  };
};
