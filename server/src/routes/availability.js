import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

// Todas las rutas de disponibilidad requieren token de doctor y suscripción activa
router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

// Disponibilidades
router.post('/', availabilityController.createAvailability);
router.get('/', availabilityController.getAvailabilities);
router.patch('/:availabilityId', availabilityController.updateAvailability);
router.delete('/:availabilityId', availabilityController.deleteAvailability);

// Vacaciones
router.post('/vacations', availabilityController.addVacation);
router.get('/vacations', availabilityController.getVacations);
router.get('/vacations/active', availabilityController.getActiveVacations);
router.delete('/vacations/:vacationId', availabilityController.deleteVacation);

export default router;
