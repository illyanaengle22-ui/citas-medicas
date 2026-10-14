'use strict';

const { PostgresEspecialidadRepository, DuplicadoError } = require('../../../infrastructure/adapters/PostgresEspecialidadRepository');
const CrearEspecialidad = require('../../../application/use-cases/CrearEspecialidad');
const ActualizarEspecialidad = require('../../../application/use-cases/ActualizarEspecialidad');
const CambiarEstadoEspecialidad = require('../../../application/use-cases/CambiarEstadoEspecialidad');
const validarId = require('../utils/validarId');

const repo = new PostgresEspecialidadRepository();

function esAdmin(usuario) {
  return usuario?.rol_id === 1;
}

// RN-030b: la descripción es opcional y de máximo 500 caracteres
function validarDescripcion(descripcion) {
  if (descripcion === undefined || descripcion === null) return null;
  if (typeof descripcion !== 'string') return 'La descripción debe ser texto';
  const limpia = descripcion.trim();
  if (limpia === '') return null;
  if (limpia.length > 500) return 'La descripción no puede superar los 500 caracteres';
  return null;
}

// Errores de PostgreSQL que deben responder 400 en lugar de 500
function esErrorDeDatos(error) {
  return error.code === '22003' || error.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }
  console.error('[Especialidades] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

async function listar(req, res) {
  try {
    // RN-031: solo el admin puede ver también las inactivas
    const incluirInactivas = req.query.todas === 'true' && esAdmin(req.usuario);
    const data = await repo.listar({ incluirInactivas });
    return res.json({ ok: true, mensaje: 'Lista de especialidades', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener especialidades', error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'smallint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const data = await repo.obtenerPorId(id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({ ok: true, mensaje: 'Especialidad encontrada', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener especialidad', error);
  }
}

async function crear(req, res) {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'nombre es requerido' });
    }

    // RN-030b: la descripción es opcional y de máximo 500 caracteres
    if (descripcion !== undefined && descripcion !== null) {
      if (typeof descripcion !== 'string') {
        return res.status(400).json({ ok: false, mensaje: 'La descripción debe ser texto' });
      }
      const limpia = descripcion.trim().replace(/\s+/g, ' ');
      if (limpia.length > 500) {
        return res.status(400).json({ ok: false, mensaje: 'La descripción no puede superar los 500 caracteres' });
      }
    }

    const caso = new CrearEspecialidad(repo);
    const data = await caso.execute(nombre, descripcion);
    return res.status(201).json({ ok: true, mensaje: 'Especialidad creada correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al crear especialidad', error);
  }
}

async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id, 'smallint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { nombre, descripcion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'nombre es requerido y no puede estar vacío' });
    }

    // RN-030b: la descripción es opcional y de máximo 500 caracteres
    if (descripcion !== undefined && descripcion !== null) {
      if (typeof descripcion !== 'string') {
        return res.status(400).json({ ok: false, mensaje: 'La descripción debe ser texto' });
      }
      const limpia = descripcion.trim().replace(/\s+/g, ' ');
      if (limpia.length > 500) {
        return res.status(400).json({ ok: false, mensaje: 'La descripción no puede superar los 500 caracteres' });
      }
    }

    const caso = new ActualizarEspecialidad(repo);
    const data = await caso.execute(id, { nombre, descripcion });

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }

    return res.json({ ok: true, mensaje: 'Especialidad actualizada correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al actualizar especialidad', error);
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = validarId(req.params.id, 'smallint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
    }

    const caso = new CambiarEstadoEspecialidad(repo);
    const data = await caso.execute(id, activo);

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }

    return res.json({
      ok: true,
      mensaje: activo ? 'Especialidad activada' : 'Especialidad desactivada',
      data
    });
  } catch (error) {
    return respuestaError500(res, 'Error al cambiar el estado', error);
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
