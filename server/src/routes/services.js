import express from 'express';
import { query } from '../db/config.js';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// --- Rutas Protegidas (Obtener mis servicios) ---
router.get('/doctor/me', verifyToken, verifyDoctorRole, checkSubscription, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const result = await query(
      'SELECT * FROM services WHERE doctor_id = $1 ORDER BY created_at DESC',
      [doctorId]
    );
    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error('Error fetching my services:', error);
    res.status(500).json({ error: 'Error al obtener tus servicios' });
  }
});

// --- Rutas Públicas (Sin Autenticación) ---

// Obtener todos los servicios de un profesional (público)
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Si por alguna razón llega "me" aquí (aunque ya debería haber sido capturado arriba),
    // evitamos el error de casteo de UUID en Postgres
    if (doctorId === 'me') {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const result = await query(
      'SELECT * FROM services WHERE doctor_id = $1 AND is_active = TRUE ORDER BY name ASC',
      [doctorId]
    );
    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// --- Middleware para el resto de rutas (Requieren suscripción activa) ---
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);


// Crear un nuevo servicio
router.post('/', async (req, res) => {
  try {
    const { name, description, price, duration_minutes, booking_fee, code } = req.body;
    const doctorId = req.user.id;

    if (!name || !duration_minutes) {
      return res.status(400).json({ error: 'Nombre y duración son requeridos' });
    }

    const result = await query(
      `INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee, code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [doctorId, name, description, price || 0, duration_minutes, booking_fee || 0, code || null]
    );

    res.status(201).json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

// Actualizar un servicio
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration_minutes, is_active, booking_fee, code } = req.body;
    const doctorId = req.user.id;

    const result = await query(
      `UPDATE services 
       SET name = $1, description = $2, price = $3, duration_minutes = $4, is_active = $5, booking_fee = $6, code = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND doctor_id = $9
       RETURNING *`,
      [name, description, price, duration_minutes, is_active, booking_fee, code || null, id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado o no tienes permiso' });
    }

    res.json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// Eliminar un servicio
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const result = await query(
      'DELETE FROM services WHERE id = $1 AND doctor_id = $2 RETURNING id',
      [id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    res.json({ success: true, message: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

// Importar servicios desde Excel
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const doctorId = req.user.id;
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    let importedCount = 0;
    let errors = [];

    for (const row of data) {
      try {
        // Mapeo de campos (flexibilidad con nombres de columnas)
        const name = row.nombre || row.name || row.Nombre || row.Name;
        const description = row.descripcion || row.description || row.Descripción || row.Description || '';
        const price = parseFloat(row.precio || row.price || row.Precio || row.Price || 0);
        const duration = parseInt(row.duracion || row.duration || row.Duración || row.Duration || 30);
        const bookingFee = parseFloat(row.seña || row.booking_fee || row.Seña || 0);
        const code = row.codigo || row.code || row.Código || row.Code || null;

        if (!name) {
          errors.push(`Fila con código ${code || 'sin código'} omitida: Falta nombre`);
          continue;
        }

        await query(
          `INSERT INTO services (doctor_id, name, description, price, duration_minutes, booking_fee, code)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [doctorId, name, description, price, duration, bookingFee, code]
        );
        importedCount++;
      } catch (err) {
        errors.push(`Error al importar fila ${row.name || row.nombre || ''}: ${err.message}`);
      }
    }

    res.json({ 
      success: true, 
      message: `Se importaron ${importedCount} servicios correctamente`,
      importedCount,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Error importing services:', error);
    res.status(500).json({ error: 'Error al procesar el archivo Excel' });
  }
});

export default router;
