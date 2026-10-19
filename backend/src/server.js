'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./interfaces/http/routes/auth.routes');
const captchaRoutes = require('./interfaces/http/routes/captcha.routes');
const dashboardRoutes = require('./interfaces/http/routes/dashboard.routes');
const usuariosRoutes = require('./interfaces/http/routes/usuarios.routes');
const pacientesRoutes = require('./interfaces/http/routes/pacientes.routes');
const medicosRoutes = require('./interfaces/http/routes/medicos.routes');
const consultoriosRoutes = require('./interfaces/http/routes/consultorios.routes');
const especialidadesRoutes = require('./interfaces/http/routes/especialidades.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Sirve el frontend de prueba (login-test.html) directo desde el backend
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/medicos', medicosRoutes);
app.use('/api/consultorios', consultoriosRoutes);
app.use('/api/especialidades', especialidadesRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, mensaje: 'Servidor activo' }));

// RN-120: middleware 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

// RN-120: manejador de errores global sin exponer stack
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`));