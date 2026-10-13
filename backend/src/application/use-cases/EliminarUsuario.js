'use strict';

class EliminarUsuario {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id, actorId) {
    if (parseInt(id) === parseInt(actorId)) {
      return { success: false, mensaje: 'No puedes eliminar tu propia cuenta' };
    }
    return this.repo.eliminar(id);
  }
}

module.exports = EliminarUsuario;
