'use strict';

class AprobarUsuario {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id) {
    return this.repo.aprobar(id);
  }
}

module.exports = AprobarUsuario;
