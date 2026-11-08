'use strict';

const Cita = require('../../domain/entities/Cita');
const Horario = require('../../domain/entities/Horario');
const { formatearFechaHoraLocal, diaSemanaLocal } = require('../../domain/utils/fechaHoraLocal');

// RN-077: la cita web nace pendiente y la de Telegram nace confirmada;
// RN-071 / RN-073 / RN-072 / RN-074 / RN-078 se validan ANTES de insertar.
// El EXCLUDE de la BD es la última red por si hay dos peticiones concurrentes
// (entonces el adaptador lanza TraslapeError).
class AgendarCita {
  constructor(citaRepository, horarioRepository) {
    this.citas = citaRepository;
    this.horarios = horarioRepository;
  }

  async execute(datos) {
    const cita = Cita.fromRow(datos);

    // RN-071: duración entre 10 y 240 minutos
    if (!cita.duracionValida()) {
      return { success: false, mensaje: 'La duración debe estar entre 10 y 240 minutos' };
    }

    // RN-073: no se agendan citas en el pasado
    if (!cita.esFutura()) {
      return { success: false, mensaje: 'No se pueden agendar citas en el pasado' };
    }

    // Espejo del trigger: necesario aquí para los chequeos de rango
    cita.fecha_fin = cita.calcularFechaFin();

    // RN-072: debe caer dentro de un horario activo del médico en ese consultorio
    const enHorario = await this._dentroDeHorario(cita);
    if (!enHorario) {
      return { success: false, mensaje: 'La fecha cae fuera de un horario activo del médico en ese consultorio' };
    }

    // RN-074 / RN-075: el médico no puede tener dos citas vigentes traslapadas
    const traslapeMedico = await this.citas.buscarTraslape({
      medico_id: cita.medico_id,
      fecha_hora: cita.fecha_hora,
      fecha_fin: cita.fecha_fin
    });
    if (traslapeMedico) {
      return { success: false, mensaje: 'El horario ya fue ocupado para ese médico' };
    }

    // RN-078: el paciente no puede tener dos citas vigentes traslapadas,
    // aunque sean con médicos distintos. La BD también lo garantiza con un
    // EXCLUDE por paciente (migración 006).
    const traslapePaciente = await this.citas.buscarTraslapePaciente({
      paciente_id: cita.paciente_id,
      fecha_hora: cita.fecha_hora,
      fecha_fin: cita.fecha_fin
    });
    if (traslapePaciente) {
      return { success: false, mensaje: 'El paciente ya tiene una cita que se traslapa con ese horario' };
    }

    // RN-077: el estado se resuelve por clave en la BD, nunca por un id fijo.
    const estadoClave = datos.estadoClave === 'confirmada' ? 'confirmada' : 'pendiente';

    const creada = await this.citas.crear({
      paciente_id: cita.paciente_id,
      medico_id: cita.medico_id,
      consultorio_id: cita.consultorio_id,
      fecha_hora: cita.fecha_hora,
      duracion_minutos: cita.duracion_minutos,
      motivo: cita.motivo || null,
      notas: cita.notas || null,
      estadoClave,
    });

    return { success: true, data: creada, mensaje: 'Cita agendada correctamente' };
  }

  // RN-072: existe un bloque activo de ese médico, ese día, ese consultorio
  // y con la hora dentro del rango [inicio, fin). La fecha/hora se interpreta
  // siempre en la zona de la clínica, no en la zona del proceso de Node.
  async _dentroDeHorario(cita) {
    const bloques = await this.horarios.listarPorMedico(cita.medico_id, {
      soloActivos: true,
      soloDisponibles: true,
    });
    const local = formatearFechaHoraLocal(cita.fecha_hora);
    if (!local) return false;

    const diaIso = diaSemanaLocal(cita.fecha_hora);
    const hora = local.hora;

    const bloqueCoincidente = bloques.find((bloque) => {
      if (!bloque.activo) return false;
      if (Number(bloque.dia_semana) !== diaIso) return false;
      if (cita.consultorio_id && Number(bloque.consultorio_id) !== Number(cita.consultorio_id)) return false;
      return Horario.fromRow(bloque).contieneHora(hora);
    });

    if (bloqueCoincidente) {
      if (!cita.consultorio_id) {
        cita.consultorio_id = bloqueCoincidente.consultorio_id;
      }
      return true;
    }
    return false;
  }
}

module.exports = AgendarCita;
