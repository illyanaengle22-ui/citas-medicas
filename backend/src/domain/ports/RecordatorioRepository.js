'use strict';

class RecordatorioRepository {
  async crear(recordatorio) {
    throw new Error('Método no implementado');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  }

  async listarPorCita(cita_id) {
    throw new Error('Método no implementado');
  }

  // RN-105: no se envía el mismo tipo de recordatorio dos veces para la misma cita
  async existeTipo(cita_id, tipo) {
    throw new Error('Método no implementado');
  }

  // RN-102: citas vigentes, con telegram vinculado y sin recordatorio de ese tipo
  async buscarCandidatos({ tipo, ventanaHoras = 24 } = {}) {
    throw new Error('Método no implementado');
  }

  async marcarEnviado(id) {
    throw new Error('Método no implementado');
  }

  // RN-106: si el envío falla, el estado lo refleja y la cita no se ve afectada
  async marcarFallido(id) {
    throw new Error('Método no implementado');
  }

  // RN-103 / RN-104: respuesta del paciente (confirmar, cancelar, reagendar)
  async registrarRespuesta(id, respuesta) {
    throw new Error('Método no implementado');
  }
}

module.exports = RecordatorioRepository;
