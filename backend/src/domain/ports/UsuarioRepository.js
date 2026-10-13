'use strict';

class UsuarioRepository {
  async listar({ rol, estado, page = 1, limit = 10 } = {}) {
    throw new Error('Método no implementado');
  }

  async listarPendientes() {
    throw new Error('Método no implementado');
  }

  async aprobar(id) {
    throw new Error('Método no implementado');
  }

  async rechazar(id) {
    throw new Error('Método no implementado');
  }

  async asignarRol(id, rol_id) {
    throw new Error('Método no implementado');
  }

  async obtenerEstadisticas() {
    throw new Error('Método no implementado');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  }
}

module.exports = UsuarioRepository;
