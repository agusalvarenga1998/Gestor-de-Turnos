import express from 'express';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import * as patientController from '../controllers/patientController.js';

const router = express.Router();

// Rutas protegidas para doctores
router.post('/', verifyToken, verifyDoctorRole, patientController.createPatient);
router.get('/', verifyToken, verifyDoctorRole, patientController.getPatients);
router.get('/search', verifyToken, verifyDoctorRole, patientController.searchPatients);
router.get('/inactive', verifyToken, verifyDoctorRole, patientController.getInactivePatients);
router.get('/:patientId', verifyToken, verifyDoctorRole, patientController.getPatient);
router.patch('/:patientId', verifyToken, verifyDoctorRole, patientController.updatePatient);
router.delete('/:patientId', verifyToken, verifyDoctorRole, patientController.deletePatient);

export default router;
