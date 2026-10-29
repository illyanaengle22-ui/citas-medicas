'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/MedicosController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { singleMedico } = require('../middlewares/uploadMiddleware');

// RN-046: listar médicos permitido a cualquier usuario autenticado
router.get('/',    authMiddleware, ctrl.listar);
router.get('/:id', authMiddleware, ctrl.obtenerPorId);

// RN-046: crear, editar, asignar y eliminar solo admin
router.post('/',                        authMiddleware, roleMiddleware('admin'), singleMedico('foto'), ctrl.crear);
router.put('/:id',                      authMiddleware, roleMiddleware('admin'), singleMedico('foto'), ctrl.actualizar);
router.patch('/:id/estado',             authMiddleware, roleMiddleware('admin'), ctrl.cambiarEstado);
router.put('/:id/especialidades',       authMiddleware, roleMiddleware('admin'), ctrl.reemplazarEspecialidades);
router.put('/:id/consultorios',         authMiddleware, roleMiddleware('admin'), ctrl.reemplazarConsultorios);
router.delete('/:id',                   authMiddleware, roleMiddleware('admin'), ctrl.eliminar);

module.exports = router;
