'use strict';

const validarId = require('../utils/validarId');

// Validación del body de citas ANTES de llegar al caso de uso (RN-122: 400).
// Las reglas de negocio (duración, traslapes, horario activo, pasado) viven en
// domain/application; aquí solo se normaliza y se rechaza lo malformado.

const DURACION_MIN = 10;   // RN-071
const DURACION_MAX = 240;  // RN-071
const DURACION_DEFECTO = 30;
const MAX_TEXTO = 1000;

function responder400(res, mensaje) {
  return res.status(400).json({ ok: false, mensaje });
}

function normalizarTexto(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') return { error: 'Debe ser texto' };
  const limpio = valor.trim();
  if (limpio === '') return null;
  if (limpio.length > MAX_TEXTO) return { error: `Máximo ${MAX_TEXTO} caracteres` };
  return limpio;
}

// Acepta ISO completo ('2026-10-23T15:00:00.000Z' | '...-06:00' | '2026-10-23 15:00')
// y lo devuelve como string ISO de UTC para que la BD lo reciba como TIMESTAMPTZ.
function normalizarFechaHora(valor) {
  if (typeof valor !== 'string' && !(valor instanceof Date)) {
    return { error: 'La fecha y hora deben enviarse como texto ISO 8601 (YYYY-MM-DDTHH:mm:ss)' };
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'La fecha y hora no son válidas' };
  }
  return { fechaISO: fecha.toISOString() };
}

function normalizarDuracion(valor) {
  if (valor === undefined || valor === null || valor === '') return DURACION_DEFECTO;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < DURACION_MIN || numero > DURACION_MAX) {
    return { error: `La duración debe ser un número entero entre ${DURACION_MIN} y ${DURACION_MAX} minutos [RN-071]` };
  }
  return { duracion: numero };
}

// POST /api/citas — cuerpo de creación.
function validarCreacionCita(req, res, next) {
  const body = req.body || {};

  const medicoId = validarId(body.medico_id, 'bigint');
  if (!medicoId) return responder400(res, 'medico_id inválido o ausente');

  const consultorioId = validarId(body.consultorio_id, 'bigint');
  if (!consultorioId) return responder400(res, 'consultorio_id inválido o ausente');

  const fecha = normalizarFechaHora(body.fecha_hora);
  if (fecha.error) return responder400(res, fecha.error);

  const duracion = normalizarDuracion(body.duracion_minutos);
  if (duracion.error) return responder400(res, duracion.error);

  const motivo = normalizarTexto(body.motivo);
  if (motivo && motivo.error) return responder400(res, `motivo: ${motivo.error}`);

  const notas = normalizarTexto(body.notas);
  if (notas && notas.error) return responder400(res, `notas: ${notas.error}`);

  req.citaValidada = {
    medico_id: medicoId,
    consultorio_id: consultorioId,
    fecha_hora: fecha.fechaISO,
    duracion_minutos: duracion.duracion,
    motivo: motivo || null,
    notas: notas || null,
  };
  // Solo un admin puede agendar en nombre de otro paciente (RN-053).
  if (body.paciente_id !== undefined && body.paciente_id !== null && body.paciente_id !== '') {
    const pacienteId = validarId(body.paciente_id, 'bigint');
    if (!pacienteId) return responder400(res, 'paciente_id inválido');
    req.citaValidada.paciente_id = pacienteId;
  }

  next();
}

// PUT /api/citas/:id — reagendamiento.
function validarReagendamiento(req, res, next) {
  const body = req.body || {};
  const fecha = normalizarFechaHora(body.fecha_hora);
  if (fecha.error) return responder400(res, fecha.error);

  req.reagendamiento = { fecha_hora: fecha.fechaISO };
  next();
}

// PUT /api/citas/:id/estado — cambio de estado genérico.
function validarCambioEstado(req, res, next) {
  const body = req.body || {};
  const estado = typeof body.estado === 'string' ? body.estado.trim().toLowerCase() : '';
  const permitidos = ['cancelada', 'completada', 'no_asistio', 'confirmada', 'reagendada'];
  if (!permitidos.includes(estado)) {
    return responder400(res, `"estado" debe ser uno de: ${permitidos.join(', ')}`);
  }
  req.cambioEstado = { estado, ignorarPlazo: body.ignorarPlazo === true };
  next();
}

module.exports = {
  validarCreacionCita,
  validarReagendamiento,
  validarCambioEstado,
};
