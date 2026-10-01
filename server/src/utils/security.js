import 'dotenv/config';
import jwt from 'jsonwebtoken';

export const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'your_secret_key') {
  throw new Error('Configura JWT_SECRET con un secreto privado antes de iniciar.');
}

export const signPurposeToken = (payload, purpose, expiresIn = '10m') =>
  jwt.sign({ ...payload, purpose }, jwtSecret, { expiresIn });

export const readPurposeToken = (token, purpose) => {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    return decoded.purpose === purpose ? decoded : null;
  } catch { return null; }
};

export const validPassword = password => typeof password === 'string' && password.length >= 10 && Buffer.byteLength(password, 'utf8') <= 72;
