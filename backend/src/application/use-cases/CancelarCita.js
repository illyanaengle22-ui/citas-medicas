'use strict';

const Cita = require('../../domain/entities/Cita');
const EstadoCita = require('../../domain/value-objects/EstadoCita');

// RN-079 / RN-080: cualquier estado vigente -> cancelada.
// RN-085: al cancelar el horario queda libre de inmediato (el EXCLUDE de la
// BD solo cubre estados 1, 2 y 3, así que la cita deja de bloquear).
class CancelarCita {
  constructor(citaRepository) {
    this.repo = citaRepository;
  }

  // ignorarPlazo: solo un administrador puede saltarse el plazo (RN-086 🔶)
  async execute(id, { ignorarPlazo = false, anticipacionHoras = 2 } = {}) {
    const row = await this.repo.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }

    const cita = Cita.fromRow(row);
    const cancelada = EstadoCita.fromClave('cancelada');

    if (!cita.puedeTransicionarA(cancelada)) {
      if (cita.estado.esFinal()) {
        return { success: false, mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
      }
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
    }

    // RN-086 🔶: plazo mínimo de anticipación para cancelar
    if (!ignorarPlazo && cita.fueraDePlazoCancelacion(anticipacionHoras)) {
      return { success: false, mensaje: `Faltan menos de ${anticipacionHoras} horas para la cita; no es posible cancelarla [RN-086]` };
    }

    const data = await this.repo.cambiarEstado(id, cancelada.id);
    return { success: true, data, mensaje: 'Cita cancelada; el horario quedó libre [RN-085]' };
  }
}

module.exports = CancelarCita;
