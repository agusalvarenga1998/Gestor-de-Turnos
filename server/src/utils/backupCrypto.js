import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { writeFile, appendFile, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

export function backupKey(value) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('BACKUP_ENCRYPTION_KEY debe contener 64 caracteres hexadecimales y guardarse fuera del respaldo.');
  return Buffer.from(value, 'hex');
}
export function safeAttachmentPath(root, relative) {
  if (typeof relative !== 'string' || !relative || /(^[\\/]|^[a-z]:|(^|[\\/])\.\.([\\/]|$))/i.test(relative)) throw new Error('Ruta de adjunto inválida.');
  const target = path.resolve(root, relative.replace(/\\/g, path.sep));
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('El adjunto debe permanecer dentro del destino.');
  return target;
}
export async function encryptStream(source, destination, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  await writeFile(destination, Buffer.concat([Buffer.from('THB1'), iv]), { flag: 'wx', mode: 0o600 });
  await pipeline(source, cipher, createWriteStream(destination, { flags: 'a' }));
  await appendFile(destination, cipher.getAuthTag());
}
export const encryptFile = (source, destination, key) => encryptStream(createReadStream(source), destination, key);
export async function decryptFile(source, destination, key) {
  const size = (await stat(source)).size;
  if (size < 32) throw new Error('Respaldo truncado.');
  const file = await import('node:fs/promises').then(fs => fs.open(source, 'r'));
  const header = Buffer.alloc(16), tag = Buffer.alloc(16);
  try { await file.read(header, 0, 16, 0); await file.read(tag, 0, 16, size - 16); } finally { await file.close(); }
  if (header.subarray(0, 4).toString() !== 'THB1') throw new Error('Formato de respaldo inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(4));
  decipher.setAuthTag(tag);
  await pipeline(size === 32 ? Readable.from([]) : createReadStream(source, { start: 16, end: size - 17 }), decipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
}
export async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
export function assertRestoreTarget(sourceUrl, targetUrl) {
  const source = new URL(sourceUrl), target = new URL(targetUrl);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (!/^turnohub_restore_check_[a-z0-9_]+$/.test(name) || name === decodeURIComponent(source.pathname.slice(1))) throw new Error('La restauración solo admite una base de prueba distinta, con prefijo turnohub_restore_check_.');
  return target;
}
