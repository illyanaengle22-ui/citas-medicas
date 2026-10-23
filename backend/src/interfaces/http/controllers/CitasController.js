'use strict';

const PostgresCitaRepository = require('../../../infrastructure/adapters/PostgresCitaRepository');
const PostgresHorarioRepository = require('../../../infrastructure/adapters/PostgresHorarioRepository');
const AgendarCita = require('../../../application/use-cases/AgendarCita');
const ConfirmarCita = require('../../../application/use-cases/ConfirmarCita');
const CancelarCita = require('../../../application/use-cases/CancelarCita');
const ReagendarCita = require('../../../application/use-cases/ReagendarCita');
const MarcarAsistencia = require('../../../application/use-cases/MarcarAsistencia');
const TraslapeError = require('../../../domain/value-objects/TraslapeError');
const validarId = require('../utils/validarId');
const {
  esAdmin,
  rolClave,
  medicoIdDeUsuario,
  pacienteIdDeUsuario,
} = require('../utils/identidad');
const { esFechaISO } = require('../utils/rangoFechas');

const citasRepo = new PostgresCitaRepository();
const horariosRepo = new PostgresHorarioRepository();

// RN-113: los catálogos se referencian por clave, no por id numérico fijo.
const ESTADOS_VALIDOS = ['pendiente', 'confirmada', 'reagendada', 'cancelada', 'completada', 'no_asistio'];

function esErrorDeDatos(error) {
  return error?.code === '22003' || error?.code === '22P02';
}

