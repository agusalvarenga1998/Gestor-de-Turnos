import { transaction } from './config.js';

export async function migrateOperations() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:migrations',0))");
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE version='006_operations'")).rowCount) return;
    await client.query(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_appointment_date_appointment_time_key;
    ALTER TABLE email_outbox
      ADD COLUMN doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
      ADD COLUMN category text NOT NULL DEFAULT 'general',
      ADD COLUMN recipient_hint text,
      ADD COLUMN appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
      ADD COLUMN appointment_context jsonb,
      ADD COLUMN manual_retries integer NOT NULL DEFAULT 0;
    CREATE INDEX email_outbox_doctor ON email_outbox(doctor_id,created_at);
    CREATE TABLE appointment_waitlist (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      service_id text, date_from date NOT NULL, date_to date NOT NULL,
      consent_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','booked','cancelled')),
      created_at timestamptz NOT NULL DEFAULT now(), CHECK(date_to>=date_from)
    );
    CREATE UNIQUE INDEX appointment_waitlist_active ON appointment_waitlist(doctor_id,patient_id,COALESCE(service_id,'')) WHERE status='waiting';
    CREATE TABLE waitlist_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), waitlist_id uuid NOT NULL REFERENCES appointment_waitlist(id) ON DELETE CASCADE,
      appointment_date date NOT NULL, appointment_time time NOT NULL, email_job_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(waitlist_id,appointment_date,appointment_time)
    );
    CREATE TABLE payment_checks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
      subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
      payment_id text NOT NULL, provider_status text NOT NULL, refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
      outcome text NOT NULL, checked_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((appointment_id IS NOT NULL)::integer+(subscription_id IS NOT NULL)::integer=1)
    );
    CREATE INDEX payment_checks_appointment ON payment_checks(appointment_id,checked_at);
    CREATE INDEX payment_checks_subscription ON payment_checks(subscription_id,checked_at);
    INSERT INTO schema_migrations(version) VALUES('006_operations');`);
  });
}
