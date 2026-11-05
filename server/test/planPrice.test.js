import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanPrice } from '../src/utils/planPrice.js';

test('convierte precios de planes a importes sin perder miles ni centavos', () => {
  for (const [price, expected] of [
    ['$24.999', 24999], ['$24.999,50', 24999.5], ['ARS 24.999', 24999],
    ['24999.50', 24999.5], ['24999,50', 24999.5], [24999, 24999], [0, 0]
  ]) {
    assert.equal(parsePlanPrice(price), expected);
  }
});

test('rechaza precios inválidos en lugar de generar importes parciales o cero', () => {
  for (const price of [null, undefined, '', 'Consultar', '$', '-100', Infinity, '12abc', '1.23.456', '100000000']) {
    assert.throws(() => parsePlanPrice(price), /Invalid plan price/);
  }
});
