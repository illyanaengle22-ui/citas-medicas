'use strict';

const db = require('../../infrastructure/db');
const UsuarioRepository = require('../../domain/ports/UsuarioRepository');
const Usuario = require('../../domain/entities/Usuario');

class PostgresUsuarioRepository extends UsuarioRepository {
  async listar({ rol, estado, q, page = 1, limit = 10 } = {}) {
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

    if (q) {
      parametros.push(`%${q}%`);
      condiciones.push(`(u.nombre ILIKE $${parametros.length} OR u.email ILIKE $${parametros.length})`);
    }

    const where = condiciones.join(' AND ');
    const offset = (page - 1) * limit;

    // Query para obtener total
    const countSql = `SELECT COUNT(*) FROM usuarios u WHERE ${where}`;
    const totalResult = await db.query(countSql, parametros);
    const total = parseInt(totalResult.rows[0].count, 10);

    // Query paginada
    const sql = `
      SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
             r.clave AS rol, e.clave AS estado
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      JOIN estados_cuenta e ON e.id = u.estado_id
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}
    `;

    const result = await db.query(sql, [...parametros, limit, offset]);
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        uuid_publico: row.uuid_publico,
        nombre: row.nombre,
        email: row.email,
        rol: row.rol,
        estado: row.estado,
        created_at: row.created_at,
        ultimo_login: row.ultimo_login
      })),
      total,
      page,
      limit
    };
  }

  async listarPendientes() {
    const result = await db.query(
      `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
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
    // RN-005: solo se puede aprobar una cuenta en estado pendiente y no eliminada
    // RN-011: al aprobar un usuario con rol paciente, crear fila en pacientes en la misma transacción
    // RN-112: operaciones multi-tabla en transacción
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

  async cambiarRol(id, nuevoRolId, actorId) {
    // RN-006: un admin no puede cambiar su propio rol
    if (parseInt(id) === parseInt(actorId)) {
      return { success: false, mensaje: 'No puedes cambiar tu propio rol' };
    }

    // Verificar que el rol existe
    const rolExiste = await db.query('SELECT id, clave FROM roles WHERE id = $1', [nuevoRolId]);
    if (rolExiste.rows.length === 0) {
      return { success: false, mensaje: 'Rol no encontrado' };
    }
    const nuevaRolClave = rolExiste.rows[0].clave;

    // Obtener rol actual
    const usuarioActual = await db.query('SELECT rol_id FROM usuarios WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (usuarioActual.rows.length === 0) {
      return { success: false, mensaje: 'Usuario no encontrado' };
    }
    const rolActualId = usuarioActual.rows[0].rol_id;
    const rolActual = await db.query('SELECT clave FROM roles WHERE id = $1', [rolActualId]);
    const rolActualClave = rolActual.rows[0]?.clave;

    // RN-046 / RN-006: bloquear cambios hacia o desde 'medico'
    if (nuevaRolClave === 'medico' || rolActualClave === 'medico') {
      return { success: false, mensaje: 'No se puede cambiar el rol hacia o desde médico. Use el módulo de Médicos.' };
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE usuarios SET rol_id = $1 WHERE id = $2 AND deleted_at IS NULL`,
        [nuevoRolId, id]
      );

      // Si el nuevo rol es paciente, asegurar fila en pacientes
      if (nuevaRolClave === 'paciente') {
        await client.query(
          `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
          [id]
        );
      }

      await client.query('COMMIT');
      return { success: true, mensaje: 'Rol actualizado correctamente' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
      `SELECT u.id, u.uuid_publico, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.ultimo_login,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      uuid_publico: row.uuid_publico,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      estado: row.estado,
      created_at: row.created_at,
      ultimo_login: row.ultimo_login
    };
  }

  async crear({ nombre, email, password_hash, rol_id }) {
    // Solo admin (1) y paciente (3) permitido
    const rolValido = await db.query('SELECT id, clave FROM roles WHERE id = $1', [rol_id]);
    if (rolValido.rows.length === 0) {
      return { success: false, mensaje: 'Rol no encontrado' };
    }
    if (!['admin', 'paciente'].includes(rolValido.rows[0].clave)) {
      return { success: false, mensaje: 'Los médicos se crean desde el módulo Médicos' };
    }

    const emailNormalizado = email.trim().toLowerCase();

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
         VALUES ($1, $2, $3, $4, (SELECT id FROM estados_cuenta WHERE clave = 'activo'))
         RETURNING id, uuid_publico, nombre, email, rol_id, estado_id, created_at`,
        [nombre, emailNormalizado, password_hash, rol_id]
      );

      const usuario = result.rows[0];

      // Si es paciente, crear fila en pacientes
      if (rolValido.rows[0].clave === 'paciente') {
        await client.query(
          `INSERT INTO pacientes (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
          [usuario.id]
        );
      }

      await client.query('COMMIT');
      return { success: true, data: usuario, mensaje: 'Usuario creado correctamente' };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return { success: false, mensaje: 'El email ya está registrado' };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async actualizar(id, { nombre, email, password_hash, rol_id }) {
    const campos = [];
    const valores = [];
    let indice = 1;

    if (nombre !== undefined) { campos.push(`nombre = $${indice++}`); valores.push(nombre); }
    if (email !== undefined) { campos.push(`email = $${indice++}`); valores.push(email.trim().toLowerCase()); }
    if (password_hash !== undefined) { campos.push(`password_hash = $${indice++}`); valores.push(password_hash); }
    // rol_id no se actualiza aquí (usa cambiarRol)

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

  async eliminar(id, actorId) {
    // RN-006: un admin no puede eliminarse a sí mismo
    if (parseInt(id) === parseInt(actorId)) {
      return { success: false, mensaje: 'No puedes eliminar tu propia cuenta' };
    }

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