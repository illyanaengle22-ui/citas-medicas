'use strict';

class ActualizarUsuario {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id, datos) {
    return this.repo.actualizar(id, datos);
  }
}

module.exports = ActualizarUsuario;
