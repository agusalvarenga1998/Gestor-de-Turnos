import test from 'node:test';
import assert from 'node:assert/strict';
import { createOAuthState, consumeOAuthState } from '../src/utils/oauthState.js';

function flow(target = 'doctor-id') {
  const cookies = {};
  const res = { cookie: (name, value) => { cookies[name] = value; }, clearCookie() {} };
  const state = createOAuthState(res, 'google', target, 'test-secret');
  return { state, res, req: { query: { state }, headers: { cookie: `oauth_google=${cookies.oauth_google}` } } };
}

test('OAuth vincula el destino firmado al navegador que inició el flujo', () => {
  const { req, res } = flow();
  assert.equal(consumeOAuthState(req, res, 'google', 'test-secret'), 'doctor-id');
});

test('OAuth rechaza cambios de destino, navegador, proveedor y secreto', () => {
  const { req, res, state } = flow();
  assert.throws(() => consumeOAuthState({ ...req, headers: {} }, res, 'google', 'test-secret'));
  assert.throws(() => consumeOAuthState(req, res, 'mp', 'test-secret'));
  assert.throws(() => consumeOAuthState(req, res, 'google', 'other-secret'));
  const tampered = `${Buffer.from(JSON.stringify({ target: 'victim', expires: Date.now() + 10000 })).toString('base64url')}.${state.split('.')[1]}`;
  assert.throws(() => consumeOAuthState({ query: { state: tampered }, headers: { cookie: `oauth_google=${tampered}` } }, res, 'google', 'test-secret'));
  assert.throws(() => consumeOAuthState({ query: { state: ['bad'] }, headers: {} }, res, 'google', 'test-secret'));
});

test('OAuth rechaza estados vencidos', () => {
  const original = Date.now;
  const { req, res } = flow('login');
  try {
    Date.now = () => original() + 11 * 60 * 1000;
    assert.throws(() => consumeOAuthState(req, res, 'google', 'test-secret'));
  } finally { Date.now = original; }
});
