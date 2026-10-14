'use strict';

const { PostgresEspecialidadRepository, DuplicadoError } = require('../../../infrastructure/adapters/PostgresEspecialidadRepository');
const CrearEspecialidad = require('../../../application/use-cases/CrearEspecialidad');
const ActualizarEspecialidad = require('../../../application/use-cases/ActualizarEspecialidad');

const repo = new PostgresEspecialidadRepository();
module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };

async function listar(req, res) {
  try {
    // RN-031: solo el admin puede ver también las inactivas
    const incluirInactivas = req.query.todas === 'true' && esAdmin(req.usuario);
    const data = await repo.listar({ incluirInactivas });
    return res.json({ ok: true, mensaje: 'Lista de especialidades', data });
  } catch (error) {
    console.error('[Especialidades] Error en listar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener especialidades' });
  }
}

async function obtenerPorId(req, res) {
  try {
    const data = await repo.obtenerPorId(parseInt(req.params.id));
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({ ok: true, mensaje: 'Especialidad encontrada', data });
  } catch (error) {
    console.error('[Especialidades] Error en obtenerPorId:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener especialidad', error: error.message });
  }
}

async function crear(req, res) {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ ok: false, mensaje: 'nombre es requerido' });
    }

    const caso = new CrearEspecialidad(repo);
    const data = await caso.execute(nombre);
    return res.status(201).json({ ok: true, mensaje: 'Especialidad creada correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    console.error('[Especialidades] Error en crear:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear especialidad', error: error.message });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;

    const caso = new ActualizarEspecialidad(repo);
    const data = await caso.execute(parseInt(id), { nombre, activo });

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }

    return res.json({ ok: true, mensaje: 'Especialidad actualizada correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    console.error('[Especialidades] Error en actualizar:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar especialidad', error: error.message });
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { activo } = req.body;
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
    }
    const esp = await repo.cambiarEstado(id, activo);
    if (!esp) {
      return res.status(404).json({ ok: false, mensaje: 'Especialidad no encontrada' });
    }
    return res.json({
      ok: true,
      mensaje: activo ? 'Especialidad activada' : 'Especialidad desactivada',
      data: esp
    });
  } catch (error) {
    console.error('[Especialidades] Error en cambiarEstado:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al cambiar el estado' });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
