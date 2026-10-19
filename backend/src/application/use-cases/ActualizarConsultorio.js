'use strict';

class ActualizarConsultorio {
  constructor(consultorioRepository) {
    this.repo = consultorioRepository;
  }

  async execute(id, datos) {
    return this.repo.actualizar(id, datos);
  }
}

module.exports = ActualizarConsultorio;
