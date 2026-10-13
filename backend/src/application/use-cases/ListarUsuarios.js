'use strict';

class ListarUsuarios {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(filtros = {}) {
    return this.repo.listar(filtros);
  }
}

module.exports = ListarUsuarios;
