'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/TelegramController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { secretValido } = require('../utils/webhookSecret');

// Webapp: el paciente (autenticado con JWT) pide su código de vinculación.
router.post('/codigo', authMiddleware, roleMiddleware('paciente'), ctrl.generarCodigo);
router.get('/estado', authMiddleware, roleMiddleware('paciente'), ctrl.estado);

// n8n/Telegram: autenticación por secreto compartido (RN-107), sin JWT de usuario.
function exigirSecret(req, res, next) {
  if (!secretValido(req)) {
    return res.status(401).json({ ok: false, mensaje: 'Secreto de webhook inválido' });
  }
  next();
}

router.post('/vincular', exigirSecret, ctrl.vincular);
router.post('/token', exigirSecret, ctrl.tokenPorChat);

module.exports = router;
