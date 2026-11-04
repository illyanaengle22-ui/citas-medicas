'use strict';

const Cita = require('../../domain/entities/Cita');
const EstadoCita = require('../../domain/value-objects/EstadoCita');

// RN-082 / RN-087: marcar o corregir asistencia (completada / no_asistio)
// Permite a Médicos (solo sus citas asignadas) y Admins (todas las citas)
// cambiar el estado manualmente sin límite de tiempo.
class MarcarAsistencia {
  constructor(citaRepository) {
    this.repo = citaRepository;
  }

  // actor: { rol, rol_id, medicoId }
  async execute(id, { asistio, actor = {}, cambiadoPor = null, origen = 'web', comentario = null } = {}) {
    const row = await this.repo.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }

    // Seguridad: Permite el cambio solo si el usuario es Admin (rol_id = 1)
    // O si es el Médico asignado a esa cita (rol_id = 2 y medico_id coincide)
    const esAdmin = actor.rol_id === 1 || actor.rol === 'admin';
    const esMedicoAsignado = (actor.rol_id === 2 || actor.rol === 'medico') &&
      actor.medicoId != null &&
      Number(actor.medicoId) === Number(row.medico_id);

    if (!esAdmin && !esMedicoAsignado) {
      return {
        success: false,
        mensaje: 'Solo el médico de la cita o un administrador pueden marcar o corregir la asistencia [RN-082]',
      };
    }

    const cita = Cita.fromRow(row);

    // Citas canceladas no se pueden pasar a completada / no_asistio
    if (cita.estado.clave === 'cancelada') {
      return {
        success: false,
        codigo: 400,
        mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]`,
      };
    }

    // RN-082: Si la cita es en el futuro, no se puede marcar asistencia para médicos.
    // El Administrador (rol_id = 1) no tiene restricciones de tiempo y puede marcar citas futuras.
    // Para médicos: solo si ya pasó o si es una corrección (ya estaba en no_asistio o completada).
    const esCorreccionPasada = cita.estado.clave === 'no_asistio' || cita.estado.clave === 'completada';
    const ahoraMs = Date.now();
    const fechaHoraMs = new Date(cita.fecha_hora).getTime();

    if (!esAdmin && !esCorreccionPasada && fechaHoraMs > ahoraMs) {
      return {
        success: false,
        codigo: 400,
        mensaje: 'No puedes marcar la asistencia de una cita que aún no ha comenzado.',
      };
    }

    const destino = EstadoCita.fromClave(asistio ? 'completada' : 'no_asistio');

    // Si ya tiene el estado solicitado, retorno exitoso idempotente
    if (cita.estado.clave === destino.clave) {
      return { success: true, data: row, mensaje: `La cita ya está marcada como "${destino.clave}"` };
    }

    // Comprobar transición permitida (incluye correcciones entre completada y no_asistio)
    if (!cita.puedeTransicionarA(destino)) {
      if (cita.estado.esFinal()) {
        return {
          success: false,
          mensaje: `La cita está en estado final "${cita.estado.clave}" y no se puede modificar [RN-081]`,
        };
      }
      return {
        success: false,
        mensaje: `No se puede pasar de "${cita.estado.clave}" a "${destino.clave}" [RN-080]`,
      };
    }

    const data = await this.repo.cambiarEstado(id, destino.id, { cambiadoPor, origen, comentario });
    return { success: true, data, mensaje: `Cita marcada como "${destino.clave}"` };
  }
}

module.exports = MarcarAsistencia;
