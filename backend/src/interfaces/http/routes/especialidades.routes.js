'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/EspecialidadesController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// RN-034: listar permitido a cualquier usuario autenticado
router.get('/', authMiddleware, ctrl.listar);
router.get('/:id', authMiddleware, ctrl.obtenerPorId);

// RN-034: crear, editar o cambiar estado es solo de administradores
router.post('/', authMiddleware, roleMiddleware('admin'), ctrl.crear);
router.put('/:id', authMiddleware, roleMiddleware('admin'), ctrl.actualizar);
router.patch('/:id/estado', authMiddleware, roleMiddleware('admin'), ctrl.cambiarEstado);

module.exports = router;
