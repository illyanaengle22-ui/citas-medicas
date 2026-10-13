'use strict';

const express = require('express');
const router = express.Router();
const { generarCaptcha } = require('../controllers/CaptchaController');

router.get('/', generarCaptcha);

module.exports = router;
