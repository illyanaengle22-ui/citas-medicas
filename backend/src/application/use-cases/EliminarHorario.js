'use strict';

// RN-064: los horarios se desactivan sin borrarse; las citas ya agendadas
// no se eliminan automáticamente (RN-087: nada se borra físicamente).
class EliminarHorario {
  constructor(horarioRepository) {
    this.repo = horarioRepository;
  }

  async execute(id) {
    const existe = await this.repo.obtenerPorId(id);
    if (!existe) {
      return { success: false, mensaje: 'Horario no encontrado' };
    }

    const data = await this.repo.desactivar(id);
    return { success: true, data, mensaje: 'Horario desactivado correctamente' };
  }
}

module.exports = EliminarHorario;
