export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const httpError = (message, status = 400) => Object.assign(new Error(message), { status });
export const requireUuid = (value, label = 'Identificador') => {
  if (!uuidPattern.test(value || '')) throw httpError(`${label} inválido.`);
  return value;
};
export const finiteAmount = (value, { min = 0, max = 99999999.99 } = {}) => {
  if ((typeof value === 'string' && !value.trim()) || value === null || value === undefined || typeof value === 'boolean') throw httpError('Ingresa un importe válido.');
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw httpError('El importe debe ser válido y tener como máximo dos decimales.');
  return n;
};
export const validDuration = value => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 5 || n > 720) throw httpError('La duración debe ser de 5 a 720 minutos.');
  return n;
};
export const localDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const calendarDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(value)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw httpError('Selecciona una fecha válida.');
  return value;
};
