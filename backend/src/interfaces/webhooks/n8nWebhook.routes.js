'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./n8nWebhookController');

// RN-107: n8n llama a estos endpoints con x-webhook-secret (no con JWT de usuario).
router.post('/respuesta', ctrl.recibirRespuesta);
router.get('/health', ctrl.salud);

module.exports = router;
