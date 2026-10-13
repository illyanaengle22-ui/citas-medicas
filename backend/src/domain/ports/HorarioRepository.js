'use strict';

class HorarioRepository {
  async crear(horario) {
    throw new Error('Método no implementado');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  }

  async listarPorMedico(medico_id, { soloActivos = true } = {}) {
    throw new Error('Método no implementado');
  }

  async actualizar(id, cambios) {
    throw new Error('Método no implementado');
  }

  // RN-064: los horarios se desactivan sin borrarse
  async desactivar(id) {
    throw new Error('Método no implementado');
  }

  // RN-062: pre-check de traslape (la BD lo garantiza con EXCLUDE USING gist)
  async existeTraslape({ medico_id, dia_semana, hora_inicio, hora_fin, excluirId = null }) {
    throw new Error('Método no implementado');
  }

  // RN-065: horarios activos del médico menos el tiempo ocupado por citas vigentes
  async buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id = null }) {
    throw new Error('Método no implementado');
  }
}

module.exports = HorarioRepository;
