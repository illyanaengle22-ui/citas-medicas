'use strict';

class ActualizarEspecialidad {
  constructor(especialidadRepository) {
    this.repo = especialidadRepository;
  }

  async execute(id, datos) {
    return this.repo.actualizar(id, datos);
  }
}

module.exports = ActualizarEspecialidad;
