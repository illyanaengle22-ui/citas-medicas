'use strict';

class CrearEspecialidad {
  constructor(especialidadRepository) {
    this.repo = especialidadRepository;
  }

  async execute(nombre) {
    return this.repo.crear(nombre);
  }
}

module.exports = CrearEspecialidad;
