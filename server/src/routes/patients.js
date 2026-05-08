import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as patientController from '../controllers/patientController.js';

const router = express.Router();

// Todas las rutas de pacientes requieren token de doctor y suscripción activa
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

// Rutas de pacientes
router.post('/', patientController.createPatient);
router.get('/', patientController.getPatients);
router.get('/search', patientController.searchPatients);
router.get('/inactive', patientController.getInactivePatients);
router.get('/:patientId', patientController.getPatient);
router.patch('/:patientId', patientController.updatePatient);
router.delete('/:patientId', patientController.deletePatient);

export default router;
