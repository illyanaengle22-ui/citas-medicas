'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../../infrastructure/db');
const { secretValido } = require('../utils/webhookSecret');
const { pacienteIdDeUsuario } = require('../utils/identidad');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_pruebas';

// RN-116: el código de vinculación vive 10 minutos y sirve una sola vez.
const TTL_CODIGO_MS = 10 * 60 * 1000;
// Sin caracteres ambiguos (0/O, 1/I) para que se lea bien al escribirlo en Telegram.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RE_CHAT_ID = /^-?\d{1,30}$/;

// Códigos en memoria, mismo patrón que CaptchaController: son de corta vida,
// por eso no requieren tabla ni migración (RN-114 no aplica).
const codigos = new Map(); // código → { pacienteId, expiraEn }

setInterval(() => {
  const ahora = Date.now();
  for (const [codigo, data] of codigos.entries()) {
    if (data.expiraEn < ahora) codigos.delete(codigo);
  }
}, 60 * 1000).unref();

function esErrorDeDatos(error) {
  return error?.code === '22003' || error?.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'Dato inválido' });
  }
  console.error('[Telegram]', mensaje, error.message);
  return res.status(500).json({ ok: false, mensaje });
}

function crearCodigo() {
  const bytes = crypto.randomBytes(6);
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
  return codigo;
}

function normalizarChatId(valor) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return RE_CHAT_ID.test(limpio) ? limpio : null;
}

// Mismos claims que el login normal (authMiddleware espera esta forma).
function firmarJWT(usuario) {
  return jwt.sign(
    { id: usuario.id, uuid_publico: usuario.uuid_publico, email: usuario.email, rol_id: usuario.rol_id },
    JWT_SECRET,
    { expiresIn: process.env.TELEGRAM_JWT_EXPIRA || '24h' }
  );
}

// POST /api/telegram/codigo — la webapp le da al paciente su código (RN-116).
async function generarCodigo(req, res) {
  try {
    const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
    if (!pacienteId) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los pacientes pueden vincular Telegram' });
    }

    // Un solo código activo por paciente: el anterior deja de servir.
    for (const [codigo, data] of codigos.entries()) {
      if (Number(data.pacienteId) === Number(pacienteId)) codigos.delete(codigo);
    }

    const codigo = crearCodigo();
    const expiraEn = Date.now() + TTL_CODIGO_MS;
    codigos.set(codigo, { pacienteId, expiraEn });

    return res.json({
      ok: true,
      mensaje: 'Código generado',
      data: {
        codigo,
        comando: `/start ${codigo}`,
        expiraEn: new Date(expiraEn).toISOString(),
      },
    });
  } catch (error) {
    return respuestaError500(res, 'Error al generar el código', error);
  }
}

// GET /api/telegram/estado — ¿ya está vinculado mi cuenta?
async function estado(req, res) {
  try {
    const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
    if (!pacienteId) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los pacientes tienen estado de vinculación' });
    }

    const result = await db.query(
      'SELECT telegram_chat_id FROM pacientes WHERE id = $1 AND deleted_at IS NULL',
      [pacienteId]
    );
    const chatId = result.rows[0]?.telegram_chat_id ?? null;
    return res.json({ ok: true, mensaje: 'Estado de vinculación', data: { vinculado: Boolean(chatId), chatId } });
  } catch (error) {
    return respuestaError500(res, 'Error al consultar la vinculación', error);
  }
}

// POST /api/telegram/vincular — n8n recibe "/start <código>" y lo canjea (RN-116).
//   body: { chatId, codigo }
async function vincular(req, res) {
  if (!secretValido(req)) {
    return res.status(401).json({ ok: false, mensaje: 'Secreto de webhook inválido' });
  }

  try {
    const chatId = normalizarChatId(req.body?.chatId);
    if (!chatId) {
      return res.status(400).json({ ok: false, mensaje: 'chatId inválido' });
    }

    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim().toUpperCase() : '';
    if (!codigo) {
      return res.status(400).json({ ok: false, mensaje: 'codigo es requerido' });
    }

    const registro = codigos.get(codigo);
    if (!registro) {
      return res.status(400).json({ ok: false, mensaje: 'Código inválido o expirado; genera uno nuevo en la webapp' });
    }
    if (registro.expiraEn < Date.now()) {
      codigos.delete(codigo);
      return res.status(400).json({ ok: false, mensaje: 'Código expirado; genera uno nuevo en la webapp' });
    }

    try {
      await db.query(
        'UPDATE pacientes SET telegram_chat_id = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL',
        [chatId, registro.pacienteId]
      );
    } catch (error) {
      // RN-051: un chat no puede estar ligado a dos pacientes.
      if (error.code === '23505') {
        return res.status(409).json({ ok: false, mensaje: 'Este chat de Telegram ya está vinculado a otra cuenta [RN-051]' });
      }
      throw error;
    }

    codigos.delete(codigo);

    const usuario = await db.query(
      `SELECT u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
       FROM usuarios u
       JOIN pacientes p ON p.usuario_id = u.id
       WHERE p.id = $1 AND u.deleted_at IS NULL`,
      [registro.pacienteId]
    );
    if (usuario.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }

    const fila = usuario.rows[0];
    return res.json({
      ok: true,
      mensaje: 'Cuenta vinculada correctamente',
      data: { token: firmarJWT(fila), chatId, nombre: fila.nombre },
    });
  } catch (error) {
    return respuestaError500(res, 'Error al vincular la cuenta', error);
  }
}

// POST /api/telegram/token — n8n canjea el chatId por un JWT fresco antes de
// cada conversación; así las tools del agente llaman a la API como el paciente.
async function tokenPorChat(req, res) {
  if (!secretValido(req)) {
    return res.status(401).json({ ok: false, mensaje: 'Secreto de webhook inválido' });
  }

  try {
    const chatId = normalizarChatId(req.body?.chatId);
    if (!chatId) {
      return res.status(400).json({ ok: false, mensaje: 'chatId inválido' });
    }

    const result = await db.query(
      `SELECT p.id AS paciente_id, u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.telegram_chat_id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND u.estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')`,
      [chatId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Este chat no está vinculado a una cuenta. Escribe /start con tu código para vincularlo.',
      });
    }

    const fila = result.rows[0];
    return res.json({
      ok: true,
      mensaje: 'Token generado',
      data: { token: firmarJWT(fila), pacienteId: String(fila.paciente_id), nombre: fila.nombre },
    });
  } catch (error) {
    return respuestaError500(res, 'Error al generar el token', error);
  }
}

module.exports = { generarCodigo, estado, vincular, tokenPorChat };
