'use strict';

const express = require('express');
const router = express.Router();
const { obtenerEstadisticas, listarUsuarios, eliminarUsuario } = require('../controllers/DashboardController');

router.get('/stats', obtenerEstadisticas);
router.get('/usuarios', listarUsuarios);
router.delete('/usuarios/:id', eliminarUsuario);

module.exports = router;
