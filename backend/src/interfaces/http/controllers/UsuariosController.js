'use strict';

const bcrypt = require('bcryptjs');
const PostgresUsuarioRepository = require('../../../infrastructure/adapters/PostgresUsuarioRepository');
const ListarUsuarios = require('../../../application/use-cases/ListarUsuarios');
const AprobarUsuario = require('../../../application/use-cases/AprobarUsuario');
const RechazarUsuario = require('../../../application/use-cases/RechazarUsuario');
const CambiarRol = require('../../../application/use-cases/CambiarRol');
const ObtenerEstadisticasUsuarios = require('../../../application/use-cases/ObtenerEstadisticasUsuarios');
const CrearUsuarioAdmin = require('../../../application/use-cases/CrearUsuarioAdmin');
const ActualizarUsuario = require('../../../application/use-cases/ActualizarUsuario');
const EliminarUsuario = require('../../../application/use-cases/EliminarUsuario');
const ObtenerUsuarioPorId = require('../../../application/use-cases/ObtenerUsuarioPorId');
const validarId = require('../utils/validarId');

const repo = new PostgresUsuarioRepository();

function respuestaError500(res, mensaje, error) {
  console.error('[Usuarios] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

async function listar(req, res) {
  try {
    const { rol, estado, q, page = 1, limit = 10 } = req.query;
    const caso = new ListarUsuarios(repo);
    const data = await caso.execute({ rol, estado, q, page: parseInt(page), limit: parseInt(limit) });
    return res.json({ ok: true, mensaje: 'Lista de usuarios', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener usuarios', error);
  }
}

async function listarPendientes(req, res) {
  try {
    const result = await repo.listarPendientes();
    return res.json({ ok: true, mensaje: 'Usuarios pendientes', data: result });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener pendientes', error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const caso = new ObtenerUsuarioPorId(repo);
    const data = await caso.execute(id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Usuario encontrado', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener usuario', error);
  }
}

async function aprobar(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const caso = new AprobarUsuario(repo);
    const resultado = await caso.execute(id);
    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    return respuestaError500(res, 'Error al aprobar usuario', error);
  }
}

async function rechazar(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const caso = new RechazarUsuario(repo);
    const resultado = await caso.execute(id);
    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    return respuestaError500(res, 'Error al rechazar usuario', error);
  }
}

async function estadisticas(req, res) {
  try {
    const caso = new ObtenerEstadisticasUsuarios(repo);
    const data = await caso.execute();
    return res.json({ ok: true, mensaje: 'Estadísticas de usuarios', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener estadísticas', error);
  }
}

async function crear(req, res) {
  try {
    const { nombre, email, password, rol_id } = req.body;

    if (!nombre || !email || !password || !rol_id) {
      return res.status(400).json({ ok: false, mensaje: 'nombre, email, password y rol_id son requeridos' });
    }

    // Validar rol permitido: solo admin (1) y paciente (3)
    const rolIdNum = parseInt(rol_id, 10);
    if (isNaN(rolIdNum) || ![1, 3].includes(rolIdNum)) {
      return res.status(400).json({ ok: false, mensaje: 'Los médicos se crean desde el módulo Médicos' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const caso = new CrearUsuarioAdmin(repo);
    const resultado = await caso.execute({ nombre, email, password_hash: passwordHash, rol_id: rolIdNum });

    if (!resultado.success) {
      return res.status(409).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.status(201).json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    return respuestaError500(res, 'Error al crear usuario', error);
  }
}

async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { nombre, email, password, rol_id } = req.body;

    if (!nombre && !email && !password) {
      return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' });
    }

    const caso = new ActualizarUsuario(repo);
    const resultado = await caso.execute(id, { nombre, email, password, rol_id });

    if (!resultado.success) {
      let status = 400;
      if (resultado.mensaje.includes('ya está registrado')) status = 409;
      else if (resultado.mensaje.includes('no encontrado') || resultado.mensaje.includes('no existe')) status = 404;
      return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    return respuestaError500(res, 'Error al actualizar usuario', error);
  }
}

async function asignarRol(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { rol_id } = req.body;

    if (!rol_id) {
      return res.status(400).json({ ok: false, mensaje: 'rol_id es requerido' });
    }

    const caso = new CambiarRol(repo);
    const resultado = await caso.execute(id, parseInt(rol_id, 10), req.usuario.id);

    if (!resultado.success) {
      let status = 400;
      if (resultado.mensaje.includes('ya está registrado') || resultado.mensaje.includes('médico') || resultado.mensaje.includes('médico')) status = 409;
      else if (resultado.mensaje.includes('no encontrado') || resultado.mensaje.includes('no existe') || resultado.mensaje.includes('propio rol')) status = 400;
      return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    return respuestaError500(res, 'Error al cambiar rol', error);
  }
}

async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const caso = new EliminarUsuario(repo);
    const resultado = await caso.execute(id, req.usuario.id);

    if (!resultado.success) {
      let status = 400;
      if (resultado.mensaje.includes('no encontrado') || resultado.mensaje.includes('no existe')) status = 404;
      return res.status(status).json({ ok: false, mensaje: resultado.mensaje });
    }

    return res.json({ ok: true, mensaje: resultado.mensaje });
  } catch (error) {
    return respuestaError500(res, 'Error al eliminar usuario', error);
  }
}

async function obtenerDetalle(req, res) {
  try {
    const id = validarId(req.params.id, 'integer');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const caso = new ObtenerUsuarioPorId(repo);
    const data = await caso.execute(id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Usuario encontrado', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener usuario', error);
  }
}

module.exports = { 
  listar, 
  listarPendientes, 
  obtenerPorId, 
  aprobar, 
  rechazar, 
  asignarRol, 
  estadisticas, 
  crear, 
  actualizar, 
  eliminar,
  obtenerDetalle
};