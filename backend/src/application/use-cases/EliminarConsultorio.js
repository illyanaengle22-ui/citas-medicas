'use strict';

class EliminarConsultorio {
  constructor(consultorioRepository) {
    this.repo = consultorioRepository;
  }

  async execute(id) {
    return this.repo.eliminar(id);
  }
}

module.exports = EliminarConsultorio;
