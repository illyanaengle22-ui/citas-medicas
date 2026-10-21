'use strict';

/**
 * Entidad de dominio Medico.
 * Representa al médico tal como lo maneja la capa de dominio.
 * No expone password_hash (RN-008).
 */
class Medico {
  constructor({
    id,
    usuario_id,
    nombre,
    email,
    cedula_profesional,
    telefono,
    activo,
    especialidades = [],
    consultorios  = [],
  }) {
    this.id                = id;
    this.usuario_id        = usuario_id;
    this.nombre            = nombre;
    this.email             = email;
    this.cedula_profesional = cedula_profesional;
    this.telefono          = telefono;
    this.activo            = activo;
    this.especialidades    = especialidades;
    this.consultorios      = consultorios;
  }

  /** RN-047: formato estable que consume el flujo de agendamiento (admin ve email) */
  toPublicDTO() {
    return {
      id:                this.id,
      usuario_id:        this.usuario_id,
      nombre:            this.nombre,
      email:             this.email,
      medico_mostrar:    `Dr. ${this.nombre}`,
      cedula_profesional: this.cedula_profesional,
      telefono:          this.telefono,
      activo:            this.activo,
      especialidades:    this.especialidades,
      consultorios:      this.consultorios,
    };
  }

  /** Vista reducida para no-admin: sin email ni cédula (RN-046) */
  toPublicDTOReducido() {
    return {
      id:             this.id,
      usuario_id:     this.usuario_id,
      nombre:         this.nombre,
      medico_mostrar: `Dr. ${this.nombre}`,
      telefono:       this.telefono,
      activo:         this.activo,
      especialidades: this.especialidades,
      consultorios:   this.consultorios,
    };
  }
}

module.exports = Medico;
