'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/PerfilController');
const authMiddleware = require('../middlewares/authMiddleware');
const { single } = require('../middlewares/uploadMiddleware');

// Todos los endpoints requieren sesión válida (cualquier rol)
router.use(authMiddleware);

// GET  /api/usuarios/perfil  → datos del usuario autenticado
router.get('/', ctrl.obtenerPerfil);

// PUT  /api/usuarios/perfil  → actualiza nombre, email, password y/o foto
// upload single('foto') procesa el campo "foto" si viene como multipart
router.put('/', single('foto'), ctrl.actualizarPerfil);

module.exports = router;
