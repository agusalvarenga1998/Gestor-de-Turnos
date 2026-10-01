import { query } from '../db/config.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as patientRecordController from '../controllers/patientRecordController.js';
import { uploadsDir } from '../utils/paths.js';

const router = express.Router();

router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

router.get('/file/:recordId', async (req, res) => {
  try {
    const record = (await query('SELECT file_path,file_type FROM patient_records WHERE id::text=$1 AND doctor_id=$2', [req.params.recordId, req.user.id])).rows[0];
    if (!record?.file_path) return res.status(404).json({ message: 'Archivo no encontrado.' });
    const filename = path.basename(record.file_path);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filename, { root: uploadsDir, dotfiles: 'deny' }, error => {
      if (error && !res.headersSent) res.status(404).json({ message: 'Archivo no disponible.' });
    });
  } catch { res.status(500).json({ message: 'No pudimos abrir el archivo.' }); }
});

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Formato de archivo no permitido'));
  }
});

// Rutas protegidas
router.get('/:patientId', verifyToken, verifyDoctorRole, patientRecordController.getRecords);
router.post('/:patientId', verifyToken, verifyDoctorRole, async (req, res, next) => {
  try {
    if (!(await query('SELECT id FROM patients WHERE id::text=$1 AND doctor_id=$2', [req.params.patientId, req.user.id])).rowCount) return res.status(404).json({ message: 'Paciente no encontrado.' });
    next();
  } catch { res.status(500).json({ message: 'No pudimos verificar el paciente.' }); }
}, upload.single('file'), patientRecordController.createRecord);
router.delete('/:recordId', verifyToken, verifyDoctorRole, patientRecordController.deleteRecord);

export default router;
