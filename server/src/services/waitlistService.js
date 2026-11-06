import { query, transaction } from '../db/config.js';
import { isAvailableAt } from './availabilityService.js';
import { enqueueEmail } from './emailOutbox.js';

export async function notifyWaitlistForSlot({ doctor_id: doctorId, appointment_date: date, appointment_time: time, service_id: serviceId }) {
  if (!doctorId || !date || !time || Date.parse(`${date}T${time}-03:00`) <= Date.now()) return 0;
  return transaction(async () => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`booking:${doctorId}`]);
    const entries = (await query(`SELECT w.id,w.service_id,p.email,d.name AS doctor_name,COALESCE(s.duration_minutes,30) AS duration_minutes
      FROM appointment_waitlist w JOIN patients p ON p.id=w.patient_id AND p.doctor_id=w.doctor_id
      JOIN doctors d ON d.id=w.doctor_id LEFT JOIN pricing_plans plan ON plan.id=d.pricing_plan_id
      LEFT JOIN services s ON s.id::text=w.service_id AND s.doctor_id=w.doctor_id
      WHERE w.doctor_id=$1 AND w.status='waiting' AND $2::date BETWEEN w.date_from AND w.date_to
      AND (w.service_id IS NULL OR w.service_id=$3::text) AND p.email IS NOT NULL AND p.is_active=true
      AND d.status='approved' AND d.subscription_status IN ('trial','active')
      AND COALESCE(plan.allow_patient_booking,true)=true
      AND (d.subscription_status<>'trial' OR d.trial_ends_at IS NULL OR d.trial_ends_at>now())
      AND (d.subscription_status<>'active' OR d.subscription_expires_at IS NULL OR d.subscription_expires_at>now())
      ORDER BY w.created_at LIMIT 20`, [doctorId, date, serviceId || null])).rows;
    let count = 0;
    for (const entry of entries) {
      if (!(await isAvailableAt(doctorId, date, time, entry.duration_minutes)).available) continue;
      const offer = await query(`INSERT INTO waitlist_offers(waitlist_id,appointment_date,appointment_time)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`, [entry.id, date, time]);
      if (!offer.rowCount) continue;
      const job = await enqueueEmail({ from: `"TurnoHub" <${process.env.SMTP_USER || 'turno-no-reply@turnohub.com.ar'}>`, to: entry.email,
        subject: 'Se liberó un horario que puede interesarte',
        text: `Se liberó un horario con ${entry.doctor_name}: ${date} a las ${time.slice(0, 5)} (hora de Argentina).\nEste aviso no reserva el turno. La disponibilidad se confirma al reservar.\nIngresá en ${(process.env.FRONTEND_URL || 'https://turnohub.com.ar').replace(/\/$/, '')}/reservar/${doctorId}`
      }, { doctorId, category: 'waitlist', ttlMinutes: Math.max(0.001, Math.min(1440, (Date.parse(`${date}T${time}-03:00`) - Date.now()) / 60000)) });
      await query('UPDATE waitlist_offers SET email_job_id=$2 WHERE id=$1', [offer.rows[0].id, job.id]);
      count++;
    }
    return count;
  });
}
