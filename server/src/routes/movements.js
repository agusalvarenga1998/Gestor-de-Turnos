import express from 'express';
import { query } from '../db/config.js';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import { logAction } from '../services/auditService.js';

const router = express.Router();

// Middleware de seguridad
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

// 1. Obtener listado de movimientos
router.get('/', async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { startDate, endDate, type, paymentMethod } = req.query;

    let queryText = `
      SELECT m.*, a.appointment_date, a.appointment_time, p.name as patient_name
      FROM movements m
      LEFT JOIN appointments a ON m.appointment_id = a.id
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE m.doctor_id = $1
    `;
    const params = [doctorId];
    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND m.created_at >= $${paramIndex}::date`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND m.created_at <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(endDate);
      paramIndex++;
    }

    if (type && type !== 'all') {
      queryText += ` AND m.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      queryText += ` AND m.payment_method = $${paramIndex}`;
      params.push(paymentMethod);
      paramIndex++;
    }

    queryText += ` ORDER BY m.created_at DESC`;

    const result = await query(queryText, params);

    res.json({
      success: true,
      movements: result.rows
    });
  } catch (error) {
    console.error('Error al listar movimientos:', error);
    res.status(500).json({ success: false, message: 'Error al listar movimientos de caja' });
  }
});

// 2. Registrar movimiento manual (ingreso, egreso/gasto, seña, reembolso)
router.post('/', async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { amount, type, paymentMethod, description, appointmentId } = req.body;

    if (!amount || !type || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Monto, tipo y método de pago son requeridos'
      });
    }

    // Si es un egreso o reembolso, nos aseguramos que el monto sea guardado como negativo
    let finalAmount = parseFloat(amount);
    if ((type === 'gasto' || type === 'reembolso') && finalAmount > 0) {
      finalAmount = -finalAmount;
    }

    const result = await query(
      `INSERT INTO movements (doctor_id, appointment_id, amount, type, payment_method, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [doctorId, appointmentId || null, finalAmount, type, paymentMethod, description || '']
    );

    const movement = result.rows[0];

    // Log de auditoría
    await logAction(doctorId, 'create_movement', `Movimiento manual registrado: ${type} de $${finalAmount}`, req.ip);

    res.status(201).json({
      success: true,
      message: 'Movimiento registrado exitosamente',
      movement
    });
  } catch (error) {
    console.error('Error al registrar movimiento manual:', error);
    res.status(500).json({ success: false, message: 'Error al registrar movimiento manual' });
  }
});

// 3. Obtener resumen financiero (cobrado hoy, pendiente total, turnos deudores)
router.get('/summary', async (req, res) => {
  try {
    const doctorId = req.user.id;

    // A. Cobrado hoy (hoy en horario local Argentina / UTC-3)
    const todayIncomeRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN amount ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_method = 'transferencia' THEN amount ELSE 0 END), 0) as transfer,
        COALESCE(SUM(CASE WHEN payment_method = 'mercadopago' THEN amount ELSE 0 END), 0) as mercadopago,
        COALESCE(SUM(amount), 0) as total
       FROM movements 
       WHERE doctor_id = $1 
         AND created_at::date = CURRENT_DATE 
         AND type IN ('cobro', 'seña')`,
      [doctorId]
    );

    // B. Total pendiente de cobro (citas agendadas/programadas que tienen saldo por cobrar)
    const pendingCollectionRes = await query(
      `SELECT COALESCE(SUM(total_price - booking_fee_paid - coverage_amount), 0) as total 
       FROM appointments 
       WHERE doctor_id = $1 
         AND status != 'cancelled' 
         AND status != 'rejected'
         AND payment_status != 'paid' 
         AND (total_price - booking_fee_paid - coverage_amount) > 0`,
      [doctorId]
    );

    // C. Citas con deuda activa (turnos pasados o agendados sin pagar con saldo deudor)
    const indebtedAppointmentsRes = await query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.total_price, a.booking_fee_paid, a.coverage_amount,
              p.name as patient_name, p.phone as patient_phone,
              s.name as service_name,
              (a.total_price - a.booking_fee_paid - a.coverage_amount) as debt
       FROM appointments a 
       JOIN patients p ON a.patient_id = p.id 
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.doctor_id = $1 
         AND a.status != 'cancelled' 
         AND a.status != 'rejected'
         AND a.payment_status != 'paid' 
         AND (a.total_price - a.booking_fee_paid - a.coverage_amount) > 0
       ORDER BY a.appointment_date DESC`,
      [doctorId]
    );

    res.json({
      success: true,
      summary: {
        todayCollected: todayIncomeRes.rows[0],
        totalPending: parseFloat(pendingCollectionRes.rows[0]?.total || 0),
        indebtedAppointments: indebtedAppointmentsRes.rows.map(row => ({
          ...row,
          total_price: parseFloat(row.total_price),
          booking_fee_paid: parseFloat(row.booking_fee_paid),
          coverage_amount: parseFloat(row.coverage_amount),
          debt: parseFloat(row.debt)
        }))
      }
    });
  } catch (error) {
    console.error('Error al calcular resumen financiero:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de caja' });
  }
});

// 4. Cierre de caja diario (Arqueo)
router.post('/daily-close', async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Calcular totales de hoy
    const todaySummaryRes = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'efectivo' THEN amount ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_method = 'transferencia' THEN amount ELSE 0 END), 0) as transfer,
        COALESCE(SUM(CASE WHEN payment_method = 'mercadopago' THEN amount ELSE 0 END), 0) as mercadopago,
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as transactions_count
       FROM movements 
       WHERE doctor_id = $1 
         AND created_at::date = CURRENT_DATE`,
      [doctorId]
    );

    const closeSummary = todaySummaryRes.rows[0];

    // Log de auditoría
    await logAction(doctorId, 'daily_close', {
      summary: closeSummary,
      closed_at: new Date().toISOString()
    }, req.ip);

    res.json({
      success: true,
      message: 'Cierre diario de caja registrado exitosamente en la auditoría.',
      closeSummary
    });
  } catch (error) {
    console.error('Error al realizar cierre diario:', error);
    res.status(500).json({ success: false, message: 'Error al cerrar caja' });
  }
});