function respuestaError500(res, mensaje, error) {
  if (esErrorDeDatos(error)) {
    return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
  }
  console.error('[Citas] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

// Resuelve el id de la tabla `medicos` o `pacientes` del token, según el rol.
async function idsDelActor(req, res) {
  const rol = rolClave(req.usuario);
  if (rol === 'medico') {
    const medicoId = await medicoIdDeUsuario(req.usuario.id);
    if (!medicoId) {
      res.status(403).json({ ok: false, mensaje: 'No tienes un registro de médico' });
      return null;
    }
    return { rol, medicoId, pacienteId: null };
  }
  if (rol === 'paciente') {
    const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
    if (!pacienteId) {
      res.status(403).json({ ok: false, mensaje: 'No tienes un registro de paciente' });
      return null;
    }
    return { rol, medicoId: null, pacienteId };
  }
  return { rol: 'admin', medicoId: null, pacienteId: null };
}

// RN-053 / matriz: el paciente ve solo las suyas, el médico las suyas, el admin todas.
// Devuelve null cuando el token no tiene el registro correspondiente (ya respondió 403).
async function visibilidadFiltro(req) {
  const rol = rolClave(req.usuario);
  if (rol === 'paciente') {
    const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
    if (!pacienteId) return null;
    return { paciente_id: pacienteId };
  }
  if (rol === 'medico') {
    const medicoId = await medicoIdDeUsuario(req.usuario.id);
    if (!medicoId) return null;
    return { medico_id: medicoId };
  }
  return {};
}

// Comprueba que el token puede tocar la cita (dueño, médico de la cita o admin).
async function exigirAccesoCita(req, res, cita) {
  if (esAdmin(req.usuario)) return true;
  const rol = rolClave(req.usuario);
  if (rol === 'paciente') {
    const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
    if (pacienteId && Number(pacienteId) === Number(cita.paciente_id)) return true;
  }
  if (rol === 'medico') {
    const medicoId = await medicoIdDeUsuario(req.usuario.id);
    if (medicoId && Number(medicoId) === Number(cita.medico_id)) return true;
  }
  res.status(403).json({ ok: false, mensaje: 'No tienes permiso sobre esta cita [RN-053]' });
  return false;
}

function formatearCita(row) {
  return {
    id: row.id,
    uuid_publico: row.uuid_publico,
    paciente_id: row.paciente_id,
    medico_id: row.medico_id,
    consultorio_id: row.consultorio_id,
    fecha_hora: row.fecha_hora,
    duracion_minutos: row.duracion_minutos,
    fecha_fin: row.fecha_fin,
    estado_id: row.estado_id,
    estado: row.estado,
    motivo: row.motivo,
    notas: row.notas,
    paciente_nombre: row.paciente_nombre ?? null,
    medico_nombre: row.medico_nombre ? `Dr. ${row.medico_nombre}` : null,
    consultorio_nombre: row.consultorio_nombre ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/citas — listado filtrado por rol + filtros de estado/fechas/paginación.
async function listar(req, res) {
  try {
    const base = await visibilidadFiltro(req);
    if (!base) return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para ver citas' });

    const filtros = { ...base };

    // Filtros adicionales: estado, fechas y paginación.
    if (req.query.estado !== undefined) {
      const estado = String(req.query.estado).trim().toLowerCase();
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({
          ok: false,
          mensaje: `estado inválido; use: ${ESTADOS_VALIDOS.join(', ')}`,
        });
      }
      filtros.estado = estado;
    }
    if (req.query.fecha_desde !== undefined) {
      if (!esFechaISO(req.query.fecha_desde)) {
        return res.status(400).json({ ok: false, mensaje: 'fecha_desde debe ser YYYY-MM-DD' });
      }
      filtros.fecha_desde = `${req.query.fecha_desde}T00:00:00`;
    }
    if (req.query.fecha_hasta !== undefined) {
      if (!esFechaISO(req.query.fecha_hasta)) {
        return res.status(400).json({ ok: false, mensaje: 'fecha_hasta debe ser YYYY-MM-DD' });
      }
      // Día completo inclusivo.
      filtros.fecha_hasta = `${req.query.fecha_hasta}T23:59:59.999`;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    filtros.page = page;
    filtros.limit = limit;

    const resultado = await citasRepo.listar(filtros);
    return res.json({
      ok: true,
      mensaje: 'Lista de citas',
      data: {
        citas: resultado.data.map(formatearCita),
        total: resultado.total,
        page: resultado.page,
        limit: resultado.limit,
      },
    });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener citas', error);
  }
}

// GET /api/citas/mis-pacientes — solo médico: pacientes distintos de su agenda.
async function misPacientes(req, res) {
  try {
    const medicoId = await medicoIdDeUsuario(req.usuario.id);
    if (!medicoId) return res.status(403).json({ ok: false, mensaje: 'No tienes un registro de médico' });
    const data = await citasRepo.pacientesDelMedico(medicoId);
    return res.json({ ok: true, mensaje: 'Pacientes de tu agenda', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener pacientes', error);
  }
}

// GET /api/citas/:id
async function obtenerPorId(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });

    if (!(await exigirAccesoCita(req, res, cita))) return;
    return res.json({ ok: true, mensaje: 'Cita encontrada', data: formatearCita(cita) });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener cita', error);
  }
}

// POST /api/citas — paciente agenda para sí mismo; admin puede agendar por un paciente.
async function crear(req, res) {
  try {
    const datos = req.citaValidada;
    const actor = await idsDelActor(req, res);
    if (!actor) return; // la respuesta ya fue enviada

    let pacienteId = datos.paciente_id ?? null;
    if (actor.rol === 'paciente') {
      // RN-053: un paciente siempre agenda para sí mismo.
      pacienteId = actor.pacienteId;
    } else if (actor.rol === 'medico') {
      return res.status(403).json({ ok: false, mensaje: 'Un médico no puede agendar citas' });
    } else if (!pacienteId) {
      return res.status(400).json({ ok: false, mensaje: 'paciente_id es requerido para agendar en nombre de un paciente' });
    }

    const caso = new AgendarCita(citasRepo, horariosRepo);
    const resultado = await caso.execute({
      paciente_id: pacienteId,
      medico_id: datos.medico_id,
      consultorio_id: datos.consultorio_id,
      fecha_hora: datos.fecha_hora,
      duracion_minutos: datos.duracion_minutos,
      motivo: datos.motivo,
      notas: datos.notas,
    });

    if (!resultado.success) {
      const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
      return res.status(conflicto ? 409 : 400).json({ ok: false, mensaje: resultado.mensaje });
    }
    const creada = await citasRepo.obtenerPorId(resultado.data.id);
    return res.status(201).json({
      ok: true,
      mensaje: resultado.mensaje,
      data: creada ? formatearCita(creada) : resultado.data,
    });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al agendar cita', error);
  }
}

// PUT /api/citas/:id/confirmar — RN-080: pendiente/reagendada → confirmada.
async function confirmar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const caso = new ConfirmarCita(citasRepo);
    const resultado = await caso.execute(id);
    if (!resultado.success) {
      const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
      return res.status(conflicto ? 409 : 400).json({ ok: false, mensaje: resultado.mensaje });
    }
    const actualizada = await citasRepo.obtenerPorId(id);
    return res.json({
      ok: true,
      mensaje: resultado.mensaje,
      data: actualizada ? formatearCita(actualizada) : resultado.data,
    });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al confirmar cita', error);
  }
}

// PUT /api/citas/:id/estado — cancelar (paciente/médico/admin) o marcar asistencia (médico/admin).
//   body: { estado: 'cancelada' | 'completada' | 'no_asistio', ignorarPlazo?: boolean }
async function cambiarEstado(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const { estado, ignorarPlazo } = req.cambioEstado;
    const actor = { rol: rolClave(req.usuario), medicoId: await medicoIdDeUsuario(req.usuario.id) };

    let resultado;
    if (estado === 'cancelada') {
      const caso = new CancelarCita(citasRepo);
      resultado = await caso.execute(id, { ignorarPlazo: ignorarPlazo && esAdmin(req.usuario) });
    } else if (estado === 'completada' || estado === 'no_asistio') {
      const caso = new MarcarAsistencia(citasRepo);
      resultado = await caso.execute(id, { asistio: estado === 'completada', actor });
    } else {
      return res.status(400).json({
        ok: false,
        mensaje: `Use PUT /citas/${id}/confirmar para confirmar; el estado "${estado}" no se aplica por aquí`,
      });
    }

    if (!resultado.success) {
      const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
      return res.status(conflicto ? 409 : 400).json({ ok: false, mensaje: resultado.mensaje });
    }
    const actualizada = await citasRepo.obtenerPorId(id);
    return res.json({
      ok: true,
      mensaje: resultado.mensaje,
      data: actualizada ? formatearCita(actualizada) : resultado.data,
    });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al cambiar el estado de la cita', error);
  }
}

