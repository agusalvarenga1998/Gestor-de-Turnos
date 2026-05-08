import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as patientController from '../controllers/patientController.js';

const router = express.Router();

// Todas las rutas de pacientes requieren suscripción activa
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

// Rutas protegidas para doctores

export default router;
