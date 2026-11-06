import { randomUUID } from 'node:crypto';
import { query } from '../db/config.js';

// Appointment and plan-request notices use this queue. Short-lived access codes stay synchronous.
export async function enqueueEmail(payload, { ttlMinutes = 1440, doctorId = null, category = 'general', appointmentId = null } = {}) {
  const id = randomUUID();
  const messageId = `<${id}@notifications.turnohub.com.ar>`;
  const address = typeof payload.to === 'string' ? payload.to : '';
  const recipientHint = /^[^@]+@[^@]+$/.test(address) ? `${address[0]}***@${address.split('@')[1]}` : 'Destinatario reservado';
  await query(`INSERT INTO email_outbox(id,payload,expires_at,doctor_id,category,recipient_hint,appointment_id,appointment_context)
    VALUES($1,$2,now()+$3*interval '1 minute',$4,$5,$6,$7,
    (SELECT jsonb_build_object('date',appointment_date::text,'time',appointment_time::text,'status',status) FROM appointments WHERE id=$7))`, [id, { ...payload, messageId }, ttlMinutes, doctorId, category, recipientHint, appointmentId]);
  return { id, queued: true, sent: false, messageId };
}

export async function processEmailOutbox(sendMail, { jobId = null } = {}) {
  // El contenido se elimina al enviar o vencer; los fallidos conservan contenido solo hasta su TTL para reintento manual.
  await query(`UPDATE email_outbox SET status='expired',payload=NULL,finished_at=now(),lease_token=NULL,lease_until=NULL
    WHERE status IN ('pending','processing','failed') AND expires_at<=now() AND (lease_until IS NULL OR lease_until<=now())`);
  await query("DELETE FROM email_outbox WHERE finished_at < now()-interval '7 days'");
  const lease = randomUUID();
  const job = (await query(`UPDATE email_outbox SET status='processing',lease_token=$1,
    lease_until=now()+interval '2 minutes',attempts=attempts+1
    WHERE id=(SELECT id FROM email_outbox WHERE ($2::uuid IS NULL OR id=$2) AND expires_at>now() AND
      ((status='pending' AND available_at<=now()) OR (status='processing' AND lease_until<=now()))
      ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`, [lease, jobId])).rows[0];
  if (!job) return false;
  try {
    if (job.appointment_id && job.appointment_context) {
      const context = job.appointment_context;
      const current = await query('SELECT id FROM appointments WHERE id=$1 AND appointment_date=$2 AND appointment_time=$3 AND status=$4', [job.appointment_id, context.date, context.time, context.status]);
      if (!current.rowCount) {
        await query("UPDATE email_outbox SET status='expired',payload=NULL,finished_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2", [job.id, lease]);
        return true;
      }
    }
    await sendMail(job.payload);
    await query(`UPDATE email_outbox SET status='sent',payload=NULL,finished_at=now(),error_code=NULL,
      lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2`, [job.id, lease]);
  } catch (error) {
    const permanent = [550, 551, 553].includes(Number(error.responseCode));
    const exhausted = permanent || job.attempts >= 8;
    // Never persist SMTP responses, which can contain recipient addresses or message text.
    const code = /^[A-Z0-9_]{1,40}$/.test(error.code || '') ? error.code : 'DELIVERY_FAILED';
    await query(`UPDATE email_outbox SET status=$3,error_code=$4,lease_token=NULL,lease_until=NULL,
      available_at=now()+$5*interval '1 second',
      finished_at=CASE WHEN $6 THEN now() ELSE NULL END WHERE id=$1 AND lease_token=$2`,
    [job.id, lease, exhausted ? 'failed' : 'pending', code, Math.min(3600, 30 * 2 ** (job.attempts - 1)), exhausted]);
  }
  return true;
}

export function startEmailOutbox(sendMail) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 5; i++) if (!await processEmailOutbox(sendMail)) break;
    } catch (error) {
      console.error('No se pudo procesar la cola de correos:', error.code || 'DATABASE_ERROR');
    } finally { running = false; }
  };
  const timer = setInterval(tick, 5000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
