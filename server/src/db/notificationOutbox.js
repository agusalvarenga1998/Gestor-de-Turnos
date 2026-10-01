import { transaction } from './config.js';

export async function migrateNotificationOutbox() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:migrations',0))");
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE version='004_email_outbox'")).rowCount) return;
    await client.query(`
      CREATE TABLE email_outbox (
        id uuid PRIMARY KEY, payload jsonb, status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','processing','sent','failed','expired')),
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
        lease_token uuid, lease_until timestamptz, expires_at timestamptz NOT NULL,
        error_code text, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
      );
      CREATE INDEX email_outbox_pending ON email_outbox(available_at) WHERE status IN ('pending','processing');
      INSERT INTO schema_migrations(version) VALUES('004_email_outbox');
    `);
  });
}
