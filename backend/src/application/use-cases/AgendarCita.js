'use strict';

const Cita = require('../../domain/entities/Cita');
const Horario = require('../../domain/entities/Horario');

// RN-077: la cita nace pendiente; RN-071 / RN-073 / RN-072 / RN-074 / RN-078
// se validan ANTES de insertar. El EXCLUDE de la BD es la última red por si
// hay dos peticiones concurrentes (entonces el adaptador lanza TraslapeError).
class AgendarCita {
  constructor(citaRepository, horarioRepository) {
    this.citas = citaRepository;
    this.horarios = horarioRepository;
  }

  async execute(datos) {
    const cita = Cita.fromRow(datos);

    // RN-071: duración entre 10 y 240 minutos
    if (!cita.duracionValida()) {
      return { success: false, mensaje: 'La duración debe estar entre 10 y 240 minutos [RN-071]' };
    }

    // RN-073: no se agendan citas en el pasado
    if (!cita.esFutura()) {
      return { success: false, mensaje: 'No se pueden agendar citas en el pasado [RN-073]' };
    }

    // Espejo del trigger: necesario aquí para los chequeos de rango
    cita.fecha_fin = cita.calcularFechaFin();

    // RN-072: debe caer dentro de un horario activo del médico en ese consultorio
    const enHorario = await this._dentroDeHorario(cita);
    if (!enHorario) {
      return { success: false, mensaje: 'La fecha cae fuera de un horario activo del médico en ese consultorio [RN-072]' };
    }

    // RN-074 / RN-075: el médico no puede tener dos citas vigentes traslapadas
    const traslapeMedico = await this.citas.buscarTraslape({
      medico_id: cita.medico_id,
      fecha_hora: cita.fecha_hora,
      fecha_fin: cita.fecha_fin
    });
    if (traslapeMedico) {
      return { success: false, mensaje: 'El horario ya fue ocupado para ese médico [RN-074]' };
    }

    // RN-078: el paciente no puede tener dos citas vigentes traslapadas
    const mias = await this.citas.listar({ paciente_id: cita.paciente_id, page: 1, limit: 200 });
    const choque = mias.data
      .map((row) => Cita.fromRow(row))
      .some((otra) => otra.id !== cita.id && otra.estado.esVigente() && otra.esFutura() && cita.seSolapa(otra));
    if (choque) {
      return { success: false, mensaje: 'El paciente ya tiene una cita que se traslapa con ese horario [RN-078]' };
    }

    const creada = await this.citas.crear({
      paciente_id: cita.paciente_id,
      medico_id: cita.medico_id,
      consultorio_id: cita.consultorio_id,
      fecha_hora: cita.fecha_hora,
      duracion_minutos: cita.duracion_minutos,
      motivo: cita.motivo || null,
      notas: cita.notas || null
      // estado_id lo pone la BD en 1 (pendiente) — RN-077
    });

    return { success: true, data: creada, mensaje: 'Cita agendada correctamente' };
  }

  // RN-072: existe un bloque activo de ese médico, ese día, esa consultorio
  // y con la hora dentro del rango [inicio, fin)
  async _dentroDeHorario(cita) {
    const bloques = await this.horarios.listarPorMedico(cita.medico_id);
    const fecha = new Date(cita.fecha_hora);
    const diaIso = ((fecha.getDay() + 6) % 7) + 1; // 1 = lunes ... 7 = domingo
    const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

    return bloques.some((bloque) => {
      if (!bloque.activo) return false;
      if (Number(bloque.dia_semana) !== diaIso) return false;
      if (Number(bloque.consultorio_id) !== Number(cita.consultorio_id)) return false;
      return Horario.fromRow(bloque).contieneHora(hora);
    });
  }
}

module.exports = AgendarCita;
