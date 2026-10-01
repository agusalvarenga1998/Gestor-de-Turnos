import { transaction, query } from '../db/config.js';
import { requireUuid } from '../utils/validation.js';

// Buffer JSON until commit: failed validation rolls back every preceding write.
export const transactionalRoute = handler => async (req, res, next) => {
  const originalJson = res.json;
  let payload;
  res.json = body => { payload = body; return res; };
  try {
    const doctorId = requireUuid(req.user?.id || req.body.doctorId, 'Profesional');
    await transaction(async () => {
      await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`booking:${doctorId}`]);
      await handler(req, res, next);
      if (res.statusCode >= 400) throw Object.assign(new Error('rollback response'), { responseSent: true });
    });
    res.json = originalJson;
    return res.json(payload);
  } catch (error) {
    res.json = originalJson;
    if (error.responseSent) return res.json(payload);
    return res.status(error.status || (['23505', '23P01'].includes(error.code) ? 409 : 500)).json({ success: false, message: error.status ? error.message : 'No se pudo guardar el turno. Actualiza los horarios e intenta nuevamente.' });
  }
};
