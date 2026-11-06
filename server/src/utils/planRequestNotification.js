const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function buildPlanRequestNotifications({ doctorName, doctorEmail, doctorPhone, planName, planPrice }, { adminEmail = process.env.ADMIN_EMAIL, frontendUrl = process.env.FRONTEND_URL, from } = {}) {
  const recipients = [...new Set([...(adminEmail || 'admin.turnohub@gmail.com').split(/[;,]/), 'agusalvarenga44@gmail.com'].map(email => email.trim().toLowerCase()).filter(Boolean))];
  const url = `${(frontendUrl || 'https://turnohub.com.ar').replace(/\/$/, '')}/admin/activation-requests`;
  const details = [
    ['Profesional', doctorName || 'No especificado'],
    ['Email', doctorEmail || 'No especificado'],
    ['Teléfono', doctorPhone || 'No especificado'],
    ['Plan', planName || 'No especificado'],
    ['Precio', planPrice ?? 'Consultar']
  ];
  const text = `Nueva solicitud de activación de plan\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nEstado: Pendiente de aprobación\nRevisar solicitud: ${url}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172554"><h1>Solicitud de activación de plan</h1><p>Un profesional solicitó la activación manual de su plan.</p>${details.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join('')}<p><strong>Estado:</strong> Pendiente de aprobación</p><p><a href="${escapeHtml(url)}">Revisar solicitudes de activación</a></p></div>`;
  return recipients.map(to => ({ from, to, subject: `Nueva solicitud de activación: ${String(doctorName || 'Profesional').replace(/[\r\n]/g, ' ')} (${String(planName || 'Plan').replace(/[\r\n]/g, ' ')})`, text, html }));
}
