'use strict';

// Puerto del repositorio de consultorios (arquitectura hexagonal).
class ConsultorioRepository {
  async listar({ incluirInactivos = false, q = null } = {}) {
    throw new Error('Método no implementado');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  }

  async crear({ nombre, direccion, telefono }) {
    throw new Error('Método no implementado');
  }

  async actualizar(id, { nombre, direccion, telefono }) {
    throw new Error('Método no implementado');
  }

  async cambiarEstado(id, activo) {
    throw new Error('Método no implementado');
  }

  async eliminar(id) {
    throw new Error('Método no implementado');
  }
}

module.exports = ConsultorioRepository;
