'use strict';

class Usuario {
  constructor({ id, uuid_publico, nombre, email, rol_id, estado_id, created_at }) {
    this.id = id;
    this.uuid_publico = uuid_publico;
    this.nombre = nombre;
    this.email = email;
    this.rol_id = rol_id;
    this.estado_id = estado_id;
    this.created_at = created_at;
  }

  static fromRow(row) {
    return new Usuario(row);
  }

  esPendiente() {
    return this.estado_id === 1;
  }

  esActivo() {
    return this.estado_id === 2;
  }

  esPaciente() {
    return this.rol_id === 3;
  }
}

module.exports = Usuario;
