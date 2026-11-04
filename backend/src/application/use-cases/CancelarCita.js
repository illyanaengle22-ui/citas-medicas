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

  // ignorarPlazo / rolId / actor: Administrador (rol_id = 1) no tiene restricciones de tiempo (RN-086 🔶)
  async execute(id, { ignorarPlazo = false, rolId = null, actor = {}, anticipacionHoras = 2, cambiadoPor = null, origen = 'web', comentario = null } = {}) {
    const row = await this.repo.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }

    const esAdmin = rolId === 1 || actor?.rol_id === 1 || actor?.rol === 'admin' || Boolean(ignorarPlazo);

    const cita = Cita.fromRow(row);
    const cancelada = EstadoCita.fromClave('cancelada');

    if (!cita.puedeTransicionarA(cancelada)) {
      if (cita.estado.esFinal()) {
        return { success: false, mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
      }
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
    }

    // Si la cita ya pasó (la fecha es menor o igual a la actual)
    if (!cita.esFutura()) {
      if (!esAdmin) {
        return { success: false, mensaje: 'No puedes cancelar una cita que ya pasó.' };
      }
    }

    // RN-086: Si el usuario es Paciente o Médico, NO puede cancelar si faltan menos de 2 horas para la cita.
    // Si el usuario es Administrador (esAdmin = true), se permite sin importar el tiempo.
    if (!esAdmin && cita.fueraDePlazoCancelacion(anticipacionHoras)) {
      return { success: false, mensaje: `Faltan menos de ${anticipacionHoras} horas para la cita; no es posible cancelarla [RN-086]` };
    }

    const data = await this.repo.cambiarEstado(id, cancelada.id, { cambiadoPor, origen, comentario });
    return { success: true, data, mensaje: 'Cita cancelada; el horario quedó libre [RN-085]' };
  }
}

module.exports = CancelarCita;
