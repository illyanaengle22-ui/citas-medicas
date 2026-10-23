'use strict';

const PostgresHorarioRepository = require('../../../infrastructure/adapters/PostgresHorarioRepository');
const RegistrarHorario = require('../../../application/use-cases/RegistrarHorario');
const EliminarHorario = require('../../../application/use-cases/EliminarHorario');
const ListarHorariosDisponibles = require('../../../application/use-cases/ListarHorariosDisponibles');
const TraslapeError = require('../../../domain/value-objects/TraslapeError');
const Horario = require('../../../domain/entities/Horario');
const validarId = require('../utils/validarId');
const {
  esAdmin,
  medicoIdDeUsuario,
  medicoTieneConsultorio,
} = require('../utils/identidad');

const repo = new PostgresHorarioRepository();

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esErrorDeDatos(error) {
  return error?.code === '22003' || error?.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }
  console.error('[Horarios] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

// 'HH:MM' | 'HH:MM:SS' → 'HH:MM:Postgres'
function normalizarHora(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  if (!RE_HORA.test(limpio)) return null;
  return limpio.length === 5 ? `${limpio}:00` : limpio;
}

function validarCuerpo(body = {}) {
  const medicoId = validarId(body.medico_id, 'bigint');
  if (!medicoId) return { error: 'medico_id inválido o ausente' };

  const consultorioId = validarId(body.consultorio_id, 'bigint');
  if (!consultorioId) return { error: 'consultorio_id inválido o ausente' };

  const dia = Number(body.dia_semana);
  if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
    return { error: 'dia_semana debe ser 1 (lunes) a 7 (domingo) [RN-060]' };
  }

  const horaInicio = normalizarHora(body.hora_inicio);
  if (!horaInicio) return { error: 'hora_inicio inválida; use HH:MM o HH:MM:SS' };

  const horaFin = normalizarHora(body.hora_fin);
  if (!horaFin) return { error: 'hora_fin inválida; use HH:MM o HH:MM:SS' };

  // RN-061: la hora de fin debe ser posterior a la de inicio.
  if (horaFin <= horaInicio) {
    return { error: 'La hora de fin debe ser posterior a la hora de inicio [RN-061]' };
  }

  return { datos: { medico_id: medicoId, consultorio_id: consultorioId, dia_semana: dia, hora_inicio: horaInicio, hora_fin: horaFin } };
}

// Un médico solo gestiona sus propios horarios (matriz de permisos).
async function exigirPropietario(req, res, horario) {
  if (esAdmin(req.usuario)) return true;
  const medicoId = await medicoIdDeUsuario(req.usuario.id);
  if (!medicoId || Number(medicoId) !== Number(horario.medico_id)) {
    res.status(403).json({ ok: false, mensaje: 'No tienes permiso para gestionar este horario' });
    return false;
  }
  return true;
}

