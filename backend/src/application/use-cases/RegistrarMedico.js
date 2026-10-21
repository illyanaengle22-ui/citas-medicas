'use strict';
class RegistrarMedico {
  constructor(repo) { this.repo = repo; }
  async execute(datos) { return this.repo.crear(datos); }
}
module.exports = RegistrarMedico;
