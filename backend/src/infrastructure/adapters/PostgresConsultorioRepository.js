'use strict';

const db = require('../../infrastructure/db');
const ConsultorioRepository = require('../../domain/ports/ConsultorioRepository');

class DuplicadoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'DuplicadoError';
  }
}

class CitasPendientesError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'CitasPendientesError';
  }
}

// Columnas que devuelven todos los endpoints (nunca password ni datos internos).
const COLUMNAS = 'id, nombre, direccion, telefono, activo, created_at';

class PostgresConsultorioRepository extends ConsultorioRepository {
  normalizarNombre(nombre) {
    return String(nombre).trim().replace(/\s+/g, ' ');
  }

  normalizarDireccion(direccion) {
    return String(direccion).trim().replace(/\s+/g, ' ');
  }

  // Solo dígitos: quita guiones, espacios y paréntesis. Vacío → null.
  normalizarTelefono(telefono) {
    if (telefono === undefined || telefono === null) return null;
    const soloDigitos = String(telefono).replace(/[\s\-()]/g, '');
    return soloDigitos === '' ? null : soloDigitos;
  }

  async _existeNombre(nombre, excluirId = null) {
    const parametros = [nombre];
    let sql = 'SELECT 1 FROM consultorios WHERE lower(nombre) = lower($1) AND deleted_at IS NULL';
    if (excluirId !== null) {
      parametros.push(excluirId);
      sql += ' AND id <> $2';
    }
    const result = await db.query(sql, parametros);
    return result.rows.length > 0;
  }

  // RN-034: por defecto solo activos y no eliminados; el admin puede pedir todos.
  // RN-033/RN-110: nunca se devuelven consultorios con deleted_at.
  async listar({ incluirInactivos = false, q = null } = {}) {
    const condiciones = ['deleted_at IS NULL'];
    const valores = [];

    if (!incluirInactivos) {
      condiciones.push('activo = true');
    }

    if (q && String(q).trim() !== '') {
      valores.push(`%${String(q).trim()}%`);
      condiciones.push(`(nombre ILIKE $${valores.length} OR direccion ILIKE $${valores.length})`);
    }

    const sql = `SELECT ${COLUMNAS} FROM consultorios
                 WHERE ${condiciones.join(' AND ')}
                 ORDER BY nombre ASC`;
    const result = await db.query(sql, valores);
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await db.query(
      `SELECT ${COLUMNAS} FROM consultorios WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async crear({ nombre, direccion, telefono }) {
    const nombreNormalizado = this.normalizarNombre(nombre);
    const direccionNormalizada = this.normalizarDireccion(direccion);
    const telefonoNormalizado = this.normalizarTelefono(telefono);

    if (await this._existeNombre(nombreNormalizado)) {
      throw new DuplicadoError('Ya existe un consultorio con ese nombre');
    }

    try {
      const result = await db.query(
        `INSERT INTO consultorios (nombre, direccion, telefono)
         VALUES ($1, $2, $3)
         RETURNING ${COLUMNAS}`,
        [nombreNormalizado, direccionNormalizada, telefonoNormalizado]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new DuplicadoError('Ya existe un consultorio con ese nombre');
      }
      throw error;
    }
  }

  async actualizar(id, { nombre, direccion, telefono }) {
    const campos = [];
    const valores = [];

    if (nombre !== undefined) {
      const nombreNormalizado = this.normalizarNombre(nombre);
      if (await this._existeNombre(nombreNormalizado, id)) {
        throw new DuplicadoError('Ya existe un consultorio con ese nombre');
      }
      valores.push(nombreNormalizado);
      campos.push(`nombre = $${valores.length}`);
    }

    if (direccion !== undefined) {
      valores.push(this.normalizarDireccion(direccion));
      campos.push(`direccion = $${valores.length}`);
    }

    // El teléfono es opcional: si llega vacío se guarda como NULL.
    if (telefono !== undefined) {
      valores.push(this.normalizarTelefono(telefono));
      campos.push(`telefono = $${valores.length}`);
    }

    if (campos.length === 0) return null;

    valores.push(id);

    try {
      const result = await db.query(
        `UPDATE consultorios SET ${campos.join(', ')}
         WHERE id = $${valores.length} AND deleted_at IS NULL
         RETURNING ${COLUMNAS}`,
        valores
      );
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === '23505') {
        throw new DuplicadoError('Ya existe un consultorio con ese nombre');
      }
      throw error;
    }
  }

  async cambiarEstado(id, activo) {
    const result = await db.query(
      `UPDATE consultorios SET activo = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING ${COLUMNAS}`,
      [activo, id]
    );
    return result.rows[0] || null;
  }

  // RN-033: borrado lógico. RN-112: verificación + update en transacción.
  async eliminar(id) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const existe = await client.query(
        'SELECT 1 FROM consultorios WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (existe.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Citas futuras vigentes: pendiente, confirmada, reagendada (RN-113: por clave, no por id fijo).
      const citas = await client.query(
        `SELECT 1 FROM citas
         WHERE consultorio_id = $1
           AND estado_id IN (
             SELECT id FROM estados_cita WHERE clave IN ('pendiente','confirmada','reagendada')
           )
           AND fecha_hora > now()
         LIMIT 1`,
        [id]
      );
      if (citas.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new CitasPendientesError('El consultorio tiene citas pendientes');
      }

      await client.query('UPDATE consultorios SET deleted_at = now() WHERE id = $1', [id]);
      await client.query('COMMIT');
      return { id };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[Consultorios] Error al revertir transacción:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  PostgresConsultorioRepository,
  DuplicadoError,
  CitasPendientesError,
};
