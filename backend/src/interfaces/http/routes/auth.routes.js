'use strict';

const express = require('express');
const router = express.Router();
const { registrar, login } = require('../controllers/AuthController');

router.post('/registrar', registrar);
router.post('/login', login);

module.exports = router;