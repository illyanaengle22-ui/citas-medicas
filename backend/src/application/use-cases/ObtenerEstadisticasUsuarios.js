'use strict';

class ObtenerEstadisticasUsuarios {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute() {
    return this.repo.obtenerEstadisticas();
  }
}

module.exports = ObtenerEstadisticasUsuarios;
