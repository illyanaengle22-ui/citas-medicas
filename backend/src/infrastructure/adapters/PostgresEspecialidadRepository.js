'use strict';

const db = require('../../infrastructure/db');

class DuplicadoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'DuplicadoError';
  }
}

class PostgresEspecialidadRepository {
  normalizarNombre(nombre) {
    return nombre.trim().replace(/\s+/g, ' ');
  }

  async crear(nombre) {
    const nombreNormalizado = this.normalizarNombre(nombre);

    // RN-030: el nombre de una especialidad es único (case-insensitive)
    const duplicado = await db.query(
      'SELECT 1 FROM especialidades WHERE lower(nombre) = lower($1)',
      [nombreNormalizado]
    );

    if (duplicado.rows.length > 0) {
      throw new DuplicadoError('Ya existe una especialidad con ese nombre');
    }

    try {
      const result = await db.query(
        'INSERT INTO especialidades (nombre) VALUES ($1) RETURNING id, nombre, activo',
        [nombreNormalizado]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new DuplicadoError('Ya existe una especialidad con ese nombre');
      }
      throw error;
    }
  }

  async actualizar(id, { nombre }) {
    // RN-030: actualizar solo cambia el nombre (normalizado, con verificación de duplicado)
    if (nombre === undefined) return null;

    const nombreNormalizado = this.normalizarNombre(nombre);

    const duplicado = await db.query(
      'SELECT 1 FROM especialidades WHERE lower(nombre) = lower($1) AND id <> $2',
      [nombreNormalizado, id]
    );

    if (duplicado.rows.length > 0) {
      throw new DuplicadoError('Ya existe una especialidad con ese nombre');
    }

    try {
      const result = await db.query(
        'UPDATE especialidades SET nombre = $1 WHERE id = $2 RETURNING id, nombre, activo',
        [nombreNormalizado, id]
      );
      if (result.rows.length === 0) return null;
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new DuplicadoError('Ya existe una especialidad con ese nombre');
      }
      throw error;
    }
  }

  // RN-031: por defecto solo activas; con incluirInactivas devuelve todas
  async listar({ incluirInactivas = false } = {}) {
    const sql = incluirInactivas
      ? 'SELECT id, nombre, activo FROM especialidades ORDER BY nombre ASC'
      : 'SELECT id, nombre, activo FROM especialidades WHERE activo = true ORDER BY nombre ASC';
    const result = await db.query(sql);
    return result.rows;
  }

  async cambiarEstado(id, activo) {
    const result = await db.query(
      'UPDATE especialidades SET activo = $1 WHERE id = $2 RETURNING id, nombre, activo',
      [activo, id]
    );
    return result.rows[0] || null;
  }

  async obtenerPorId(id) {
    const result = await db.query('SELECT id, nombre, activo FROM especialidades WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }
}

module.exports = { PostgresEspecialidadRepository, DuplicadoError };
