'use strict';

const Cita = require('../../domain/entities/Cita');
const EstadoCita = require('../../domain/value-objects/EstadoCita');

// RN-082: marcar asistencia (completada / no_asistio) solo corresponde al
// médico de la cita o a un administrador.
// Regla de completada: el médico puede marcarla desde 5 minutos antes del
// inicio; el administrador no tiene restricción de horario.
class MarcarAsistencia {
  constructor(citaRepository) {
    this.repo = citaRepository;
  }

  // actor: { rol, medicoId } — el controlador (FASE 4) resuelve el médico
  // del token para poder compararlo con el médico de la cita.
  async execute(id, { asistio, actor = {} } = {}) {
    const row = await this.repo.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }

    // RN-082: solo el médico de la cita o un administrador
    if (actor.rol !== 'admin') {
      const esElMedico = actor.medicoId != null && Number(actor.medicoId) === Number(row.medico_id);
      if (!esElMedico) {
        return { success: false, mensaje: 'Solo el médico de la cita o un administrador pueden marcar la asistencia [RN-082]' };
      }
    }

    const cita = Cita.fromRow(row);
    const inicioMs = new Date(cita.fecha_hora).getTime();
    const ahoraMs = Date.now();
    const toleranciaMs = 5 * 60 * 1000;

    if (asistio) {
      // El admin puede completar sin restricciones. El médico solo desde
      // 5 minutos antes de la hora de inicio.
      const dentroDeTolerancia = Number.isFinite(inicioMs) && ahoraMs >= inicioMs - toleranciaMs;
      if (actor.rol !== 'admin' && !dentroDeTolerancia) {
        return { success: false, mensaje: 'No puedes completar una cita que aún no ha comenzado' };
      }
    } else if (!Number.isFinite(inicioMs) || ahoraMs < inicioMs) {
      // RN-082: no_asistio sigue requiriendo que haya llegado la hora de inicio.
      return { success: false, mensaje: 'Aún no es la hora de inicio de la cita [RN-082]' };
    }

    const destino = EstadoCita.fromClave(asistio ? 'completada' : 'no_asistio');

    if (!cita.puedeTransicionarA(destino)) {
      if (cita.estado.esFinal()) {
        return { success: false, mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
      }
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "${destino.clave}" [RN-080]` };
    }

    const data = await this.repo.cambiarEstado(id, destino.id);
    return { success: true, data, mensaje: `Cita marcada como "${destino.clave}"` };
  }
}

module.exports = MarcarAsistencia;
