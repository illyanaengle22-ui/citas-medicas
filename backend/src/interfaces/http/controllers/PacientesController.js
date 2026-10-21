'use strict';

const db = require('../../../infrastructure/db');
const validarId = require('../utils/validarId');

function esAdmin(usuario) {
  return Number(usuario?.rol_id) === 1;
}

// Errores de PostgreSQL que corresponden a datos inválidos, no a fallos internos.
function esErrorDeDatos(error) {
  return error?.code === '22003' || error?.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }
  console.error(`[Pacientes] ${mensaje}:`, error.message);
  return res.status(500).json({ ok: false, mensaje });
}

async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.deleted_at IS NULL
         AND u.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );
    return res.json({ ok: true, mensaje: 'Lista de pacientes', data: result.rows });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener pacientes', error);
  }
}

async function obtenerPorId(req, res) {
  const id = validarId(req.params.id, 'bigint');
  if (!id) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }

  try {
    const result = await db.query(
      `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }

    const paciente = result.rows[0];

    // RN-053: un paciente solo puede consultar su propio registro.
    if (!esAdmin(req.usuario) && String(req.usuario.id) !== String(paciente.usuario_id)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para acceder a este recurso' });
    }

    return res.json({ ok: true, mensaje: 'Paciente encontrado', data: paciente });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener paciente', error);
  }
}

async function crear(req, res) {
  const { usuario_id, telefono, telegram_chat_id, fecha_nacimiento } = req.body || {};

  if (!usuario_id) {
    return res.status(400).json({ ok: false, mensaje: 'usuario_id es requerido' });
  }

  const usuarioId = validarId(usuario_id, 'bigint');
  if (!usuarioId) {
    return res.status(400).json({ ok: false, mensaje: 'usuario_id inválido' });
  }

  try {
    const usuario = await db.query(
      'SELECT id FROM usuarios WHERE id = $1 AND deleted_at IS NULL',
      [usuarioId]
    );
    if (usuario.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const result = await db.query(
      `INSERT INTO pacientes (usuario_id, telefono, telegram_chat_id, fecha_nacimiento)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, telefono, telegram_chat_id, fecha_nacimiento, created_at`,
      [usuarioId, telefono || null, telegram_chat_id || null, fecha_nacimiento || null]
    );
    return res.status(201).json({ ok: true, mensaje: 'Paciente creado correctamente', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, mensaje: 'El usuario ya tiene un registro de paciente' });
    }
    return respuestaError500(res, 'Error al crear paciente', error);
  }
}

async function actualizar(req, res) {
  const id = validarId(req.params.id, 'bigint');
  if (!id) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }

  const { telefono, telegram_chat_id, fecha_nacimiento } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE pacientes
       SET telefono = COALESCE($1, telefono),
           telegram_chat_id = COALESCE($2, telegram_chat_id),
           fecha_nacimiento = COALESCE($3, fecha_nacimiento)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, usuario_id, telefono, telegram_chat_id, fecha_nacimiento, updated_at`,
      [telefono, telegram_chat_id, fecha_nacimiento, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Paciente actualizado correctamente', data: result.rows[0] });
  } catch (error) {
    return respuestaError500(res, 'Error al actualizar paciente', error);
  }
}

async function eliminar(req, res) {
  const id = validarId(req.params.id, 'bigint');
  if (!id) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const existe = await client.query(
      'SELECT usuario_id FROM pacientes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id]
    );
    if (existe.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }

    const { usuario_id: usuarioId } = existe.rows[0];

    // RN-076 / RN-113: citas vigentes resueltas por clave, nunca por ID fijo.
    const citas = await client.query(
      `SELECT 1
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.paciente_id = $1
         AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
         AND c.fecha_hora > now()
       LIMIT 1`,
      [id]
    );
    if (citas.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        mensaje: 'No se puede eliminar el paciente porque tiene citas futuras vigentes',
      });
    }

    // RN-110 / RN-112: soft delete del paciente y de su usuario en una transacción.
    await client.query('UPDATE pacientes SET deleted_at = now() WHERE id = $1', [id]);
    await client.query(
      'UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
      [usuarioId]
    );

    await client.query('COMMIT');
    return res.json({ ok: true, mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('[Pacientes] Error en ROLLBACK de eliminar:', rollbackError.message);
    }
    return respuestaError500(res, 'Error al eliminar paciente', error);
  } finally {
    client.release();
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
