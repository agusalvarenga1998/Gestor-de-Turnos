import express from 'express';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import * as insuranceController from '../controllers/insuranceController.js';

const router = express.Router();

// Ruta pública para pacientes
router.get('/public/doctor/:doctorId', insuranceController.getPublicInsurances);

// Todas las rutas siguientes requieren autenticación de doctor
router.use(verifyToken, verifyDoctorRole);

// Rutas para obras sociales del doctor
router.get('/', insuranceController.getInsurances);
router.post('/', insuranceController.createInsurance);
router.patch('/:id', insuranceController.updateInsurance);
router.delete('/:id', insuranceController.deleteInsurance);

// Rutas para obras sociales de un paciente
router.get('/patient/:patientId', insuranceController.getPatientInsurances);
router.put('/patient/:patientId', insuranceController.setPatientInsurances);

export default router;
