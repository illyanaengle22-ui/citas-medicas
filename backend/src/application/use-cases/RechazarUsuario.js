'use strict';

class RechazarUsuario {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id) {
    return this.repo.rechazar(id);
  }
}

module.exports = RechazarUsuario;
