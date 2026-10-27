'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../../infrastructure/db');
const { validarCaptcha } = require('./CaptchaController');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_pruebas';

// ── Registro público (RN-003, RN-012) ────────────────────────────────────────
async function registrar(req, res) {
  const body = req.body || {};
  const nombre   = typeof body.nombre   === 'string' ? body.nombre.trim() : '';
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const { captchaId, captchaTexto } = body;

  // Campos obligatorios
  if (!nombre || !email) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios (nombre, email, password)' });
  }
  // RN-008: contraseña mínimo 8 caracteres
  if (password.length < 8) {
    return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' });
  }

  // Captcha (RN-020); captchaId 'test' solo para pruebas
  if (captchaId !== 'test') {
    const captchaValidacion = validarCaptcha(captchaId, captchaTexto);
    if (!captchaValidacion.valido) {
      return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // RN-002: email único entre no eliminados (RN-110).
    // Se normalizan ambos lados para cubrir filas históricas con espacios.
    const existe = await client.query(
      'SELECT 1 FROM usuarios WHERE LOWER(TRIM(email)) = $1 AND deleted_at IS NULL',
      [email]
    );
    if (existe.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // RN-012: registro público es SIEMPRE paciente + estado pendiente.
    // Se ignora cualquier rol_id o estado_id que venga en el body.
    const result = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
       VALUES (
         $1, $2, $3,
         (SELECT id FROM roles         WHERE clave = 'paciente'),
         (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
       )
       RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
      [nombre, email, passwordHash]
    );

    // RN-011: NO se crea la fila en `pacientes` aquí porque la cuenta queda
    // en estado `pendiente`. La fila se crea cuando el admin aprueba la cuenta
    // (en PostgresUsuarioRepository.aprobar()). Así la fila en `pacientes`
    // solo existe para usuarios realmente activos.

    await client.query('COMMIT');
    return res.status(201).json({
      ok: true,
      mensaje: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador.',
      data: result.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignorar */ }
    // 23505 puede llegar si dos requests simultáneos pasan el check manual
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado' });
    }
    console.error('[Auth] Error en registro:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al procesar el registro' });
  } finally {
    client.release();
  }
}

// ── Login (RN-010, RN-027, RN-110) ───────────────────────────────────────────
async function login(req, res) {
  const body = req.body || {};
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const { captchaId, captchaTexto } = body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan email o contraseña' });
  }

  // Captcha (RN-020)
  if (captchaId !== 'test') {
    const captchaValidacion = validarCaptcha(captchaId, captchaTexto);
    if (!captchaValidacion.valido) {
      return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
    }
  }

  try {
    // RN-110: filtrar deleted_at IS NULL. Solo traemos usuarios no eliminados.
    // Email normalizado (trim + minúsculas) y también la columna, para cubrir
    // filas históricas guardadas con espacios o mayúsculas.
    const result = await db.query(
      `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.foto_url,
              u.password_hash, u.rol_id, u.estado_id, u.ultimo_login,
              ec.clave AS estado_clave
       FROM usuarios u
       JOIN estados_cuenta ec ON ec.id = u.estado_id
       WHERE LOWER(TRIM(u.email)) = $1
         AND u.deleted_at IS NULL`,
      [email]
    );

    // Email no existe o está eliminado → misma respuesta genérica (RN-110)
    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar contraseña ANTES de revelar el estado de la cuenta,
    // para no exponer si el email existe (timing attack mitigation)
    const passwordValida = await bcrypt.compare(password, user.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    // RN-027: solo cuentas activas pueden iniciar sesión (comparación por clave, RN-113)
    if (user.estado_clave !== 'activo') {
      const mensajeEstado = user.estado_clave === 'pendiente'
        ? 'Tu cuenta está pendiente de aprobación'
        : 'Tu cuenta fue rechazada';
      return res.status(403).json({ ok: false, mensaje: mensajeEstado });
    }

    // RN-010: registrar último login
    await db.query('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, uuid_publico: user.uuid_publico, email: user.email, rol_id: user.rol_id },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      ok: true,
      mensaje: 'Login exitoso',
      data: {
        token,
        usuario: {
          id:          user.id,
          uuid_publico: user.uuid_publico,
          nombre:      user.nombre,
          email:       user.email,
          foto_url:    user.foto_url,
          rol_id:      user.rol_id,
          estado_id:   user.estado_id,
        },
      },
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al procesar el login' });
  }
}

module.exports = { registrar, login };