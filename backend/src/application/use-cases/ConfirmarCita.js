'use strict';

const Cita = require('../../domain/entities/Cita');
const EstadoCita = require('../../domain/value-objects/EstadoCita');

// RN-079 / RN-080: pendiente o reagendada -> confirmada.
// RN-090: el historial lo escribe el trigger de la BD al cambiar el estado.
class ConfirmarCita {
  constructor(citaRepository) {
    this.repo = citaRepository;
  }

  async execute(id) {
    const row = await this.repo.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }

    const cita = Cita.fromRow(row);
    const confirmada = EstadoCita.fromClave('confirmada');

    if (!cita.puedeTransicionarA(confirmada)) {
      if (cita.estado.esFinal()) {
        return { success: false, mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]` };
      }
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
    }

    const data = await this.repo.cambiarEstado(id, confirmada.id);
    return { success: true, data, mensaje: 'Cita confirmada correctamente' };
  }
}

module.exports = ConfirmarCita;
