'use strict';

const db = require('../../../infrastructure/db');

/**
 * GET /api/dashboard/stats
 * Estadísticas generales para el dashboard de demostración
 */
async function obtenerEstadisticas(req, res) {
  try {
    const [totalRes, roleRes, recentRes, dbTimeRes] = await Promise.all([
      db.query('SELECT COUNT(*) AS total FROM usuarios'),
      db.query('SELECT rol, COUNT(*) AS cantidad FROM usuarios GROUP BY rol ORDER BY cantidad DESC'),
      db.query('SELECT id, nombre, usuario, rol, creado_en FROM usuarios ORDER BY creado_en DESC LIMIT 5'),
      db.query('SELECT NOW() AS ahora, version() AS version_pg'),
    ]);

    return res.json({
      ok: true,
      stats: {
        total_usuarios: parseInt(totalRes.rows[0].total, 10),
        por_rol: roleRes.rows,
        recientes: recentRes.rows,
        db: {
          hora_servidor: dbTimeRes.rows[0].ahora,
          version: dbTimeRes.rows[0].version_pg,
        },
      },
    });
  } catch (error) {
    console.error('[Dashboard] Error estadísticas:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener estadísticas', error: error.message });
  }
}

/**
 * GET /api/dashboard/usuarios
 * Lista completa de usuarios (sin password) para tabla del dashboard
 */
async function listarUsuarios(req, res) {
  try {
    const result = await db.query(
      'SELECT id, nombre, usuario, rol, creado_en FROM usuarios ORDER BY id ASC'
    );
    return res.json({ ok: true, usuarios: result.rows });
  } catch (error) {
    console.error('[Dashboard] Error listando usuarios:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al listar usuarios', error: error.message });
  }
}

/**
 * DELETE /api/dashboard/usuarios/:id
 * Eliminar usuario por ID (para demostrar operaciones CRUD)
 */
async function eliminarUsuario(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }
    return res.json({ ok: true, mensaje: `Usuario "${result.rows[0].nombre}" eliminado`, eliminado: result.rows[0] });
  } catch (error) {
    console.error('[Dashboard] Error eliminando:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar usuario', error: error.message });
  }
}

module.exports = { obtenerEstadisticas, listarUsuarios, eliminarUsuario };
