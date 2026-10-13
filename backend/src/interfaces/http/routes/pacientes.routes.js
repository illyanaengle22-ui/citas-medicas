'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/PacientesController');

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
