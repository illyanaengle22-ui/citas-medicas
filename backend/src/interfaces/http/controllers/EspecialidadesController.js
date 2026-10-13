'use strict';

const db = require('../../../infrastructure/db');

async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT id, nombre, activo FROM especialidades ORDER BY nombre ASC`
    );
    return res.json({ ok: true, mensaje: 'Lista de especialidades', data: result.rows });
  } catch (error) {
    console.error('[Especialidades] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener especialidades', error: error.message });
  }
}

async function obtenerPorId(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, nombre, activo FROM especialidades WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({ ok: true, mensaje: 'Especialidad encontrada', data: result.rows[0] });
  } catch (error) {
    console.error('[Especialidades] Error en obtenerPorId:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener especialidad', error: error.message });
  }
}

async function crear(req, res) {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ ok: false, mensaje: 'nombre es requerido' });
  }

  try {
    const result = await db.query(
      `INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id, nombre, activo`,
      [nombre]
    );
    return res.status(201).json({ ok: true, mensaje: 'Especialidad creada correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Especialidades] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear especialidad', error: error.message });
  }
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, activo } = req.body;

  try {
    const result = await db.query(
      `UPDATE especialidades
       SET nombre = COALESCE($1, nombre), activo = COALESCE($2, activo)
       WHERE id = $3
       RETURNING id, nombre, activo`,
      [nombre, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({ ok: true, mensaje: 'Especialidad actualizada correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Especialidades] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar especialidad', error: error.message });
  }
}

async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `DELETE FROM especialidades WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({ ok: true, mensaje: 'Especialidad eliminada correctamente' });
  } catch (error) {
    console.error('[Especialidades] Error en eliminar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar especialidad', error: error.message });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
