import express from 'express';
import { verifyToken, verifyDoctorRole, checkSubscription } from '../middleware/auth.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

router.use(verifyToken);
router.use(verifyDoctorRole);
router.use(checkSubscription);

// Disponibilidades
router.post('/', availabilityController.createAvailability);
router.get('/', availabilityController.getAvailabilities);
router.patch('/:availabilityId', availabilityController.updateAvailability);
router.delete('/:availabilityId', availabilityController.deleteAvailability);

// Vacaciones
router.get('/vacations', verifyToken, verifyDoctorRole, availabilityController.getVacations);
router.get('/vacations/active', verifyToken, verifyDoctorRole, availabilityController.getActiveVacations);
router.delete('/vacations/:vacationId', verifyToken, verifyDoctorRole, availabilityController.deleteVacation);

export default router;
