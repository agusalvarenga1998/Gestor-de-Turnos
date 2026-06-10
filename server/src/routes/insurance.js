import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as insuranceController from '../controllers/insuranceController.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Ruta pública para pacientes
router.get('/public/doctor/:doctorId', insuranceController.getPublicInsurances);

// Todas las rutas siguientes requieren autenticación de doctor y suscripción activa
router.use(verifyToken, verifyDoctorRole, checkSubscription);

// Rutas de Exportación/Importación
router.get('/export', insuranceController.exportInsuranceCoverages);
router.post('/import', upload.single('file'), insuranceController.importInsuranceCoverages);

// Rutas para obras sociales del doctor
router.get('/', insuranceController.getInsurances);
router.post('/', insuranceController.createInsurance);
router.patch('/:id', insuranceController.updateInsurance);
router.delete('/:id', insuranceController.deleteInsurance);

// Rutas para obras sociales de un paciente
router.get('/patient/:patientId', insuranceController.getPatientInsurances);
router.put('/patient/:patientId', insuranceController.setPatientInsurances);

// Rutas para coberturas por servicio
router.get('/:id/coverages', insuranceController.getServiceCoverages);
router.post('/:id/coverages', insuranceController.setServiceCoverage);

// Rutas para planes de obras sociales
router.get('/:id/plans', insuranceController.getPlans);
router.post('/:id/plans', insuranceController.createPlan);
router.patch('/plans/:planId', insuranceController.updatePlan);
router.delete('/plans/:planId', insuranceController.deletePlan);

export default router;
