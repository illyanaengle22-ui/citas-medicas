'use strict';

const path = require('path');
const fs = require('fs');

// Carga .env: busca primero junto al archivo (__dirname/.env), luego en la raíz de la rama (../.env) o cwd/.env
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

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
const horariosRoutes = require('./interfaces/http/routes/horarios.routes');
const citasRoutes = require('./interfaces/http/routes/citas.routes');
const recordatoriosRoutes = require('./interfaces/http/routes/recordatorios.routes');
const perfilRoutes = require('./interfaces/http/routes/perfil.routes');
const n8nWebhookRoutes = require('./interfaces/webhooks/n8nWebhook.routes');
const telegramRoutes = require('./interfaces/http/routes/telegram.routes');
const { iniciarRecordatorios } = require('./infrastructure/jobs/recordatorioScheduler');
const { iniciarCitasVencidasScheduler } = require('./infrastructure/jobs/citasVencidasScheduler');

const app = express();
app.use(cors());
app.use(express.json());

// Sirve el frontend estático solo si existe la carpeta (desarrollo local)
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Sirve imágenes de perfil/médicos subidas por multer.
// UPLOADS_DIR por env o process.cwd()/uploads con mkdir recursivo al arrancar.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
for (const sub of ['', 'perfiles', 'medicos']) {
  const dir = path.join(UPLOADS_DIR, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/auth', authRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Perfil compartido por todos los roles. Debe ir antes de /api/usuarios
// porque ese router exige rol admin para todas sus rutas.
app.use('/api/usuarios/perfil', perfilRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/medicos', medicosRoutes);
app.use('/api/consultorios', consultoriosRoutes);
app.use('/api/especialidades', especialidadesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/recordatorios', recordatoriosRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/webhooks/n8n', n8nWebhookRoutes);
app.use('/api/telegram', telegramRoutes);

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
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  iniciarRecordatorios();
  iniciarCitasVencidasScheduler();
});
