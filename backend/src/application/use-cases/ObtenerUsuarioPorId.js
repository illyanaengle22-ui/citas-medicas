'use strict';

class ObtenerUsuarioPorId {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id) {
    return this.repo.obtenerPorId(id);
  }
}

module.exports = ObtenerUsuarioPorId;