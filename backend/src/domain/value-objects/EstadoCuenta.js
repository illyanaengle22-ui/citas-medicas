'use strict';

const estadosValidos = {
  1: 'pendiente',
  2: 'activo',
  3: 'rechazado'
};

class EstadoCuenta {
  constructor(id) {
    if (!estadosValidos[id]) {
      throw new Error(`Estado inválido: ${id}`);
    }
    this.id = id;
    this.clave = estadosValidos[id];
  }

  static fromClave(clave) {
    const entrada = Object.entries(estadosValidos).find(([, v]) => v === clave);
    if (!entrada) return null;
    return new EstadoCuenta(Number(entrada[0]));
  }

  esPendiente() { return this.id === 1; }
  esActivo() { return this.id === 2; }
  esRechazado() { return this.id === 3; }
}

module.exports = EstadoCuenta;
