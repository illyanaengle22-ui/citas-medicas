'use strict';

class AsignarRol {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id, rol_id) {
    return this.repo.asignarRol(id, rol_id);
  }
}

module.exports = AsignarRol;
