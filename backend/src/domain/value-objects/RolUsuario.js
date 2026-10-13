'use strict';

const rolesValidos = {
  1: 'admin',
  2: 'medico',
  3: 'paciente'
};

class RolUsuario {
  constructor(id) {
    if (!rolesValidos[id]) {
      throw new Error(`Rol inválido: ${id}`);
    }
    this.id = id;
    this.clave = rolesValidos[id];
  }

  static fromClave(clave) {
    const entrada = Object.entries(rolesValidos).find(([, v]) => v === clave);
    if (!entrada) return null;
    return new RolUsuario(Number(entrada[0]));
  }

  esAdmin() { return this.id === 1; }
  esMedico() { return this.id === 2; }
  esPaciente() { return this.id === 3; }
}

module.exports = RolUsuario;
