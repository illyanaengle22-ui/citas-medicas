'use strict';

// Casos de uso adicionales para médicos (listar, obtener, actualizar, estado, relaciones, eliminar)
// Cada uno es un thin wrapper que mantiene la inversión de dependencias.

class ListarMedicos {
  constructor(repo) { this.repo = repo; }
  async execute(opciones) { return this.repo.listar(opciones); }
}

class ObtenerMedicoPorId {
  constructor(repo) { this.repo = repo; }
  async execute(id, opts) { return this.repo.obtenerPorId(id, opts); }
}

class ActualizarMedico {
  constructor(repo) { this.repo = repo; }
  async execute(id, datos) { return this.repo.actualizar(id, datos); }
}

class CambiarEstadoMedico {
  constructor(repo) { this.repo = repo; }
  async execute(id, activo) { return this.repo.cambiarEstado(id, activo); }
}

class ReemplazarEspecialidadesMedico {
  constructor(repo) { this.repo = repo; }
  async execute(id, ids) { return this.repo.reemplazarEspecialidades(id, ids); }
}

class ReemplazarConsultoriosMedico {
  constructor(repo) { this.repo = repo; }
  async execute(id, ids) { return this.repo.reemplazarConsultorios(id, ids); }
}

class EliminarMedico {
  constructor(repo) { this.repo = repo; }
  async execute(id) { return this.repo.eliminar(id); }
}

module.exports = {
  ListarMedicos,
  ObtenerMedicoPorId,
  ActualizarMedico,
  CambiarEstadoMedico,
  ReemplazarEspecialidadesMedico,
  ReemplazarConsultoriosMedico,
  EliminarMedico,
};
