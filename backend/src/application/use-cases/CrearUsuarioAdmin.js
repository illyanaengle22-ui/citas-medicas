'use strict';

class CrearUsuarioAdmin {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(datos) {
    return this.repo.crear(datos);
  }
}

module.exports = CrearUsuarioAdmin;
