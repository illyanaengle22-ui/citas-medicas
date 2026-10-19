'use strict';

const {
  PostgresConsultorioRepository,
  DuplicadoError,
  CitasPendientesError,
} = require('../../../infrastructure/adapters/PostgresConsultorioRepository');
const CrearConsultorio = require('../../../application/use-cases/CrearConsultorio');
const ActualizarConsultorio = require('../../../application/use-cases/ActualizarConsultorio');
const CambiarEstadoConsultorio = require('../../../application/use-cases/CambiarEstadoConsultorio');
const EliminarConsultorio = require('../../../application/use-cases/EliminarConsultorio');
const validarId = require('../utils/validarId');

const repo = new PostgresConsultorioRepository();

function esAdmin(usuario) {
  return usuario?.rol_id === 1;
}

// RN-032: nombre y dirección son obligatorios (no vacíos tras recortar).
function validarTextoObligatorio(valor, campo) {
  if (valor === undefined || valor === null || typeof valor !== 'string' || valor.trim() === '') {
    return `El campo ${campo} es requerido`;
  }
  return null;
}

// Teléfono opcional: se guardan solo dígitos (sin guiones, espacios ni
// paréntesis) y debe tener entre 7 y 15 dígitos.
function validarTelefono(telefono) {
  if (telefono === undefined || telefono === null || telefono === '') return null;
  if (typeof telefono !== 'string' && typeof telefono !== 'number') {
    return 'El teléfono debe ser texto';
  }
  const soloDigitos = String(telefono).replace(/[\s\-()]/g, '');
  if (soloDigitos === '') return null;
  if (!/^[0-9]{7,15}$/.test(soloDigitos)) {
    return 'El teléfono debe tener entre 7 y 15 dígitos';
  }
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
  console.error('[Consultorios] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

async function listar(req, res) {
  try {
    // RN-034: listar está permitido a cualquier usuario autenticado.
    // Solo el admin puede incluir inactivos con ?todos=true.
    const incluirInactivos = req.query.todos === 'true' && esAdmin(req.usuario);
    const data = await repo.listar({ incluirInactivos, q: req.query.q });
    return res.json({ ok: true, mensaje: 'Lista de consultorios', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener consultorios', error);
  }
}

async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }
    const data = await repo.obtenerPorId(id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio encontrado', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener consultorio', error);
  }
}

async function crear(req, res) {
  try {
    const { nombre, direccion, telefono } = req.body || {};

    const errorNombre = validarTextoObligatorio(nombre, 'nombre');
    if (errorNombre) return res.status(400).json({ ok: false, mensaje: errorNombre });

    const errorDireccion = validarTextoObligatorio(direccion, 'direccion');
    if (errorDireccion) return res.status(400).json({ ok: false, mensaje: errorDireccion });

    const errorTelefono = validarTelefono(telefono);
    if (errorTelefono) return res.status(400).json({ ok: false, mensaje: errorTelefono });

    const caso = new CrearConsultorio(repo);
    const data = await caso.execute({ nombre, direccion, telefono });
    return res.status(201).json({ ok: true, mensaje: 'Consultorio creado correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al crear consultorio', error);
  }
}

async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { nombre, direccion, telefono } = req.body || {};

    const errorNombre = validarTextoObligatorio(nombre, 'nombre');
    if (errorNombre) return res.status(400).json({ ok: false, mensaje: errorNombre });

    const errorDireccion = validarTextoObligatorio(direccion, 'direccion');
    if (errorDireccion) return res.status(400).json({ ok: false, mensaje: errorDireccion });

    const errorTelefono = validarTelefono(telefono);
    if (errorTelefono) return res.status(400).json({ ok: false, mensaje: errorTelefono });

    const caso = new ActualizarConsultorio(repo);
    const data = await caso.execute(id, { nombre, direccion, telefono });

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio actualizado correctamente', data });
  } catch (error) {
    if (error instanceof DuplicadoError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al actualizar consultorio', error);
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const { activo } = req.body || {};
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
    }

    const caso = new CambiarEstadoConsultorio(repo);
    const data = await caso.execute(id, activo);

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }

    return res.json({
      ok: true,
      mensaje: activo ? 'Consultorio activado' : 'Consultorio desactivado',
      data,
    });
  } catch (error) {
    return respuestaError500(res, 'Error al cambiar el estado', error);
  }
}

async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    }

    const caso = new EliminarConsultorio(repo);
    const data = await caso.execute(id);

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Consultorio no encontrado' });
    }
    return res.json({ ok: true, mensaje: 'Consultorio eliminado correctamente', data });
  } catch (error) {
    if (error instanceof CitasPendientesError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al eliminar consultorio', error);
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };
