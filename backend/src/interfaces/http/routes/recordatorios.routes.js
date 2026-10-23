'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/RecordatoriosController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// RN-025: todas las rutas requieren token.
router.use(authMiddleware);

// Rutas literales antes de '/cita/:idCita'.
// RN-100/RN-101: dispara el envío por ventana (24h / 2h). Solo admin.
router.post('/enviar', roleMiddleware('admin'), ctrl.enviar);
// RN-103: el paciente responde confirmar / cancelar / reagendar.
router.post('/confirmar', ctrl.confirmar);
// RN-104: historial de recordatorios de una cita (dueño, médico o admin).
router.get('/cita/:idCita', ctrl.listarPorCita);

module.exports = router;
