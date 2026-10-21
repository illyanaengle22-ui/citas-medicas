'use strict';

/**
 * Puerto de dominio: contrato que debe cumplir cualquier adaptador de médicos.
 * Los métodos lanzan NotImplementedError si no se sobreescriben.
 */
class MedicoRepository {
  async listar(_opciones)                  { throw new Error('No implementado'); }
  async obtenerPorId(_id, _opts)           { throw new Error('No implementado'); }
  async crear(_datos)                      { throw new Error('No implementado'); }
  async actualizar(_id, _datos)            { throw new Error('No implementado'); }
  async cambiarEstado(_id, _activo)        { throw new Error('No implementado'); }
  async reemplazarEspecialidades(_id, _ids){ throw new Error('No implementado'); }
  async reemplazarConsultorios(_id, _ids)  { throw new Error('No implementado'); }
  async eliminar(_id)                      { throw new Error('No implementado'); }
}

module.exports = MedicoRepository;
