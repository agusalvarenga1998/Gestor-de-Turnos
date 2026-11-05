import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const cookieName = flow => `oauth_${flow}`;
const options = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 10 * 60 * 1000 };

export function createOAuthState(res, flow, target, secret = process.env.JWT_SECRET) {
  if (!secret) throw new Error('OAuth secret required');
  const payload = Buffer.from(JSON.stringify({ target, expires: Date.now() + options.maxAge, nonce: randomBytes(32).toString('hex') })).toString('base64url');
  const state = `${payload}.${createHmac('sha256', secret).update(`${flow}:${payload}`).digest('hex')}`;
  res.cookie(cookieName(flow), state, options);
  return state;
}

export function consumeOAuthState(req, res, flow, secret = process.env.JWT_SECRET) {
  res.clearCookie(cookieName(flow), { ...options, maxAge: undefined });
  const state = req.query.state;
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName(flow)}=`))?.slice(cookieName(flow).length + 1);
  if (!secret || typeof state !== 'string' || cookie !== state) throw new Error('Invalid OAuth state');
  const [payload, signature, extra] = state.split('.');
  const expected = createHmac('sha256', secret).update(`${flow}:${payload}`).digest();
  if (extra || !/^[a-f0-9]{64}$/.test(signature || '') || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Invalid OAuth state');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.expires <= Date.now() || typeof data.target !== 'string') throw new Error('Expired OAuth state');
  return data.target;
}
