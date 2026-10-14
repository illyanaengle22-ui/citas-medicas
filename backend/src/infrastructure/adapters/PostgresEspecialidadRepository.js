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

  normalizarDescripcion(descripcion) {
    if (descripcion === undefined || descripcion === null) return null;
    const limpia = descripcion.trim().replace(/\s+/g, ' ');
    return limpia === '' ? null : limpia;
  }

  async crear(nombre, descripcion) {
    const nombreNormalizado = this.normalizarNombre(nombre);
    const descripcionNormalizada = this.normalizarDescripcion(descripcion);

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
        'INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion, activo',
        [nombreNormalizado, descripcionNormalizada]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new DuplicadoError('Ya existe una especialidad con ese nombre');
      }
      throw error;
    }
  }

  async actualizar(id, { nombre, descripcion }) {
    // RN-030: actualizar cambia nombre y/o descripción (normalizados, con verificación de duplicado)
    const campos = [];
    const valores = [];
    let indice = 1;

    if (nombre !== undefined) {
      const nombreNormalizado = this.normalizarNombre(nombre);

      const duplicado = await db.query(
        'SELECT 1 FROM especialidades WHERE lower(nombre) = lower($1) AND id <> $2',
        [nombreNormalizado, id]
      );

      if (duplicado.rows.length > 0) {
        throw new DuplicadoError('Ya existe una especialidad con ese nombre');
      }

      campos.push(`nombre = $${indice++}`);
      valores.push(nombreNormalizado);
    }

    // RN-030b: la descripción es opcional y de máximo 500 caracteres
    if (descripcion !== undefined) {
      const descripcionNormalizada = this.normalizarDescripcion(descripcion);
      campos.push(`descripcion = $${indice++}`);
      valores.push(descripcionNormalizada);
    }

    if (campos.length === 0) return null;

    valores.push(id);

    try {
      const result = await db.query(
        `UPDATE especialidades SET ${campos.join(', ')} WHERE id = $${indice} RETURNING id, nombre, descripcion, activo`,
        valores
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
      ? 'SELECT id, nombre, descripcion, activo FROM especialidades ORDER BY nombre ASC'
      : 'SELECT id, nombre, descripcion, activo FROM especialidades WHERE activo = true ORDER BY nombre ASC';
    const result = await db.query(sql);
    return result.rows;
  }

  async cambiarEstado(id, activo) {
    const result = await db.query(
      'UPDATE especialidades SET activo = $1 WHERE id = $2 RETURNING id, nombre, descripcion, activo',
      [activo, id]
    );
    return result.rows[0] || null;
  }

  async obtenerPorId(id) {
    const result = await db.query('SELECT id, nombre, descripcion, activo FROM especialidades WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }
}

module.exports = { PostgresEspecialidadRepository, DuplicadoError };
