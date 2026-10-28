'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../../infrastructure/db');
const { secretValido } = require('../utils/webhookSecret');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_pruebas';

// RN-116: el código de vinculación vive 15 minutos y sirve una sola vez.
const TTL_CODIGO_MINUTOS = 15;
// Sin caracteres ambiguos (0/O, 1/I) para que se lea bien al escribirlo en Telegram.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RE_CHAT_ID = /^-?\d{1,30}$/;
const RE_CODIGO = /^[A-Z0-9]{6}$/;

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

function normalizarCodigo(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^\/START\s+/i, '')
    .trim()
    .toUpperCase();
}

// Mismos claims que el login normal (authMiddleware espera esta forma).
function firmarJWT(usuario) {
  return jwt.sign(
    { id: usuario.id, uuid_publico: usuario.uuid_publico, email: usuario.email, rol_id: usuario.rol_id },
    JWT_SECRET,
    { expiresIn: process.env.TELEGRAM_JWT_EXPIRA || '24h' }
  );
}

async function obtenerPacienteActivoPorUsuario(usuarioId) {
  const { rows } = await db.query(
    `SELECT p.id AS paciente_id
     FROM pacientes p
     JOIN usuarios u ON u.id = p.usuario_id
     JOIN estados_cuenta e ON e.id = u.estado_id
     WHERE p.usuario_id = $1
       AND p.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND e.clave = 'activo'`,
    [usuarioId]
  );
  return rows[0]?.paciente_id ?? null;
}

async function obtenerUsuarioPaciente(client, pacienteId) {
  const { rows } = await client.query(
    `SELECT u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
     FROM usuarios u
     JOIN pacientes p ON p.usuario_id = u.id
     JOIN estados_cuenta e ON e.id = u.estado_id
     WHERE p.id = $1
       AND p.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND e.clave = 'activo'`,
    [pacienteId]
  );
  return rows[0] || null;
}

// POST /api/telegram/codigo — la webapp le da al paciente su código (RN-116).
async function generarCodigo(req, res) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const paciente = await client.query(
      `SELECT p.id AS paciente_id
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.usuario_id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND e.clave = 'activo'`,
      [req.usuario.id]
    );

    if (paciente.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, mensaje: 'Solo los pacientes activos pueden vincular Telegram' });
    }

    const pacienteId = paciente.rows[0].paciente_id;

    // Serializa la generación por paciente sin bloquear la fila de pacientes
    // (el canje bloquea primero el código y luego actualiza al paciente).
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [pacienteId]);

    // Un solo código activo por paciente: el anterior deja de servir.
    await client.query(
      'DELETE FROM telegram_codigos WHERE paciente_id = $1 AND usado_en IS NULL',
      [pacienteId]
    );

    let codigo = null;
    let expiraEn = null;

    for (let intento = 0; intento < 5 && !codigo; intento++) {
      const candidato = crearCodigo();
      const insert = await client.query(
        `INSERT INTO telegram_codigos (codigo, paciente_id, expira_en)
         VALUES ($1, $2, now() + ($3 * interval '1 minute'))
         ON CONFLICT (codigo) DO NOTHING
         RETURNING codigo, expira_en`,
        [candidato, pacienteId, TTL_CODIGO_MINUTOS]
      );
      if (insert.rows.length > 0) {
        codigo = insert.rows[0].codigo;
        expiraEn = insert.rows[0].expira_en;
      }
    }

    if (!codigo) {
      await client.query('ROLLBACK');
      return res.status(500).json({ ok: false, mensaje: 'No se pudo generar un código único' });
    }

    await client.query('COMMIT');

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
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    return respuestaError500(res, 'Error al generar el código', error);
  } finally {
    client.release();
  }
}

// GET /api/telegram/estado — ¿ya está vinculado mi cuenta?
async function estado(req, res) {
  try {
    const pacienteId = await obtenerPacienteActivoPorUsuario(req.usuario.id);
    if (!pacienteId) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los pacientes activos tienen estado de vinculación' });
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

  const chatId = normalizarChatId(req.body?.chatId);
  if (!chatId) {
    return res.status(400).json({ ok: false, mensaje: 'chatId inválido' });
  }

  const codigo = normalizarCodigo(req.body?.codigo);
  if (!codigo) {
    return res.status(400).json({ ok: false, mensaje: 'codigo es requerido' });
  }
  if (!RE_CODIGO.test(codigo)) {
    return res.status(400).json({ ok: false, mensaje: 'Código inválido: debe tener 6 caracteres alfanuméricos' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT codigo, paciente_id, creado_en, expira_en, usado_en, usado_chat_id
       FROM telegram_codigos
       WHERE codigo = $1
       FOR UPDATE`,
      [codigo]
    );
    const registro = rows[0];

    if (!registro) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, mensaje: 'Código no existe o no fue generado en esta webapp' });
    }

    if (registro.usado_en) {
      // Reintento del mismo chat con el mismo código: respuesta idempotente.
      if (registro.usado_chat_id === chatId) {
        const vinculado = await client.query(
          'SELECT 1 FROM pacientes WHERE id = $1 AND telegram_chat_id = $2 AND deleted_at IS NULL',
          [registro.paciente_id, chatId]
        );
        if (vinculado.rows.length > 0) {
          const usuario = await obtenerUsuarioPaciente(client, registro.paciente_id);
          if (!usuario) {
            await client.query('ROLLBACK');
            return res.status(409).json({ ok: false, mensaje: 'La cuenta del paciente no está activa; no se puede vincular' });
          }
          await client.query('COMMIT');
          return res.json({
            ok: true,
            mensaje: 'La cuenta ya está vinculada',
            data: { token: firmarJWT(usuario), chatId, nombre: usuario.nombre },
          });
        }
      }

      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'Este código ya fue utilizado; genera uno nuevo en la webapp' });
    }

    if (new Date(registro.expira_en).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, mensaje: 'Código expirado; genera uno nuevo en la webapp' });
    }

    const chatEnUso = await client.query(
      `SELECT id FROM pacientes
       WHERE telegram_chat_id = $1 AND id <> $2 AND deleted_at IS NULL`,
      [chatId, registro.paciente_id]
    );
    if (chatEnUso.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'Este chat ya está vinculado a otra cuenta [RN-051]' });
    }

    const usuario = await obtenerUsuarioPaciente(client, registro.paciente_id);
    if (!usuario) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'La cuenta del paciente no está activa; no se puede vincular' });
    }

    const actualizado = await client.query(
      `UPDATE pacientes
       SET telegram_chat_id = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [chatId, registro.paciente_id]
    );
    if (actualizado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'No se pudo vincular: el chat o la cuenta ya está en uso' });
    }

    const marcado = await client.query(
      `UPDATE telegram_codigos
       SET usado_en = now(), usado_chat_id = $1
       WHERE codigo = $2 AND usado_en IS NULL
       RETURNING codigo`,
      [chatId, codigo]
    );
    if (marcado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'El código ya fue utilizado; genera uno nuevo en la webapp' });
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      mensaje: 'Cuenta vinculada correctamente',
      data: { token: firmarJWT(usuario), chatId, nombre: usuario.nombre },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    // RN-051: un chat no puede estar ligado a dos pacientes.
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, mensaje: 'Este chat ya está vinculado a otra cuenta [RN-051]' });
    }
    return respuestaError500(res, 'Error al vincular la cuenta', error);
  } finally {
    client.release();
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
