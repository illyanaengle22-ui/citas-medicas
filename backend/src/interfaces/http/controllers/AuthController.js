'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../../infrastructure/db');
const { validarCaptcha } = require('./CaptchaController');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_pruebas';

async function registrar(req, res) {
  const { nombre, email, password, rol_id, captchaId, captchaTexto } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios (nombre, email, password)' });
  }

  const captchaValidacion = validarCaptcha(captchaId, captchaTexto);
  if (!captchaValidacion.valido) {
    return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
  }

  try {
    const existe = await db.query('SELECT id FROM usuarios WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
      [nombre, email, passwordHash, rol_id || 3, 1] // rol_id 3 = paciente, estado_id 1 = pendiente
    );

    return res.status(201).json({ ok: true, mensaje: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador.', data: result.rows[0] });
  } catch (error) {
    console.error('[Auth] Error en registro:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar en la base de datos', error: error.message });
  }
}

async function login(req, res) {
  const { email, password, captchaId, captchaTexto } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan email o contraseña' });
  }

  const captchaValidacion = validarCaptcha(captchaId, captchaTexto);
  if (!captchaValidacion.valido) {
    return res.status(400).json({ ok: false, mensaje: captchaValidacion.mensaje });
  }

  try {
    const result = await db.query(
      `SELECT id, uuid_publico, nombre, email, password_hash, rol_id, estado_id, ultimo_login
       FROM usuarios
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordValida = await bcrypt.compare(password, user.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
    }

    // RN-027: un usuario con cuenta no activa no puede obtener un token
    // RN-003: un usuario nuevo que se registra por sí mismo queda en estado pendiente
    if (user.estado_id !== 2) {
      const estadoResult = await db.query(
        `SELECT clave FROM estados_cuenta WHERE id = $1`,
        [user.estado_id]
      );
      const estadoClave = estadoResult.rows[0]?.clave || 'inactivo';
      return res.status(403).json({
        ok: false,
        mensaje: estadoClave === 'pendiente'
          ? 'Tu cuenta está pendiente de aprobación por un administrador.'
          : 'Tu cuenta ha sido rechazada o suspendida.'
      });
    }

    await db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

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
          id: user.id,
          uuid_publico: user.uuid_publico,
          nombre: user.nombre,
          email: user.email,
          rol_id: user.rol_id,
          estado_id: user.estado_id
        }
      }
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al conectar a la base de datos', error: error.message });
  }
}

module.exports = { registrar, login };