// PUT /api/citas/:id — reagendar: { fecha_hora } (RN-083/RN-084).
async function reagendar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const caso = new ReagendarCita(citasRepo, horariosRepo);
    const resultado = await caso.execute(id, { fecha_hora: req.reagendamiento.fecha_hora });
    if (!resultado.success) {
      const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
      return res.status(conflicto ? 409 : 400).json({ ok: false, mensaje: resultado.mensaje });
    }
    const actualizada = await citasRepo.obtenerPorId(id);
    return res.json({
      ok: true,
      mensaje: resultado.mensaje,
      data: actualizada ? formatearCita(actualizada) : resultado.data,
    });
  } catch (error) {
    if (error instanceof TraslapeError) {
      return res.status(409).json({ ok: false, mensaje: error.message });
    }
    return respuestaError500(res, 'Error al reagendar cita', error);
  }
}

// GET /api/citas/:id/propuestas — los 3 horarios libres más cercanos (RN-083).
async function propuestasReagendamiento(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const caso = new ReagendarCita(citasRepo, horariosRepo);
    const resultado = await caso.proponerHorarios(id);
    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    return respuestaError500(res, 'Error al proponer horarios', error);
  }
}

// DELETE /api/citas/:id — RN-087: nunca borrado físico; se cancela la cita.
async function eliminar(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const caso = new CancelarCita(citasRepo);
    const ignorarPlazo = req.query.ignorarPlazo === 'true' && esAdmin(req.usuario);
    const resultado = await caso.execute(id, { ignorarPlazo });
    if (!resultado.success) {
      const conflicto = /traslap|ocupad/i.test(resultado.mensaje);
      return res.status(conflicto ? 409 : 400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje, data: { id } });
  } catch (error) {
    return respuestaError500(res, 'Error al cancelar cita', error);
  }
}

// GET /api/citas/:id/historial — RN-090: historial de estados de la cita.
async function historial(req, res) {
  try {
    const id = validarId(req.params.id, 'bigint');
    if (!id) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citasRepo.obtenerPorId(id);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });
    if (!(await exigirAccesoCita(req, res, cita))) return;

    const data = await citasRepo.listarHistorial(id);
    return res.json({ ok: true, mensaje: 'Historial de la cita', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener historial', error);
  }
}

module.exports = {
  listar,
  misPacientes,
  obtenerPorId,
  crear,
  confirmar,
  cambiarEstado,
  reagendar,
  propuestasReagendamiento,
  eliminar,
  historial,
};