// GET /api/horarios — admin: todos (?todos=true incluye inactivos, ?medico= filtra);
// médico: solo los suyos.
async function listar(req, res) {
  try {
    let medicoId = null;
    if (esAdmin(req.usuario)) {
      if (req.query.medico !== undefined) {
        medicoId = validarId(req.query.medico, 'bigint');
        if (!medicoId) return res.status(400).json({ ok: false, mensaje: 'ID de médico inválido' });
      }
    } else {
      medicoId = await medicoIdDeUsuario(req.usuario.id);
      if (!medicoId) return res.status(403).json({ ok: false, mensaje: 'No tienes un registro de médico' });
    }

    const incluirInactivos = req.query.todos === 'true' && esAdmin(req.usuario);
    const data = await repo.listar({ medico_id: medicoId, incluirInactivos });
    return res.json({ ok: true, mensaje: 'Horarios del médico', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener horarios', error);
  }
}

// GET /api/horarios/medico/:idMedico — bloques del médico; con
// ?fecha=YYYY-MM-DD&duracion_minutos=N devuelve los huecos libres del día (RN-065).
async function listarPorMedico(req, res) {
  try {
    const medicoId = validarId(req.params.idMedico, 'bigint');
    if (!medicoId) return res.status(400).json({ ok: false, mensaje: 'ID de médico inválido' });

    const { fecha, duracion_minutos, consultorio_id } = req.query;

    if (fecha !== undefined || duracion_minutos !== undefined) {
      if (fecha !== undefined && !RE_FECHA.test(String(fecha))) {
        return res.status(400).json({ ok: false, mensaje: 'fecha debe tener el formato YYYY-MM-DD' });
      }
      const duracion = Number(duracion_minutos);
      if (!Number.isInteger(duracion) || duracion < 10 || duracion > 240) {
        return res.status(400).json({ ok: false, mensaje: 'duracion_minutos debe ser un entero entre 10 y 240 [RN-071]' });
      }
      let consultorioId = null;
      if (consultorio_id !== undefined) {
        consultorioId = validarId(consultorio_id, 'bigint');
        if (!consultorioId) return res.status(400).json({ ok: false, mensaje: 'consultorio_id inválido' });
      }
      const caso = new ListarHorariosDisponibles(repo);
      const resultado = await caso.execute({
        medico_id: medicoId,
        fecha,
        duracion_minutos: duracion,
        consultorio_id: consultorioId,
      });
      return res.json({ ok: true, mensaje: 'Huecos disponibles', data: resultado.data });
    }

    // Solo el admin o el propio médico pueden ver bloques inactivos.
    const esPropio = !esAdmin(req.usuario)
      ? String((await medicoIdDeUsuario(req.usuario.id)) ?? '') === String(medicoId)
      : true;
    const incluirInactivos = req.query.todos === 'true' && (esAdmin(req.usuario) || esPropio);
    const data = await repo.listarPorMedico(medicoId, { soloActivos: !incluirInactivos });
    return res.json({ ok: true, mensaje: 'Bloques del médico', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener horarios del médico', error);
  }
}

// GET /api/horarios/:id
async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const data = await repo.obtenerPorId(id);
    if (!data) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });
    return res.json({ ok: true, mensaje: 'Horario encontrado', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener horario', error);
  }
}

// POST /api/horarios — admin (cualquier médico) o médico (solo el suyo).
async function crear(req, res) {
  try {
    const validado = validarCuerpo(req.body);
    if (validado.error) return res.status(400).json({ ok: false, mensaje: validado.error });
    const datos = validado.datos;

    if (!esAdmin(req.usuario)) {
      const medicoId = await medicoIdDeUsuario(req.usuario.id);
      if (!medicoId) return res.status(403).json({ ok: false, mensaje: 'No tienes un registro de médico' });
      // Un médico solo crea horarios para sí mismo.
      if (Number(datos.medico_id) !== Number(medicoId)) {
        return res.status(403).json({ ok: false, mensaje: 'Solo puedes crear horarios para ti mismo' });
      }
    }

    // RN-063: el consultorio debe estar asignado al médico.
    const asignado = await medicoTieneConsultorio(datos.medico_id, datos.consultorio_id);
    if (!asignado) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El médico no está asignado a ese consultorio [RN-063]',
      });
    }

    const caso = new RegistrarHorario(repo);
    const resultado = await caso.execute(datos);

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.status(201).json({
      ok: true,
      mensaje: resultado.mensaje,
      data: resultado.data,
    });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al crear horario', error);
  }
}

// PUT /api/horarios/:id — admin o el médico dueño.
async function actualizar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const existente = await repo.obtenerPorId(id);
    if (!existente) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });

    if (!(await exigirPropietario(req, res, existente))) return;

    const validado = validarCuerpo(req.body);
    if (validado.error) return res.status(400).json({ ok: false, mensaje: validado.error });
    const datos = validado.datos;

    const asignado = await medicoTieneConsultorio(datos.medico_id, datos.consultorio_id);
    if (!asignado) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El médico no está asignado a ese consultorio [RN-063]',
      });
    }

    // RN-062: pre-check de traslape excluyendo el propio horario.
    const traslape = await repo.existeTraslape({
      medico_id: datos.medico_id,
      dia_semana: datos.dia_semana,
      hora_inicio: datos.hora_inicio,
      hora_fin: datos.hora_fin,
      excluirId: id,
    });
    if (traslape) {
      return res.status(409).json({
        ok: false,
        mensaje: 'El médico ya tiene un bloque en ese día y horario que se traslapan [RN-062]',
      });
    }

    // Re-valida con la entidad por consistencia con el caso de creación.
    const resultado = Horario.fromRow({ ...existente, ...datos });
    try {
      resultado.validar();
    } catch (error) {
      return res.status(400).json({ ok: false, mensaje: error.message });
    }

    const data = await repo.actualizar(id, datos);
    return res.json({ ok: true, mensaje: 'Horario actualizado correctamente', data });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al actualizar horario', error);
  }
}

// PATCH /api/horarios/:id/estado — { activo: boolean }
async function cambiarEstado(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const existente = await repo.obtenerPorId(id);
    if (!existente) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });

    if (!(await exigirPropietario(req, res, existente))) return;

    const { activo } = req.body || {};
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: '"activo" debe ser true o false' });
    }

    const data = await repo.actualizar(id, { activo });
    return res.json({
      ok: true,
      mensaje: activo ? 'Horario activado' : 'Horario desactivado',
      data,
    });
  } catch (error) {
    return respuestaError500(res, 'Error al cambiar el estado', error);
  }
}

// DELETE /api/horarios/:id — RN-064: desactivar sin borrar; las citas agendadas no se tocan.
async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const existente = await repo.obtenerPorId(id);
    if (!existente) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });

    if (!(await exigirPropietario(req, res, existente))) return;

    const caso = new EliminarHorario(repo);
    const resultado = await caso.execute(id);

    if (!resultado.success) {
      return res.status(404).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    return respuestaError500(res, 'Error al desactivar horario', error);
  }
}

module.exports = { listar, listarPorMedico, obtenerPorId, crear, actualizar, cambiarEstado, eliminar };
