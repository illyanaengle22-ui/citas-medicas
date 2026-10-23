'use strict';

const PostgresRecordatorioRepository = require('../../../infrastructure/adapters/PostgresRecordatorioRepository');
const PostgresCitaRepository = require('../../../infrastructure/adapters/PostgresCitaRepository');
const PostgresHorarioRepository = require('../../../infrastructure/adapters/PostgresHorarioRepository');
const N8nNotificacionAdapter = require('../../../infrastructure/adapters/N8nNotificacionAdapter');
const EnviarRecordatorio = require('../../../application/use-cases/EnviarRecordatorio');
const ProcesarRespuestaTelegram = require('../../../application/use-cases/ProcesarRespuestaTelegram');
const Recordatorio = require('../../../domain/entities/Recordatorio');
const validarId = require('../utils/validarId');
const { esAdmin, rolClave, medicoIdDeUsuario, pacienteIdDeUsuario } = require('../utils/identidad');

const recordatorioRepo = new PostgresRecordatorioRepository();
const citaRepo = new PostgresCitaRepository();
const horarioRepo = new PostgresHorarioRepository();
const notificador = new N8nNotificacionAdapter();

function respuestaError500(res, mensaje, error) {
  console.error('[Recordatorios] Error:', error.message);
  return res.status(500).json({ ok: false, mensaje });
}

// uuid_publico es columna UUID de PostgreSQL: un valor mal formado haría
// fallar la consulta con 22P02, así que se valida aquí y se responde 400.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/recordatorios/enviar — dispara el ciclo de recordatorios (RN-100/RN-101).
//   body: { tipo?: '24h' | '2h' }   (por defecto '24h')
// Acceso: admin (lo usa el panel o el cron de n8n con token de servicio).
async function enviar(req, res) {
  try {
    const body = req.body || {};
    const tipo = body.tipo ?? Recordatorio.TIPOS.H24;

    const caso = new EnviarRecordatorio(recordatorioRepo, notificador);
    const resultado = await caso.execute({ tipo });

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data });
  } catch (error) {
    return respuestaError500(res, 'Error al enviar recordatorios', error);
  }
}

// POST /api/recordatorios/confirmar — el paciente responde a un recordatorio
//   (web o Telegram vía n8n): { uuidCita, respuesta: 'confirmar'|'cancelar'|'reagendar', recordatorioId?, chatId? }
async function confirmar(req, res) {
  try {
    const { uuidCita, respuesta, recordatorioId, chatId } = req.body || {};

    if (!uuidCita || typeof uuidCita !== 'string') {
      return res.status(400).json({ ok: false, mensaje: 'uuidCita es requerido' });
    }
    if (!RE_UUID.test(uuidCita)) {
      return res.status(400).json({ ok: false, mensaje: 'uuidCita no tiene un formato de UUID válido' });
    }
    if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
      return res.status(400).json({
        ok: false,
        mensaje: `respuesta inválida; use: ${Object.values(Recordatorio.RESPUESTAS).join(', ')}`,
      });
    }

    // RN-053: un paciente solo puede responder sobre sus propias citas.
    if (!esAdmin(req.usuario)) {
      const cita = await citaRepo.obtenerPorUuid(uuidCita);
      if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });

      const rol = rolClave(req.usuario);
      if (rol === 'paciente') {
        const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
        if (!pacienteId || Number(pacienteId) !== Number(cita.paciente_id)) {
          return res.status(403).json({ ok: false, mensaje: 'No tienes permiso sobre esta cita [RN-053]' });
        }
      } else if (rol === 'medico') {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        if (!medicoId || Number(medicoId) !== Number(cita.medico_id)) {
          return res.status(403).json({ ok: false, mensaje: 'No tienes permiso sobre esta cita [RN-053]' });
        }
      }
    }

    const caso = new ProcesarRespuestaTelegram(citaRepo, recordatorioRepo, horarioRepo);
    const resultado = await caso.execute({ chatId: chatId ?? null, uuidCita, respuesta, recordatorioId: recordatorioId ?? null });

    if (!resultado.success) {
      return res.status(400).json({ ok: false, mensaje: resultado.mensaje });
    }
    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data ?? null });
  } catch (error) {
    return respuestaError500(res, 'Error al procesar la respuesta', error);
  }
}

// GET /api/recordatorios/cita/:idCita — recordatorios de una cita (dueño/médico/admin).
async function listarPorCita(req, res) {
  try {
    const idCita = validarId(req.params.idCita, 'bigint');
    if (!idCita) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });

    const cita = await citaRepo.obtenerPorId(idCita);
    if (!cita) return res.status(404).json({ ok: false, mensaje: 'Cita no encontrada' });

    if (!esAdmin(req.usuario)) {
      const rol = rolClave(req.usuario);
      let puedeVer = false;
      if (rol === 'paciente') {
        const pacienteId = await pacienteIdDeUsuario(req.usuario.id);
        puedeVer = pacienteId && Number(pacienteId) === Number(cita.paciente_id);
      } else if (rol === 'medico') {
        const medicoId = await medicoIdDeUsuario(req.usuario.id);
        puedeVer = medicoId && Number(medicoId) === Number(cita.medico_id);
      }
      if (!puedeVer) {
        return res.status(403).json({ ok: false, mensaje: 'No tienes permiso sobre esta cita [RN-053]' });
      }
    }

    const data = await recordatorioRepo.listarPorCita(idCita);
    return res.json({ ok: true, mensaje: 'Recordatorios de la cita', data });
  } catch (error) {
    return respuestaError500(res, 'Error al obtener recordatorios', error);
  }
}

module.exports = { enviar, confirmar, listarPorCita };
