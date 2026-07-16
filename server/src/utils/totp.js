import crypto from 'crypto';

// Helper para decodificar Base32 a Hexadecimal
function base32tohex(base32) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let hex = "";

  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
}

/**
 * Verifica un código TOTP de 6 dígitos con un secreto Base32.
 * Soporta una ventana de tiempo (window) para tolerar desincronización horaria.
 */
export function verifyTOTP(secret, token, window = 1) {
  try {
    if (!secret || !token) return false;
    const keyHex = base32tohex(secret);
    const key = Buffer.from(keyHex, 'hex');
    
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const timeStep = Math.floor(epoch / 30);

    for (let i = -window; i <= window; i++) {
      const step = timeStep + i;
      
      const buffer = Buffer.alloc(8);
      let temp = step;
      for (let j = 7; j >= 0; j--) {
        buffer[j] = temp & 0xff;
        temp = temp >> 8;
      }

      const hmac = crypto.createHmac('sha1', key);
      hmac.update(buffer);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const code =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const otp = (code % 1000000).toString().padStart(6, '0');
      if (otp === token) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error al verificar TOTP:', error);
    return false;
  }
}

/**
 * Genera un secreto Base32 aleatorio de 16 caracteres para 2FA.
 */
export function generateSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 16; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}
