'use strict';

// Entidad de dominio: un consultorio donde se atienden citas (RN-032).
class Consultorio {
  constructor({ id, nombre, direccion, telefono, activo, created_at, updated_at }) {
    this.id = id;
    this.nombre = nombre;
    this.direccion = direccion;
    this.telefono = telefono;
    this.activo = activo;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  static fromRow(row) {
    return new Consultorio(row);
  }

  estaActivo() {
    return this.activo === true;
  }
}

module.exports = Consultorio;
