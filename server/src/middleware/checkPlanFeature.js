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
          p.allow_insurance,
          p.allow_whatsapp
         FROM doctors d
         LEFT JOIN pricing_plans p ON d.pricing_plan_id = p.id
         WHERE d.id = $1`,
        [doctorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profesional no encontrado' });
      }

      const row = result.rows[0];

      // WhatsApp es una prestación opcional: solo se habilita con un true explícito.
      const isAllowed = featureField === 'allow_whatsapp'
        ? row[featureField] === true
        : row[featureField] !== false;

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
      if (featureField === 'allow_whatsapp') {
        return res.status(503).json({
          success: false,
          planRestricted: true,
          message: 'No se pudo verificar el acceso a WhatsApp. Intenta nuevamente.'
        });
      }
      next(); // Las prestaciones históricas conservan su comportamiento anterior.
    }
  };
};
