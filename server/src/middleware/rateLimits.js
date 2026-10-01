import rateLimit from 'express-rate-limit';
const limiter = (limit, windowMs, message) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, message }
});
export const loginLimit = limiter(30, 15 * 60 * 1000, 'Demasiados intentos. Espera unos minutos para volver a ingresar.');
export const recoveryLimit = limiter(5, 15 * 60 * 1000, 'Ya solicitaste varios códigos. Revisa tu correo o espera unos minutos.');
export const publicLimit = limiter(120, 60 * 1000, 'Espera un momento y vuelve a intentar.');
