import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { backupKey, encryptFile, decryptFile, safeAttachmentPath, assertRestoreTarget } from '../src/utils/backupCrypto.js';

test('respaldo cifrado restaura contenido, admite archivos vacíos y detecta alteraciones', async () => {
  const root = path.resolve('scratch'); await mkdir(root, { recursive: true });
  const temporary = await mkdtemp(path.join(root, 'backup-test-'));
  try {
    const key = backupKey('ab'.repeat(32));
    for (const [index, content] of ['Datos ficticios de prueba', ''].entries()) {
      const original = path.join(temporary, `original-${index}`), encrypted = path.join(temporary, `encrypted-${index}`), restored = path.join(temporary, `restored-${index}`);
      await writeFile(original, content); await encryptFile(original, encrypted, key); await decryptFile(encrypted, restored, key);
      assert.equal((await readFile(restored)).toString(), content);
      const bytes = await readFile(encrypted); bytes[bytes.length - 1] ^= 1; await writeFile(encrypted, bytes);
      await assert.rejects(decryptFile(encrypted, `${restored}-bad`, key));
    }
  } finally {
    assert.equal(path.dirname(temporary), root);
    await rm(temporary, { recursive: true, force: true });
  }
});

test('no restaura sobre producción ni admite rutas que salgan del destino', () => {
  assert.throws(() => assertRestoreTarget('postgres://a@host/production', 'postgres://a@host/production'));
  assert.throws(() => assertRestoreTarget('postgres://a@host/turnohub_restore_check_x', 'postgres://a@other/turnohub_restore_check_x'));
  assert.doesNotThrow(() => assertRestoreTarget('postgres://a@host/production', 'postgres://a@host/turnohub_restore_check_x'));
  for (const relative of ['../secret', '/etc/password', 'C:\\private', '..\\secret']) assert.throws(() => safeAttachmentPath(path.resolve('scratch'), relative));
  assert.throws(() => backupKey('short'));
});
