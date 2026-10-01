import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { finiteAmount, calendarDate, validDuration, localDate } from '../src/utils/validation.js';
import { validPaymentSignature, validateApprovedPayment } from '../src/utils/paymentValidation.js';

test('rejects invalid financial values without accepting parseFloat prefixes', () => {
  for (const value of ['abc', '12abc', NaN, Infinity, -1, 1.001, null, true, '']) assert.throws(() => finiteAmount(value));
  assert.equal(finiteAmount('1200.50'), 1200.5);
  assert.equal(finiteAmount(0), 0);
});
test('calendar dates and duration are bounded', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-01-32', 'invalid']) assert.throws(() => calendarDate(date));
  assert.equal(calendarDate('2028-02-29'), '2028-02-29');
  for (const duration of [0,-1,721,5.5,'abc']) assert.throws(() => validDuration(duration));
  assert.equal(validDuration('30'), 30);
  assert.equal(localDate(new Date('2026-10-01T01:00:00Z')), '2026-09-30');
});
test('Mercado Pago signature binds data ID and request ID', () => {
  const secret = 'test-only-secret';
  const v1 = createHmac('sha256',secret).update('id:123;request-id:req;ts:1704908010;').digest('hex');
  const args = { secret, requestId:'req', dataId:'123', signature:`ts=1704908010,v1=${v1}` };
  assert.equal(validPaymentSignature(args),true);
  for (const override of [{dataId:'456'}, {requestId:'other'}, {secret:'other'}, {signature:'ts=1,v1=bad'}, {secret:''}]) assert.equal(validPaymentSignature({...args,...override}),false);
});
test('approved payment must match reference, amount, and currency', () => {
  const payment={status:'approved',external_reference:'reference',currency_id:'ARS',transaction_amount:1200};
  assert.doesNotThrow(()=>validateApprovedPayment(payment,'reference','1200.00'));
  for (const change of [{status:'pending'}, {external_reference:'other'}, {currency_id:'USD'}, {transaction_amount:1}, {transaction_amount:NaN}]) assert.throws(()=>validateApprovedPayment({...payment,...change},'reference',1200));
});
