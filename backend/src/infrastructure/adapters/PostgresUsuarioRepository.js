'use strict';

const db = require('../../infrastructure/db');
const UsuarioRepository = require('../../domain/ports/UsuarioRepository');
const Usuario = require('../../domain/entities/Usuario');

class PostgresUsuarioRepository extends UsuarioRepository {
  async listar({ rol, estado, page = 1, limit = 10 } = {}) {
    const condiciones = ['deleted_at IS NULL'];
    const parametros = [];

    if (rol) {
      parametros.push(rol);
      condiciones.push(`rol_id = (SELECT id FROM roles WHERE clave = $${parametros.length})`);
    }

    if (estado) {
      parametros.push(estado);
      condiciones.push(`estado_id = (SELECT id FROM estados_cuenta WHERE clave = $${parametros.length})`);
    }

    const where = condiciones.join(' AND ');
    const offset = (page - 1) * limit;

    const sql = `
      SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at,
             r.clave AS rol, e.clave AS estado
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      JOIN estados_cuenta e ON e.id = u.estado_id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}
    `;

    const result = await db.query(sql, [...parametros, limit, offset]);
    return result.rows.map((row) => ({
      id: row.id,
      uuid_publico: row.uuid_publico,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      estado: row.estado,
      created_at: row.created_at
    }));
  }

  async listarPendientes() {
    const result = await db.query(
      `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
         AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`
    );
    return result.rows;
  }

  async aprobar(id) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const usuarioResult = await client.query(
        `SELECT id, rol_id, estado_id FROM usuarios WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id]
      );

      if (usuarioResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, mensaje: 'Usuario no encontrado' };
      }

      const usuario = usuarioResult.rows[0];
      if (usuario.estado_id !== 1) {
        await client.query('ROLLBACK');
        return { success: false, mensaje: 'El usuario no está pendiente' };
      }

      await client.query(
        `UPDATE usuarios SET estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo') WHERE id = $1`,
        [id]
      );

      if (usuario.rol_id === 3) {
        await client.query(
          `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
          [id]
        );
      }

      await client.query('COMMIT');
      return { success: true, mensaje: 'Usuario aprobado correctamente' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rechazar(id) {
    const result = await db.query(
      `UPDATE usuarios SET estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'rechazado')
       WHERE id = $1 AND estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')
         AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return { success: false, mensaje: 'Usuario no encontrado o no está pendiente' };
    }

    return { success: true, mensaje: 'Cuenta rechazada correctamente' };
  }

  async asignarRol(id, rol_id) {
    const rolExiste = await db.query('SELECT id FROM roles WHERE id = $1', [rol_id]);
    if (rolExiste.rows.length === 0) {
      return { success: false, mensaje: 'Rol no encontrado' };
    }

    const result = await db.query(
      `UPDATE usuarios SET rol_id = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
      [rol_id, id]
    );

    if (result.rows.length === 0) {
      return { success: false, mensaje: 'Usuario no encontrado' };
    }

    return { success: true, mensaje: 'Rol actualizado correctamente' };
  }

  async obtenerEstadisticas() {
    const result = await db.query(`
      SELECT
        COUNT(*) AS totales,
        COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'pendiente')) AS pendientes,
        COUNT(*) FILTER (WHERE estado_id = (SELECT id FROM estados_cuenta WHERE clave = 'activo')) AS activos,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'admin')) AS admins,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'medico')) AS medicos,
        COUNT(*) FILTER (WHERE rol_id = (SELECT id FROM roles WHERE clave = 'paciente')) AS pacientes
      FROM usuarios
      WHERE deleted_at IS NULL
    `);

    const row = result.rows[0];
    return {
      totales: parseInt(row.totales, 10),
      pendientes: parseInt(row.pendientes, 10),
      activos: parseInt(row.activos, 10),
      admins: parseInt(row.admins, 10),
      medicos: parseInt(row.medicos, 10),
      pacientes: parseInt(row.pacientes, 10)
    };
  }

  async obtenerPorId(id) {
    const result = await db.query(
      `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return new Usuario({
      id: row.id,
      uuid_publico: row.uuid_publico,
      nombre: row.nombre,
      email: row.email,
      rol_id: row.rol_id,
      estado_id: row.estado_id,
      created_at: row.created_at
    });
  }

  async crear({ nombre, email, password_hash, rol_id }) {
    try {
      const result = await db.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
         VALUES ($1, $2, $3, $4, (SELECT id FROM estados_cuenta WHERE clave = 'activo'))
         RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
        [nombre, email, password_hash, rol_id]
      );
      return { success: true, data: result.rows[0], mensaje: 'Usuario creado correctamente' };
    } catch (error) {
      if (error.code === '23505') {
        return { success: false, mensaje: 'El email ya está registrado' };
      }
      throw error;
    }
  }

  async actualizar(id, { nombre, email, rol_id }) {
    const campos = [];
    const valores = [];
    let indice = 1;

    if (nombre !== undefined) { campos.push(`nombre = $${indice++}`); valores.push(nombre); }
    if (email !== undefined) { campos.push(`email = $${indice++}`); valores.push(email); }
    if (rol_id !== undefined) { campos.push(`rol_id = $${indice++}`); valores.push(rol_id); }

    if (campos.length === 0) {
      return { success: false, mensaje: 'No hay campos para actualizar' };
    }

    valores.push(id);

    try {
      const result = await db.query(
        `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${indice} AND deleted_at IS NULL
         RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, updated_at`,
        valores
      );

      if (result.rows.length === 0) {
        return { success: false, mensaje: 'Usuario no encontrado' };
      }

      return { success: true, data: result.rows[0], mensaje: 'Usuario actualizado correctamente' };
    } catch (error) {
      if (error.code === '23505') {
        return { success: false, mensaje: 'El email ya está registrado' };
      }
      throw error;
    }
  }

  async eliminar(id) {
    const result = await db.query(
      `UPDATE usuarios SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return { success: false, mensaje: 'Usuario no encontrado' };
    }

    return { success: true, mensaje: 'Usuario eliminado correctamente' };
  }
}

module.exports = PostgresUsuarioRepository;
