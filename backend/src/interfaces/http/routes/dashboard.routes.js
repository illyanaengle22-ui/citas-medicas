'use strict';

const express = require('express');
const router = express.Router();
const { obtenerResumenAdmin } = require('../controllers/DashboardController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.get('/admin', authMiddleware, roleMiddleware('admin'), obtenerResumenAdmin);

module.exports = router;
