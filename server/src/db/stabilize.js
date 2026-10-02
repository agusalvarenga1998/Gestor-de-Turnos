import { stabilizeLedger } from './stabilizeLedger.js';
import { migrateNotificationOutbox } from './notificationOutbox.js';
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import pool, { transaction } from './config.js';

async function stabilizeSellersModule(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS commission_type VARCHAR(50) DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await client.query(`
    ALTER TABLE doctors
    ADD COLUMN IF NOT EXISTS registered_by_seller_id UUID REFERENCES sellers(id),
    ADD COLUMN IF NOT EXISTS commercial_status VARCHAR(50) DEFAULT 'lead',
    ADD COLUMN IF NOT EXISTS seller_notes TEXT,
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS seller_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES sellers(id),
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seller_commissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES sellers(id),
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      amount DECIMAL(10,2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seller_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES sellers(id),
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      note TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureBasicTrialPlan(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price VARCHAR(50) NOT NULL,
      price_period VARCHAR(50),
      features TEXT[] DEFAULT '{}',
      is_popular BOOLEAN DEFAULT false,
      is_enabled BOOLEAN DEFAULT true,
      allow_google_calendar BOOLEAN DEFAULT true,
      allow_mercadopago BOOLEAN DEFAULT true,
      allow_telemedicine BOOLEAN DEFAULT true,
      allow_reminders BOOLEAN DEFAULT true,
      allow_insurance BOOLEAN DEFAULT true,
      allow_patient_booking BOOLEAN DEFAULT true,
      max_patients INTEGER,
      max_appointments_monthly INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    INSERT INTO pricing_plans (
      key, name, description, price, price_period, features,
      is_popular, is_enabled, allow_google_calendar, allow_mercadopago,
      allow_telemedicine, allow_reminders, allow_insurance, allow_patient_booking,
      max_patients, max_appointments_monthly
    ) VALUES (
      'basico', 'Plan Básico',
      'Herramientas esenciales para comenzar a gestionar tu consultorio.',
      '$9.999', 'mes fijo',
      ARRAY[
        'Agenda y gestión de turnos',
        'Historia clínica y pacientes',
        'Recordatorios por email',
        'Portal de reservas para pacientes',
        'Aplicación web y móvil instalable'
      ],
      false, true, false, false, false, true, true, true, 50, 200
    )
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      price_period = EXCLUDED.price_period,
      features = EXCLUDED.features,
      is_enabled = true,
      allow_google_calendar = EXCLUDED.allow_google_calendar,
      allow_mercadopago = EXCLUDED.allow_mercadopago,
      allow_telemedicine = EXCLUDED.allow_telemedicine,
      allow_reminders = EXCLUDED.allow_reminders,
      allow_insurance = EXCLUDED.allow_insurance,
      allow_patient_booking = EXCLUDED.allow_patient_booking,
      max_patients = EXCLUDED.max_patients,
      max_appointments_monthly = EXCLUDED.max_appointments_monthly
  `);
}

export async function stabilizeSchema() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:migrations',0))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    await ensureBasicTrialPlan(client);
    await stabilizeSellersModule(client);
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE version='002_stabilization'")).rowCount) return;
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS patients_doctor_document_unique ON patients(doctor_id, document_number) WHERE document_number IS NOT NULL;
      DROP INDEX IF EXISTS idx_patients_document_number;
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();
      CREATE UNIQUE INDEX IF NOT EXISTS appointments_portal_token_unique ON appointments(portal_token);
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_contact jsonb;
      ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS queue_day date;
      CREATE UNIQUE INDEX IF NOT EXISTS waiting_queue_daily_number ON waiting_queue(doctor_id,queue_day,ticket_number);
      CREATE TABLE IF NOT EXISTS patient_access_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE, code_hash text NOT NULL,
        expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, consumed_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS payment_receipts (
        payment_id text PRIMARY KEY, reference_id uuid NOT NULL, kind text NOT NULL,
        amount numeric(12,2) NOT NULL, currency text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    const columns = (await client.query(`SELECT table_name,data_type FROM information_schema.columns
      WHERE table_schema=current_schema() AND
      ((table_name='waiting_queue' AND column_name='service_id') OR (table_name='services' AND column_name='id'))`)).rows;
    const queueType = columns.find(column => column.table_name === 'waiting_queue')?.data_type;
    const serviceType = columns.find(column => column.table_name === 'services')?.data_type;
    if (!['uuid', 'smallint', 'integer', 'bigint'].includes(serviceType)) {
      throw new Error('Tipo de identificador de services no soportado: ' + serviceType);
    }
    if (queueType && queueType !== serviceType) {
      // Preserve incompatible historical IDs; matching UUID installations need no conversion.
      await client.query('ALTER TABLE waiting_queue RENAME COLUMN service_id TO legacy_service_id');
    }
    if (queueType !== serviceType) {
      await client.query(`ALTER TABLE waiting_queue ADD COLUMN service_id ${serviceType} REFERENCES services(id) ON DELETE SET NULL`);
    }
    await client.query(`
      ALTER TABLE services ADD CONSTRAINT services_valid_values CHECK (duration_minutes BETWEEN 5 AND 720 AND price >= 0 AND price <> 'NaN'::numeric AND booking_fee >= 0 AND booking_fee <> 'NaN'::numeric) NOT VALID;
      ALTER TABLE movements ADD CONSTRAINT movements_finite_amount CHECK (amount <> 'NaN'::numeric AND abs(amount) <= 99999999.99) NOT VALID;
      CREATE OR REPLACE FUNCTION prevent_appointment_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status NOT IN ('cancelled','rejected','absent','completed') THEN
          PERFORM pg_advisory_xact_lock(hashtextextended('booking:' || NEW.doctor_id::text,0));
          IF NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0 THEN RAISE EXCEPTION 'Duración inválida' USING ERRCODE='23514'; END IF;
          IF EXISTS (SELECT 1 FROM appointments a WHERE a.doctor_id=NEW.doctor_id AND a.appointment_date=NEW.appointment_date
            AND a.id<>NEW.id AND a.status NOT IN ('cancelled','rejected','absent','completed')
            AND NEW.appointment_time < a.appointment_time + make_interval(mins => a.duration_minutes)
            AND a.appointment_time < NEW.appointment_time + make_interval(mins => NEW.duration_minutes))
          THEN RAISE EXCEPTION 'El horario ya no está disponible' USING ERRCODE='23P01'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER appointments_no_overlap BEFORE INSERT OR UPDATE OF appointment_date,appointment_time,duration_minutes,status ON appointments FOR EACH ROW EXECUTE FUNCTION prevent_appointment_overlap();
      INSERT INTO schema_migrations(version) VALUES('002_stabilization');
    `);
  });
  await stabilizeLedger();
  await migrateNotificationOutbox();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  stabilizeSchema().then(() => console.log('Migraciones de estabilización aplicadas/verificadas.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
}
