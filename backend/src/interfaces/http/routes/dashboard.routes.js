'use strict';

const express = require('express');
const router = express.Router();
const { obtenerResumenAdmin, obtenerResumenMedico, obtenerResumenPaciente } = require('../controllers/DashboardController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.get('/admin', authMiddleware, roleMiddleware('admin'), obtenerResumenAdmin);
router.get('/medico', authMiddleware, roleMiddleware('medico'), obtenerResumenMedico);
router.get('/paciente', authMiddleware, roleMiddleware('paciente'), obtenerResumenPaciente);

module.exports = router;
