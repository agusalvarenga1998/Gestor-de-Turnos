import { query } from '../db/config.js';
import { sendSupportReportEmail } from '../services/emailService.js';

// Crear ticket de soporte (Profesional o visitante)
export async function createTicket(req, res) {
  try {
    const { subject, category = 'tech', priority = 'medium', description, name, email } = req.body;
    const doctorId = req.user ? req.user.id : null;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'El asunto y la descripción son obligatorios.'
      });
    }

    // 1. Guardar en base de datos
    const insertResult = await query(
      `INSERT INTO support_tickets (doctor_id, subject, category, priority, description, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [doctorId, subject, category, priority, description]
    );

    const newTicket = insertResult.rows[0];

    // 2. Obtener datos del doctor para el email
    let doctorName = name || 'Profesional / Usuario';
    let doctorEmail = email || '';
    let doctorPhone = '';
    let clinicName = '';

    if (doctorId) {
      const docResult = await query(
        `SELECT name, email, phone, clinic_name FROM doctors WHERE id = $1`,
        [doctorId]
      );
      if (docResult.rows.length > 0) {
        const doc = docResult.rows[0];
        doctorName = doc.name || doctorName;
        doctorEmail = doc.email || doctorEmail;
        doctorPhone = doc.phone || '';
        clinicName = doc.clinic_name || '';
      }
    }

    // 3. Enviar notificación por email al admin (admin.turnohub@gmail.com)
    sendSupportReportEmail({
      doctorName,
      doctorEmail,
      doctorPhone,
      clinicName,
      subject,
      category,
      priority,
      description,
      ticketId: newTicket.id
    }).catch(err => console.error('Error enviando mail de soporte en segundo plano:', err));

    return res.status(201).json({
      success: true,
      message: 'Tu reporte ha sido recibido correctamente. Nuestro equipo lo revisará en breve.',
      ticket: newTicket
    });
  } catch (error) {
    console.error('Error al crear ticket de soporte:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar el reporte de soporte.',
      error: error.message
    });
  }
}

// Obtener tickets del profesional autenticado
export async function getMyTickets(req, res) {
  try {
    const doctorId = req.user.id;
    const result = await query(
      `SELECT * FROM support_tickets WHERE doctor_id = $1 ORDER BY created_at DESC`,
      [doctorId]
    );

    return res.json({
      success: true,
      tickets: result.rows
    });
  } catch (error) {
    console.error('Error al obtener tickets del doctor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tus reportes de soporte.'
    });
  }
}

// ADMIN: Obtener todos los tickets de soporte
export async function getAllTicketsAdmin(req, res) {
  try {
    const result = await query(
      `SELECT st.*, 
              d.name as doctor_name, 
              d.email as doctor_email, 
              d.phone as doctor_phone, 
              d.clinic_name
       FROM support_tickets st
       LEFT JOIN doctors d ON st.doctor_id = d.id
       ORDER BY st.created_at DESC`
    );

    return res.json({
      success: true,
      tickets: result.rows
    });
  } catch (error) {
    console.error('Error al obtener tickets para admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los tickets de soporte.'
    });
  }
}

// ADMIN: Actualizar estado y notas de un ticket
export async function updateTicketStatusAdmin(req, res) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const result = await query(
      `UPDATE support_tickets
       SET status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, admin_notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado.'
      });
    }

    return res.json({
      success: true,
      message: 'Estado del ticket actualizado con éxito.',
      ticket: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el ticket.'
    });
  }
}
