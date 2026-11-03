'use strict';

const Cita = require('../../domain/entities/Cita');
const Horario = require('../../domain/entities/Horario');
const EstadoCita = require('../../domain/value-objects/EstadoCita');
const {
  formatearFechaHoraLocal,
  formatearFechaLocal,
  construirFechaHoraLocal,
  diaSemanaLocal,
} = require('../../domain/utils/fechaHoraLocal');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// RN-083: propone los 3 horarios libres más cercanos.
// RN-084: al aplicar el cambio vuelve a validar disponibilidad (RN-072 y RN-074).
class ReagendarCita {
  constructor(citaRepository, horarioRepository) {
    this.citas = citaRepository;
    this.horarios = horarioRepository;
  }

  // Devuelve próximos huecos libres del mismo médico, mismo consultorio,
  // con la misma duración, a partir de ahora + anticipacionHoras.
  async proponerHorarios(id, { cantidad = 3, diasBusqueda = 14, anticipacionHoras = 2 } = {}) {
    const row = await this.citas.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }
    const cita = Cita.fromRow(row);
    if (!cita.estado.esVigente()) {
      return { success: false, mensaje: `Solo se reagendan citas vigentes; la cita está "${cita.estado.clave}" [RN-076]` };
    }

    const desde = Date.now() + anticipacionHoras * 60 * 60 * 1000;
    const propuestas = [];

    const ahora = new Date();
    for (let i = 1; i <= diasBusqueda && propuestas.length < cantidad; i++) {
      const fecha = formatearFechaLocal(new Date(ahora.getTime() + i * MS_POR_DIA));
      if (!fecha) continue;

      const huecos = await this.horarios.buscarHuecos({
        medico_id: cita.medico_id,
        fecha,
        duracion_minutos: cita.duracion_minutos,
        consultorio_id: cita.consultorio_id
      });

      for (const hueco of huecos) {
        const horaInicio = hueco.hora_inicio.slice(0, 5);
        const fechaHoraLocal = construirFechaHoraLocal(fecha, horaInicio);
        if (!fechaHoraLocal) continue;
        const inicio = new Date(fechaHoraLocal);
        if (inicio.getTime() <= desde) continue; // aún muy pronto (RN-086 🔶)
        propuestas.push({
          fecha_hora: fechaHoraLocal,
          dia_semana: diaSemanaLocal(fechaHoraLocal),
          hora_inicio: horaInicio,
          horario_id: hueco.horario_id,
          consultorio_id: hueco.consultorio_id
        });
        if (propuestas.length >= cantidad) break;
      }
    }

    return {
      success: true,
      data: propuestas,
      mensaje: propuestas.length
        ? 'Horarios libres más cercanos [RN-083]'
        : 'No se encontraron horarios libres en los próximos días'
    };
  }

  // RN-084: valida de nuevo y aplica el cambio de fecha.
  async execute(id, { fecha_hora, cambiadoPor = null, origen = 'web', comentario = null } = {}) {
    if (!fecha_hora) {
      return { success: false, mensaje: 'Se requiere la nueva fecha y hora' };
    }

    const row = await this.citas.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }
    const cita = Cita.fromRow(row);

    if (!cita.estado.esVigente()) {
      return { success: false, mensaje: `Solo se reagendan citas vigentes; la cita está "${cita.estado.clave}" [RN-076]` };
    }

    // RN-086 🔶: plazo mínimo de anticipación para reagendar
    if (cita.fueraDePlazoCancelacion(2)) {
      return { success: false, mensaje: 'Faltan menos de 2 horas para la cita; no es posible reagendarla [RN-086]' };
    }

    const nueva = Cita.fromRow({ ...row, fecha_hora, duracion_minutos: cita.duracion_minutos, estado_id: cita.estado_id });
    if (!nueva.esFutura()) {
      return { success: false, mensaje: 'La nueva fecha debe ser futura [RN-073]' };
    }
    nueva.fecha_fin = nueva.calcularFechaFin();

    // RN-072 / RN-084: dentro de un horario activo en ese consultorio
    const enHorario = await this._dentroDeHorario(nueva);
    if (!enHorario) {
      return { success: false, mensaje: 'La nueva fecha cae fuera de un horario activo del médico [RN-072]' };
    }

    // RN-074 / RN-075: sin traslape con otras citas vigentes (excluyendo la propia)
    const traslape = await this.citas.buscarTraslape({
      medico_id: cita.medico_id,
      fecha_hora: nueva.fecha_hora,
      fecha_fin: nueva.fecha_fin,
      excluirId: cita.id
    });
    if (traslape) {
      return { success: false, mensaje: 'El horario ya fue ocupado para ese médico [RN-074]' };
    }

    // RN-078: el paciente tampoco puede quedar con dos citas traslapadas,
    // aunque el nuevo horario esté libre para el médico.
    const traslapePaciente = await this.citas.buscarTraslapePaciente({
      paciente_id: cita.paciente_id,
      fecha_hora: nueva.fecha_hora,
      fecha_fin: nueva.fecha_fin,
      excluirId: cita.id
    });
    if (traslapePaciente) {
      return { success: false, mensaje: 'El paciente ya tiene otra cita que se traslapa con ese horario [RN-078]' };
    }

    // RN-080: validar la transición ANTES de tocar la fecha.
    const reagendada = EstadoCita.fromClave('reagendada');
    const cambiaEstado = Number(cita.estado.id) !== Number(reagendada.id);
    if (cambiaEstado && !cita.puedeTransicionarA(reagendada)) {
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "reagendada" [RN-080]` };
    }

    // RN-112: fecha y estado se actualizan en una sola operación atómica.
    const data = await this.citas.reagendar(cita.id, {
      fecha_hora: nueva.fecha_hora,
      estado_id: cambiaEstado ? reagendada.id : null,
      cambiadoPor,
      origen,
      comentario,
    });

    return { success: true, data, mensaje: 'Cita reagendada correctamente' };
  }

  async _dentroDeHorario(cita) {
    const bloques = await this.horarios.listarPorMedico(cita.medico_id, {
      soloActivos: true,
      soloDisponibles: true,
    });
    const local = formatearFechaHoraLocal(cita.fecha_hora);
    if (!local) return false;
    const diaIso = diaSemanaLocal(cita.fecha_hora);
    const hora = local.hora;

    return bloques.some((bloque) => {
      if (!bloque.activo) return false;
      if (Number(bloque.dia_semana) !== diaIso) return false;
      if (Number(bloque.consultorio_id) !== Number(cita.consultorio_id)) return false;
      return Horario.fromRow(bloque).contieneHora(hora);
    });
  }
}

module.exports = ReagendarCita;
