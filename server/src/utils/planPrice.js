// Los planes guardan precios de presentación; subscriptions.amount es DECIMAL(10,2).
export function parsePlanPrice(price) {
  let value = typeof price === 'number' ? String(price) : String(price ?? '').trim();
  value = value.replace(/^(?:ARS\s*|\$\s*)/i, '').trim();

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(?:,\d{1,2})?$/.test(value)) {
    value = value.replace(',', '.');
  } else if (!/^\d+\.\d{1,2}$/.test(value)) {
    throw new Error('Invalid plan price');
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99) {
    throw new Error('Invalid plan price');
  }
  return amount;
}
