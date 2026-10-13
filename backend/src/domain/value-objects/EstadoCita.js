'use strict';

const estadosValidos = {
  1: 'pendiente',
  2: 'confirmada',
  3: 'reagendada',
  4: 'cancelada',
  5: 'completada',
  6: 'no_asistio'
};

// RN-080: transiciones permitidas (propuesta 🔶)
const transicionesPermitidas = {
  1: [2, 3, 4],
  2: [3, 4, 5, 6],
  3: [2, 4, 5, 6],
  4: [],
  5: [],
  6: []
};

class EstadoCita {
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
    return new EstadoCita(Number(entrada[0]));
  }

  esPendiente() { return this.id === 1; }
  esConfirmada() { return this.id === 2; }
  esReagendada() { return this.id === 3; }
  esCancelada() { return this.id === 4; }
  esCompletada() { return this.id === 5; }
  esNoAsistio() { return this.id === 6; }

  // RN-076: pendiente, confirmada o reagendada ocupan agenda
  esVigente() { return this.id === 1 || this.id === 2 || this.id === 3; }

  // RN-081: cancelada, completada y no_asistio no se modifican
  esFinal() { return this.id === 4 || this.id === 5 || this.id === 6; }

  // RN-080: solo las transiciones de la tabla están permitidas
  puedeTransicionarA(nuevo) {
    const destino = nuevo instanceof EstadoCita ? nuevo.id : Number(nuevo);
    if (!estadosValidos[destino]) return false;
    return transicionesPermitidas[this.id].includes(destino);
  }
}

module.exports = EstadoCita;
