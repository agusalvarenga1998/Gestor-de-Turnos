import 'dotenv/config';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, mkdtemp, rm, rename, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import { uploadsDir } from './utils/paths.js';
import { backupKey, encryptFile, encryptStream, decryptFile, sha256File, safeAttachmentPath, assertRestoreTarget } from './utils/backupCrypto.js';

function connectionEnv(connectionUrl) {
  const url = new URL(connectionUrl);
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || process.env.PGSSLMODE || 'require' };
}
function childDone(child, name) {
  return new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error(`No se pudo ejecutar ${name}. Instalá las herramientas cliente de PostgreSQL.`)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${name} terminó con error. Revisá la configuración y permisos de la base de prueba.`)));
    child.stderr?.resume();
  });
}
async function writeReport(report) {
  if (!process.env.BACKUP_STATUS_FILE) throw new Error('Configurá BACKUP_STATUS_FILE.');
  await mkdir(path.dirname(path.resolve(process.env.BACKUP_STATUS_FILE)), { recursive: true });
  const temporary = `${process.env.BACKUP_STATUS_FILE}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(report, null, 2), { mode: 0o600 });
  await rename(temporary, process.env.BACKUP_STATUS_FILE);
}
async function collectFiles(root, relative = '') {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Los adjuntos del respaldo no pueden ser enlaces simbólicos.');
    if (entry.isDirectory()) result.push(...await collectFiles(root, name));
    else if (entry.isFile()) result.push(name);
  }
  return result;
}
async function createBackup() {
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  if (!process.env.DATABASE_URL || !process.env.BACKUP_DIR || !process.env.BACKUP_STATUS_FILE) throw new Error('Configurá DATABASE_URL, BACKUP_DIR y BACKUP_STATUS_FILE.');
  const root = path.resolve(process.env.BACKUP_DIR), attachments = path.resolve(process.env.UPLOADS_DIR || uploadsDir);
  if (root === attachments || root.startsWith(attachments + path.sep)) throw new Error('El directorio de respaldos debe estar fuera de uploads.');
  const directory = path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const child = spawn(process.env.PG_DUMP_BIN || 'pg_dump', ['--format=custom', '--no-owner', '--no-acl'], { env: connectionEnv(process.env.DATABASE_URL), stdio: ['ignore', 'pipe', 'pipe'] });
  try { await Promise.all([childDone(child, 'pg_dump'), encryptStream(child.stdout, path.join(directory, 'database.enc'), key)]); }
  catch (error) { child.kill(); throw error; }
  const inventory = [];
  // No ignorar uploads ausente: podría esconder una pérdida de adjuntos.
  for (const relative of await collectFiles(attachments)) {
    const source = safeAttachmentPath(attachments, relative);
    const filename = `${randomUUID()}.enc`;
    const before = await stat(source), hash = await sha256File(source);
    await encryptFile(source, path.join(directory, filename), key);
    const after = await stat(source);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Un adjunto cambió durante el respaldo. Repetí la copia.');
    inventory.push({ relative, filename, size: before.size, sha256: hash });
  }
  await encryptStream(Readable.from([JSON.stringify(inventory)]), path.join(directory, 'inventory.enc'), key);
  const manifest = { version: 1, createdAt: new Date().toISOString(), files: [] };
  for (const filename of ['database.enc', 'inventory.enc', ...inventory.map(item => item.filename)]) manifest.files.push({ filename, sha256: await sha256File(path.join(directory, filename)) });
  await encryptStream(Readable.from([JSON.stringify(manifest)]), path.join(directory, 'manifest.enc'), key);
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
  await writeReport({ createdAt: manifest.createdAt, databaseRestoreVerified: false, attachmentsVerified: false });
  console.log(`Respaldo cifrado creado: ${directory}`);
}
async function restoreCheck(directory) {
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  if (!process.env.DATABASE_URL || !process.env.BACKUP_VERIFY_DATABASE_URL || !process.env.BACKUP_STATUS_FILE) throw new Error('Configurá la base de origen, la base aislada de verificación y BACKUP_STATUS_FILE.');
  const target = assertRestoreTarget(process.env.DATABASE_URL, process.env.BACKUP_VERIFY_DATABASE_URL);
  const env = connectionEnv(target.toString());
  const client = new pg.Client({ connectionString: target.toString(), ssl: env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: env.PGSSLMODE === 'verify-full' } });
  const restoreRoot = path.resolve(os.tmpdir());
  const temporary = await mkdtemp(path.join(restoreRoot, 'turnohub-restore-check-'));
  let connected = false;
  try {
    await decryptFile(path.join(directory, 'manifest.enc'), path.join(temporary, 'manifest.json'), key);
    const manifest = JSON.parse(await readFile(path.join(temporary, 'manifest.json'), 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.some(item => item.filename === 'database.enc') || !manifest.files.some(item => item.filename === 'inventory.enc')) throw new Error('Manifiesto inválido.');
    for (const item of manifest.files) if (await sha256File(safeAttachmentPath(directory, item.filename)) !== item.sha256) throw new Error('La integridad del respaldo no coincide.');
    await decryptFile(path.join(directory, 'inventory.enc'), path.join(temporary, 'inventory.json'), key);
    const inventory = JSON.parse(await readFile(path.join(temporary, 'inventory.json'), 'utf8'));
    const restoredUploads = path.join(temporary, 'uploads');
    await mkdir(restoredUploads);
    for (const item of inventory) {
      const destination = safeAttachmentPath(restoredUploads, item.relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await decryptFile(safeAttachmentPath(directory, item.filename), destination, key);
      if ((await stat(destination)).size !== item.size || await sha256File(destination) !== item.sha256) throw new Error('No se pudo restaurar un adjunto con integridad.');
    }
    const dump = path.join(temporary, 'database.dump');
    await decryptFile(path.join(directory, 'database.enc'), dump, key);
    await client.connect(); connected = true;
    const tables = (await client.query("SELECT count(*)::integer AS count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).rows[0].count;
    if (tables !== 0) throw new Error('La base de verificación debe estar vacía. No se sobrescriben bases existentes.');
    const child = spawn(process.env.PG_RESTORE_BIN || 'pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', `--dbname=${decodeURIComponent(target.pathname.slice(1))}`, dump], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    await childDone(child, 'pg_restore');
    const missing = await client.query("SELECT name FROM unnest(ARRAY['doctors','patients','appointments','patient_records']) AS expected(name) WHERE to_regclass('public.'||name) IS NULL");
    if (missing.rowCount) throw new Error('La restauración no contiene las tablas esperadas.');
    const records = await client.query('SELECT file_path FROM patient_records WHERE file_path IS NOT NULL');
    const basename = value => path.posix.basename(value.replace(/\\/g, '/'));
    const names = new Set(inventory.map(item => basename(item.relative)));
    if (records.rows.some(record => !names.has(basename(record.file_path)))) throw new Error('Hay registros clínicos sin su archivo en el respaldo.');
    await writeReport({ createdAt: manifest.createdAt, verifiedAt: new Date().toISOString(), databaseRestoreVerified: true, attachmentsVerified: true });
    console.log('Restauración de base y adjuntos verificada en el destino aislado. La base de prueba queda disponible para inspección.');
  } finally {
    if (connected) await client.end();
    // Solo se elimina el directorio temporal creado por mkdtemp en esta ejecución.
    if (path.dirname(temporary) !== restoreRoot || !path.basename(temporary).startsWith('turnohub-restore-check-')) throw new Error('Destino temporal fuera del directorio de verificación.');
    await rm(temporary, { recursive: true, force: true });
  }
}
try {
  if (process.argv[2] === 'create') await createBackup();
  else if (process.argv[2] === 'restore-check' && process.argv[3]) await restoreCheck(path.resolve(process.argv[3]));
  else throw new Error('Usá: node src/backup.js create | restore-check DIRECTORIO_DEL_RESPALDO');
} catch (error) {
  if (process.env.BACKUP_STATUS_FILE) {
    try {
      let previous = {};
      try { previous = JSON.parse(await readFile(process.env.BACKUP_STATUS_FILE, 'utf8')); } catch {}
      await writeReport({ ...previous, lastAttemptFailed: true, lastAttemptAt: new Date().toISOString() });
    } catch {}
  }
  console.error(error.message); process.exitCode = 1;
}
