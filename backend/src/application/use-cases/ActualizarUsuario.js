'use strict';

const bcrypt = require('bcryptjs');

class ActualizarUsuario {
  constructor(usuarioRepository) {
    this.repo = usuarioRepository;
  }

  async execute(id, { nombre, email, password, rol_id }) {
    const datos = { nombre, email };
    if (password !== undefined && password !== '') {
      if (password.length < 8) {
        return { success: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' };
      }
      datos.password_hash = await bcrypt.hash(password, 10);
    }
    return this.repo.actualizar(id, datos);
  }
}

module.exports = ActualizarUsuario;