import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.TEST_DB_NAME;
if (!/^turnohub_(test_|audit_)[a-z0-9_]+$/.test(database || '')) throw new Error('TEST_DB_NAME debe identificar una base de pruebas.');
process.env.DB_NAME = database;
process.env.DATABASE_URL = '';
const { default: pool, transaction } = await import('../src/db/config.js');
const { stabilizeSchema } = await import('../src/db/stabilize.js');

try {
  for (const [serviceType, queueType] of [['uuid', 'uuid'], ['integer', 'integer'], ['integer', 'uuid'], ['uuid', 'integer']]) {
    // Each case starts before migration 002 and exercises the complete migration chain.
    // A transaction isolates the temporary schema and rolls it back on failure.
    await transaction(async client => {
      const schema = 'migration_test_' + randomUUID().replaceAll('-', '');
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path TO ${schema}`);
      await client.query(`
        CREATE TABLE doctors(id uuid PRIMARY KEY);
        CREATE TABLE patients(id uuid PRIMARY KEY,doctor_id uuid,document_number text);
        CREATE TABLE services(id ${serviceType} PRIMARY KEY,duration_minutes integer,price numeric,booking_fee numeric);
        CREATE TABLE appointments(id uuid PRIMARY KEY,doctor_id uuid,appointment_date date,appointment_time time,duration_minutes integer,status text);
        CREATE TABLE waiting_queue(id integer PRIMARY KEY,doctor_id uuid,ticket_number integer,service_id ${queueType});
        CREATE TABLE movements(id integer PRIMARY KEY,amount numeric);
      `);
      if (serviceType === queueType) await client.query('ALTER TABLE waiting_queue ADD CONSTRAINT original_service_fk FOREIGN KEY(service_id) REFERENCES services(id)');
      const serviceId = serviceType === 'uuid' ? randomUUID() : 42;
      const originalQueueId = serviceType === queueType ? serviceId : queueType === 'uuid' ? randomUUID() : 73;
      await client.query('INSERT INTO services VALUES($1,30,100,10)', [serviceId]);
      await client.query('INSERT INTO waiting_queue(id,ticket_number,service_id) VALUES(1,1,$1)', [originalQueueId]);
      await stabilizeSchema();
      await stabilizeSchema();
      const type = (await client.query("SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='waiting_queue' AND column_name='service_id'")).rows[0].data_type;
      assert.equal(type, serviceType);
      const row = (await client.query('SELECT * FROM waiting_queue WHERE id=1')).rows[0];
      if (serviceType === queueType) {
        assert.equal(String(row.service_id), String(originalQueueId));
        assert.ok(!('legacy_service_id' in row), 'Compatible IDs must not be renamed');
      } else {
        assert.equal(String(row.legacy_service_id), String(originalQueueId));
        assert.equal(row.service_id, null);
      }
      await client.query('UPDATE waiting_queue SET service_id=$1 WHERE id=1', [serviceId]);
      assert.equal((await client.query('SELECT 1 FROM waiting_queue q JOIN services s ON q.service_id=s.id')).rowCount, 1);
      assert.equal((await client.query('SELECT * FROM schema_migrations')).rowCount, 3);
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      console.log(`PASS services ${serviceType} / waiting_queue ${queueType}: migración completa, datos preservados e idempotencia`);
    });
  }
} finally { await pool.end(); }
