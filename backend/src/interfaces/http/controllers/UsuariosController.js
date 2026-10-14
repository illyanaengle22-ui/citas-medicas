'use strict';

const bcrypt = require('bcryptjs');
const PostgresUsuarioRepository = require('../../../infrastructure/adapters/PostgresUsuarioRepository');
const ListarUsuarios = require('../../../application/use-cases/ListarUsuarios');
const AprobarUsuario = require('../../../application/use-cases/AprobarUsuario');
const RechazarUsuario = require('../../../application/use-cases/RechazarUsuario');
const AsignarRol = require('../../../application/use-cases/AsignarRol');
const ObtenerEstadisticasUsuarios = require('../../../application/use-cases/ObtenerEstadisticasUsuarios');
const CrearUsuarioAdmin = require('../../../application/use-cases/CrearUsuarioAdmin');
const ActualizarUsuario = require('../../../application/use-cases/ActualizarUsuario');
const EliminarUsuario = require('../../../application/use-cases/EliminarUsuario');

const repo = new PostgresUsuarioRepository();

async function listar(req, res) {
  try {
    const { rol, estado, page = 1, limit = 10 } = req.query;
    const caso = new ListarUsuarios(repo);
    const data = await caso.execute({ rol, estado, page: parseInt(page), limit: parseInt(limit) });
    return res.json({ ok: true, mensaje: 'Lista de usuarios', data });
  } catch (error) {
    console.error('[Usuarios] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios', error: error.message });
  }
}

async function listarPendientes(req, res) {
  try {
    const caso = new ListarUsuarios(repo);
    const data = await caso.execute({});
    const pendientes = data.filter((u) => u.estado === 'pendiente');
    return res.json({ ok: true, mensaje: 'Usuarios pendientes', data: pendientes });
  } catch (error) {
    console.error('[Usuarios] Error en listarPendientes:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener pendientes', error: error.message });
  }
}

async function aprobar(req, res) {
  try {
    const { id } = req.params;
    const caso = new AprobarUsuario(repo);
    const resultado = await caso.execute(parseInt(id));

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    console.error('[Usuarios] Error en aprobar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al aprobar usuario', error: error.message });
  }
}

async function rechazar(req, res) {
  try {
    const { id } = req.params;
    const caso = new RechazarUsuario(repo);
    const resultado = await caso.execute(parseInt(id));

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    console.error('[Usuarios] Error en rechazar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al rechazar usuario', error: error.message });
  }
}

async function asignarRol(req, res) {
  try {
    const { id } = req.params;
    const { rol_id } = req.body;

    if (!rol_id) {
      return res.status(400).json({ ok: false, mensaje: 'rol_id es requerido' });
    }

    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({ ok: false, mensaje: 'No puedes cambiar tu propio rol' });
    }

    const caso = new AsignarRol(repo);
    const resultado = await caso.execute(parseInt(id), parseInt(rol_id));

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    console.error('[Usuarios] Error en asignarRol:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al asignar rol', error: error.message });
  }
}

async function estadisticas(req, res) {
  try {
    const caso = new ObtenerEstadisticasUsuarios(repo);
    const data = await caso.execute();
    return res.json({ ok: true, mensaje: 'Estadísticas de usuarios', data });
  } catch (error) {
    console.error('[Usuarios] Error en estadisticas:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener estadísticas', error: error.message });
  }
}

async function crear(req, res) {
  // RN-012: los administradores solo se crean por la vía administrativa
  // RN-007: el rol asignado debe existir en el catálogo roles
  // RN-008: las contraseñas se almacenan solo como hash (bcrypt)
  try {
    const { nombre, email, password, rol_id } = req.body;

    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ ok: false, mensaje: 'nombre, email, password y rol_id son requeridos' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const caso = new CrearUsuarioAdmin(repo);
    const resultado = await caso.execute({ nombre, email, password_hash: passwordHash, rol_id });

    if (!resultado.success) {
      return res.status(409).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.status(201).json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    console.error('[Usuarios] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear usuario', error: error.message });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, email, rol_id } = req.body;

    const caso = new ActualizarUsuario(repo);
    const resultado = await caso.execute(parseInt(id), { nombre, email, rol_id });

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    console.error('[Usuarios] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar usuario', error: error.message });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const caso = new EliminarUsuario(repo);
    const resultado = await caso.execute(parseInt(id), req.usuario.id);

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    console.error('[Usuarios] Error en eliminar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar usuario', error: error.message });
  }
}

module.exports = { listar, listarPendientes, aprobar, rechazar, asignarRol, estadisticas, crear, actualizar, eliminar };
