'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./interfaces/http/routes/auth.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Sirve el frontend de prueba (login-test.html) directo desde el backend
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, mensaje: 'Servidor activo' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`));