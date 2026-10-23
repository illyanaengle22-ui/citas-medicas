'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/HorariosController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// RN-025: todas las rutas requieren token.
router.use(authMiddleware);

// Rutas literales antes de '/:id' para que Express no las capture como id.
// Cualquier rol autenticado puede consultar bloques y huecos (flujo de agendamiento).
router.get('/medico/:idMedico', ctrl.listarPorMedico);
// Gestión de horarios: admin o el propio médico (matriz de permisos).
router.get('/', roleMiddleware('admin', 'medico'), ctrl.listar);
router.get('/:id', roleMiddleware('admin', 'medico'), ctrl.obtenerPorId);
router.post('/', roleMiddleware('admin', 'medico'), ctrl.crear);
router.put('/:id', roleMiddleware('admin', 'medico'), ctrl.actualizar);
router.patch('/:id/estado', roleMiddleware('admin', 'medico'), ctrl.cambiarEstado);
router.delete('/:id', roleMiddleware('admin', 'medico'), ctrl.eliminar);

module.exports = router;
