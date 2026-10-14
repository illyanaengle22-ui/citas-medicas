'use strict';

class CrearEspecialidad {
  constructor(especialidadRepository) {
    this.repo = especialidadRepository;
  }

  async execute(nombre, descripcion) {
    return this.repo.crear(nombre, descripcion);
  }
}

module.exports = CrearEspecialidad;
