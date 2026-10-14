'use strict';

class CambiarEstadoEspecialidad {
  constructor(especialidadRepository) {
    this.repo = especialidadRepository;
  }

  async execute(id, activo) {
    return this.repo.cambiarEstado(id, activo);
  }
}

module.exports = CambiarEstadoEspecialidad;
