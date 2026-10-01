import { transaction } from './config.js';

export async function stabilizeLedger() {
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:migrations',0))");
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE version='003_payment_ledger'")).rowCount) return;
    await client.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS settlement_method text NOT NULL DEFAULT 'efectivo';
      CREATE OR REPLACE FUNCTION record_appointment_movements() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE deposit numeric; balance numeric;
      BEGIN
        IF TG_OP = 'INSERT' THEN deposit := COALESCE(NEW.booking_fee_paid,0);
        ELSE deposit := COALESCE(NEW.booking_fee_paid,0)-COALESCE(OLD.booking_fee_paid,0); END IF;
        IF deposit > 0 THEN
          INSERT INTO movements(doctor_id,appointment_id,amount,type,payment_method,description)
          VALUES(NEW.doctor_id,NEW.id,deposit,'seña','mercadopago','Seña recibida');
        END IF;
        IF TG_OP = 'UPDATE' THEN
          IF NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
            balance := COALESCE(NEW.total_price,0)-COALESCE(NEW.booking_fee_paid,0)-COALESCE(NEW.coverage_amount,0);
            IF balance > 0 THEN
              INSERT INTO movements(doctor_id,appointment_id,amount,type,payment_method,description)
              VALUES(NEW.doctor_id,NEW.id,balance,'cobro',NEW.settlement_method,'Saldo recibido en consultorio');
            END IF;
          END IF;
        END IF;
        -- Cancelar una cita no implica que se haya devuelto dinero.
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS trg_record_appointment_movements ON appointments;
      CREATE TRIGGER trg_record_appointment_movements AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION record_appointment_movements();
      INSERT INTO schema_migrations(version) VALUES('003_payment_ledger');
    `);
  });
}
