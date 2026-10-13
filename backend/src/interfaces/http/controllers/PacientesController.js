'use strict';

const db = require('../../../infrastructure/db');

async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );
    return res.json({ ok: true, mensaje: 'Lista de pacientes', data: result.rows });
  } catch (error) {
    console.error('[Pacientes] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener pacientes', error: error.message });
  }
}

async function obtenerPorId(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT p.id, p.usuario_id, p.telefono, p.telegram_chat_id, p.fecha_nacimiento,
              u.nombre, u.email, p.created_at
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Paciente encontrado', data: result.rows[0] });
  } catch (error) {
    console.error('[Pacientes] Error en obtenerPorId:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener paciente', error: error.message });
  }
}

async function crear(req, res) {
  const { usuario_id, telefono, telegram_chat_id, fecha_nacimiento } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ ok: false, mensaje: 'usuario_id es requerido' });
  }

  try {
    const result = await db.query(
      `INSERT INTO pacientes (usuario_id, telefono, telegram_chat_id, fecha_nacimiento)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, telefono, telegram_chat_id, fecha_nacimiento, created_at`,
      [usuario_id, telefono || null, telegram_chat_id || null, fecha_nacimiento || null]
    );
    return res.status(201).json({ ok: true, mensaje: 'Paciente creado correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Pacientes] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear paciente', error: error.message });
  }
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { telefono, telegram_chat_id, fecha_nacimiento } = req.body;

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
    console.error('[Pacientes] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar paciente', error: error.message });
  }
}

async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE pacientes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Paciente no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('[Pacientes] Error en eliminar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar paciente', error: error.message });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
