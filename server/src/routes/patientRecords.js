import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import * as patientRecordController from '../controllers/patientRecordController.js';

const router = express.Router();

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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
router.post('/:patientId', verifyToken, verifyDoctorRole, upload.single('file'), patientRecordController.createRecord);
router.delete('/:recordId', verifyToken, verifyDoctorRole, patientRecordController.deleteRecord);

export default router;
