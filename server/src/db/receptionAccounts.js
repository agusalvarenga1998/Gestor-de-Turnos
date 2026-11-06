import { transaction } from './config.js';

export async function migrateReceptionAccounts() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:migrations',0))");
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE version='005_reception_accounts'")).rowCount) return;
    await client.query(`CREATE TABLE reception_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      name text NOT NULL, email text NOT NULL, password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true, token_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX reception_accounts_email_unique ON reception_accounts(lower(email));
    CREATE INDEX reception_accounts_doctor ON reception_accounts(doctor_id);
    INSERT INTO schema_migrations(version) VALUES('005_reception_accounts');`);
  });
}
