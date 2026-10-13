'use strict';

const db = require('../../../infrastructure/db');

async function listar(req, res) {
  try {
    const result = await db.query(
      `SELECT m.id, m.usuario_id, m.cedula_profesional, m.telefono, m.activo,
              u.nombre, u.email, m.created_at
       FROM medicos m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.deleted_at IS NULL
       ORDER BY m.created_at DESC`
    );
    return res.json({ ok: true, mensaje: 'Lista de médicos', data: result.rows });
  } catch (error) {
    console.error('[Medicos] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener médicos', error: error.message });
  }
}

async function obtenerPorId(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT m.id, m.usuario_id, m.cedula_profesional, m.telefono, m.activo,
              u.nombre, u.email, m.created_at
       FROM medicos m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Médico encontrado', data: result.rows[0] });
  } catch (error) {
    console.error('[Medicos] Error en obtenerPorId:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener médico', error: error.message });
  }
}

async function crear(req, res) {
  const { usuario_id, cedula_profesional, telefono } = req.body;

  if (!usuario_id || !cedula_profesional) {
    return res.status(400).json({ ok: false, mensaje: 'usuario_id y cedula_profesional son requeridos' });
  }

  try {
    const result = await db.query(
      `INSERT INTO medicos (usuario_id, cedula_profesional, telefono)
       VALUES ($1, $2, $3)
       RETURNING id, usuario_id, cedula_profesional, telefono, activo, created_at`,
      [usuario_id, cedula_profesional, telefono || null]
    );
    return res.status(201).json({ ok: true, mensaje: 'Médico creado correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Medicos] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear médico', error: error.message });
  }
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { cedula_profesional, telefono, activo } = req.body;

  try {
    const result = await db.query(
      `UPDATE medicos
       SET cedula_profesional = COALESCE($1, cedula_profesional),
           telefono = COALESCE($2, telefono),
           activo = COALESCE($3, activo)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, usuario_id, cedula_profesional, telefono, activo, updated_at`,
      [cedula_profesional, telefono, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Médico actualizado correctamente', data: result.rows[0] });
  } catch (error) {
    console.error('[Medicos] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar médico', error: error.message });
  }
}

async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE medicos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Médico no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Médico eliminado correctamente' });
  } catch (error) {
    console.error('[Medicos] Error en eliminar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar médico', error: error.message });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
