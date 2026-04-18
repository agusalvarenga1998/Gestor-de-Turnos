import express from 'express';
import { verifyToken, verifyDoctorRole } from '../middleware/auth.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

// Disponibilidades
router.post('/', verifyToken, verifyDoctorRole, availabilityController.createAvailability);
router.get('/', verifyToken, verifyDoctorRole, availabilityController.getAvailabilities);
router.patch('/:availabilityId', verifyToken, verifyDoctorRole, availabilityController.updateAvailability);
router.delete('/:availabilityId', verifyToken, verifyDoctorRole, availabilityController.deleteAvailability);

// Vacaciones
router.post('/vacations', verifyToken, verifyDoctorRole, availabilityController.addVacation);
router.get('/vacations', verifyToken, verifyDoctorRole, availabilityController.getVacations);
router.get('/vacations/active', verifyToken, verifyDoctorRole, availabilityController.getActiveVacations);
router.delete('/vacations/:vacationId', verifyToken, verifyDoctorRole, availabilityController.deleteVacation);

export default router;
