'use strict';

const express = require('express');
const router = express.Router();
const { obtenerEstadisticas } = require('../controllers/DashboardController');

router.get('/stats', obtenerEstadisticas);

module.exports = router;