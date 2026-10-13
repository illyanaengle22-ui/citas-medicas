'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/UsuariosController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware, roleMiddleware(1));

router.get('/', ctrl.listar);
router.get('/pendientes', ctrl.listarPendientes);
router.get('/stats', ctrl.estadisticas);
router.post('/', ctrl.crear);
router.put('/:id/aprobar', ctrl.aprobar);
router.delete('/:id/negar', ctrl.rechazar);
router.put('/:id/rol', ctrl.asignarRol);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
