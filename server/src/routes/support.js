import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { createTicket, getMyTickets } from '../controllers/supportController.js';

const router = express.Router();

// Middleware opcional para extraer usuario si viene el token
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    return verifyToken(req, res, next);
  }
  next();
};

// Crear ticket de soporte
router.post('/tickets', optionalAuth, createTicket);

// Obtener mis tickets de soporte (requiere autenticación de profesional)
router.get('/tickets/my-tickets', verifyToken, getMyTickets);

export default router;
