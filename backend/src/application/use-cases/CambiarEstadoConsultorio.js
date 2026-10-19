'use strict';

class CambiarEstadoConsultorio {
  constructor(consultorioRepository) {
    this.repo = consultorioRepository;
  }

  async execute(id, activo) {
    return this.repo.cambiarEstado(id, activo);
  }
}

module.exports = CambiarEstadoConsultorio;
