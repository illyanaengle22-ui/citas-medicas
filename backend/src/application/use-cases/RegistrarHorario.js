'use strict';

const Horario = require('../../domain/entities/Horario');

// RN-060 / RN-061: valida día y rango con la entidad antes de insertar.
// RN-062: pre-check de traslape; si dos peticiones concurrentes se cruzan,
// la BD lo rechaza con EXCLUDE y el adaptador lanza TraslapeError.
class RegistrarHorario {
  constructor(horarioRepository) {
    this.repo = horarioRepository;
  }

  async execute(datos) {
    const horario = Horario.fromRow(datos);

    try {
      horario.validar();
    } catch (error) {
      return { success: false, mensaje: error.message };
    }

    const existe = await this.repo.existeTraslape({
      medico_id: horario.medico_id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin
    });
    if (existe) {
      return { success: false, mensaje: 'El médico ya tiene un bloque en ese día y horario que se traslapan [RN-062]' };
    }

    const creado = await this.repo.crear(horario);
    return { success: true, data: creado, mensaje: 'Horario registrado correctamente' };
  }
}

module.exports = RegistrarHorario;
