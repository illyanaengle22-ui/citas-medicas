'use strict';

class CrearConsultorio {
  constructor(consultorioRepository) {
    this.repo = consultorioRepository;
  }

  async execute(datos) {
    return this.repo.crear(datos);
  }
}

module.exports = CrearConsultorio;