// 5. Exportar transacciones a CSV (Excel)
router.get('/export', async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { startDate, endDate } = req.query;

    let queryText = `
      SELECT m.created_at as fecha, m.type as tipo, m.payment_method as metodo_pago, m.amount as monto, 
             m.description as descripcion, p.name as cliente, a.appointment_date as fecha_turno
      FROM movements m
      LEFT JOIN appointments a ON m.appointment_id = a.id
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE m.doctor_id = $1
    `;
    const params = [doctorId];
    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND m.created_at >= $${paramIndex}::date`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND m.created_at <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY m.created_at DESC`;

    const result = await query(queryText, params);

    // Formatear CSV
    let csvContent = '\uFEFF'; // BOM para soportar tildes en Excel
    csvContent += 'Fecha;Tipo;Metodo Pago;Monto;Descripcion;Cliente;Fecha Turno\n';

    result.rows.forEach(row => {
      const dateFormatted = new Date(row.fecha).toLocaleString('es-ES');
      const tourDateFormatted = row.fecha_turno ? new Date(row.fecha_turno).toLocaleDateString('es-ES') : '';
      csvContent += `"${dateFormatted}";"${row.tipo}";"${row.metodo_pago}";${row.monto};"${row.descripcion || ''}";"${row.cliente || ''}";"${tourDateFormatted}"\n`;
    });

    await logAction(doctorId, 'export_movements_csv', 'Exportación de movimientos de caja a CSV', req.ip);

    res.setHeader('Content-disposition', `attachment; filename=movimientos_caja_${doctorId}.csv`);
    res.setHeader('Content-type', 'text/csv; charset=utf-8');
    res.send(csvContent);
  } catch (error) {
    console.error('Error al exportar movimientos:', error);
    res.status(500).json({ success: false, message: 'Error al exportar movimientos' });
  }
});

export default router;
