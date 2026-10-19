'use strict';

class CambiarRol {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id, rol_id, actorId) {
    return this.repo.cambiarRol(id, rol_id, actorId);
  }
}

module.exports = CambiarRol;