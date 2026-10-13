'use strict';

const db = require('../../../infrastructure/db');

async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT id, nombre, direccion, telefono, activo, created_at
       FROM consultorios
       WHERE deleted_at IS NULL
       ORDER BY nombre ASC`
    );
    return res.json({ ok: true, mensaje: 'Lista de consultorios', data: result.rows });
  } catch (error) {
    console.error('[Consultorios] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener consultorios', error: error.message });
  }
}

async function obtenerPorId(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, nombre, direccion, telefono, activo, created_at
       FROM consultorios WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio encontrado', data: result.rows[0] });
  } catch (error) {
    console.error('[Consultorios] Error en obtenerPorId:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener consultorio', error: error.message });
  }
}

async function crear(req, res) {
  const { nombre, direccion, telefono } = req.body;

  if (!nombre) {
    return res.status(400).json({ ok: false, mensaje: 'nombre es requerido' });
  }

  try {
    const result = await db.query(
      `INSERT INTO consultorios (nombre, direccion, telefono)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, direccion, telefono, activo, created_at`,
      [nombre, direccion || null, telefono || null]
    );
    return res.status(201).json({ ok: true, mensaje: 'Consultorio creado correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Consultorios] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear consultorio', error: error.message });
  }
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, direccion, telefono, activo } = req.body;

  try {
    const result = await db.query(
      `UPDATE consultorios
       SET nombre = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           telefono = COALESCE($3, telefono),
           activo = COALESCE($4, activo)
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id, nombre, direccion, telefono, activo, updated_at`,
      [nombre, direccion, telefono, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio actualizado correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Consultorios] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar consultorio', error: error.message });
  }
}

async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE consultorios SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio eliminado correctamente' });
  } catch (error) {
    console.error('[Consultorios] Error en eliminar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar consultorio', error: error.message });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
