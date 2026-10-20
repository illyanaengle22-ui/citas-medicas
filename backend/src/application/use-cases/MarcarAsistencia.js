'use strict';

const Cita = require('../../domain/entities/Cita');
const EstadoCita = require('../../domain/value-objects/EstadoCita');

// RN-082: marcar asistencia (completada / no_asistio) solo corresponde al
// médico de la cita o a un administrador, y solo a partir de la hora de inicio.
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

    // RN-082: recién a partir de la hora de inicio
    if (Date.now() < new Date(row.fecha_hora).getTime()) {
      return { success: false, mensaje: 'Aún no es la hora de inicio de la cita [RN-082]' };
    }

    const destino = EstadoCita.fromClave(asistio ? 'completada' : 'no_asistio');
    const cita = Cita.fromRow(row);

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
