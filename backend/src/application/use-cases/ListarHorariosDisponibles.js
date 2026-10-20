'use strict';

// RN-065: los horarios disponibles son los activos del médico menos el
// tiempo ocupado por citas vigentes.
//  - Con { fecha, duracion_minutos } → huecos concretos (buscarHuecos).
//  - Sin fecha → bloques recurrentes del médico (listarPorMedico).
class ListarHorariosDisponibles {
  constructor(horarioRepository) {
    this.repo = horarioRepository;
  }

  async execute({ medico_id, fecha = null, duracion_minutos = null, consultorio_id = null, soloActivos = true } = {}) {
    if (!medico_id) {
      return { success: false, mensaje: 'Se requiere el médico' };
    }

    if (fecha && duracion_minutos) {
      const huecos = await this.repo.buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id });
      return { success: true, data: huecos };
    }

    const bloques = await this.repo.listarPorMedico(medico_id, { soloActivos });
    return { success: true, data: bloques };
  }
}

module.exports = ListarHorariosDisponibles;
