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
  constructor(citaRepository, horarioRepository, medicoRepository = null) {
    this.citas = citaRepository;
    this.horarios = horarioRepository;
    this.medicos = medicoRepository;
  }

  // Devuelve próximos huecos libres del mismo médico (o del médico elegido
  // dentro de la misma especialidad), con la misma duración, a partir de
  // ahora + anticipacionHoras.
  async proponerHorarios(id, {
    cantidad = 3,
    diasBusqueda = 14,
    anticipacionHoras = 2,
    medico_id = null,
    consultorio_id = null,
  } = {}) {
    const row = await this.citas.obtenerPorId(id);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }
    const cita = Cita.fromRow(row);
    if (!cita.estado.esVigente()) {
      return { success: false, mensaje: `Solo se reagendan citas vigentes; la cita está "${cita.estado.clave}" [RN-076]` };
    }

    const cambio = await this._validarCambioMedico(cita, medico_id);
    if (!cambio.success) return cambio;

    const medicoObjetivo = cambio.medico_id;
    const mismoMedico = String(medicoObjetivo) === String(cita.medico_id);
    // Al cambiar de médico no restringimos al consultorio original: el
    // médico nuevo puede atender en otro consultorio.
    const consultorioObjetivo = consultorio_id ?? (mismoMedico ? cita.consultorio_id : null);

    const desde = Date.now() + anticipacionHoras * 60 * 60 * 1000;
    const propuestas = [];

    const ahora = new Date();
    for (let i = 1; i <= diasBusqueda && propuestas.length < cantidad; i++) {
      const fecha = formatearFechaLocal(new Date(ahora.getTime() + i * MS_POR_DIA));
      if (!fecha) continue;

      const huecos = await this.horarios.buscarHuecos({
        medico_id: medicoObjetivo,
        fecha,
        duracion_minutos: cita.duracion_minutos,
        consultorio_id: consultorioObjetivo
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

  // RN-084: valida de nuevo y aplica el cambio de fecha (y, opcionalmente,
  // de médico dentro de la misma especialidad y de consultorio).
  async execute(id, {
    fecha_hora,
    medico_id = null,
    consultorio_id = null,
    cambiadoPor = null,
    origen = 'web',
    comentario = null,
  } = {}) {
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

    const cambio = await this._validarCambioMedico(cita, medico_id);
    if (!cambio.success) return cambio;

    const medicoObjetivo = cambio.medico_id;
    const consultorioObjetivo = consultorio_id ?? cita.consultorio_id;

    const nueva = Cita.fromRow({
      ...row,
      fecha_hora,
      medico_id: medicoObjetivo,
      consultorio_id: consultorioObjetivo,
      duracion_minutos: cita.duracion_minutos,
      estado_id: cita.estado_id
    });
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
      medico_id: nueva.medico_id,
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

    // RN-089: al reagendar (actualizar fecha_hora), el estado de la cita debe pasar
    // DIRECTAMENTE a 'confirmada' (estado_id = 2) o mantenerse como 'confirmada',
    // confirmándola tácitamente si estaba en 'pendiente'.
    const confirmada = EstadoCita.fromClave('confirmada');
    const cambiaEstado = Number(cita.estado.id) !== Number(confirmada.id);
    if (cambiaEstado && !cita.puedeTransicionarA(confirmada)) {
      return { success: false, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
    }

    const cambiaMedico = String(nueva.medico_id) !== String(cita.medico_id);
    const cambiaConsultorio = String(nueva.consultorio_id) !== String(cita.consultorio_id);

    // RN-112: fecha, médico, consultorio y estado se actualizan en una sola
    // operación atómica. Los campos que no cambian se dejan en NULL para no
    // tocarlos. RN-089: fuerza estado_id = 2 ('confirmada').
    const data = await this.citas.reagendar(cita.id, {
      fecha_hora: nueva.fecha_hora,
      medico_id: cambiaMedico ? nueva.medico_id : null,
      consultorio_id: cambiaConsultorio ? nueva.consultorio_id : null,
      estado_id: confirmada.id,
      cambiadoPor,
      origen,
      comentario: comentario || 'RN-089: Cita confirmada tácitamente al reagendar',
    });

    return {
      success: true,
      data,
      mensaje: 'Cita reagendada con éxito. Tu nuevo horario está confirmado.',
    };
  }

  // Cambiar de médico solo dentro de la misma especialidad: el paciente
  // conserva el tipo de atención que reservó. El médico nuevo debe estar activo.
  async _validarCambioMedico(cita, medicoId) {
    if (medicoId == null || String(medicoId) === String(cita.medico_id)) {
      return { success: true, medico_id: cita.medico_id };
    }

    if (!this.medicos) {
      return { success: false, mensaje: 'No se puede cambiar de médico en este momento' };
    }

    const nuevo = await this.medicos.obtenerPorId(medicoId, { soloActivo: true });
    if (!nuevo) {
      return { success: false, mensaje: 'El médico seleccionado no existe o no está activo [RN-031]' };
    }

    const original = await this.medicos.obtenerPorId(cita.medico_id, { soloActivo: true });
    if (!original) {
      // Si el médico original ya no está disponible, permitimos elegir otro
      // médico activo para no dejar la cita atorada.
      return { success: true, medico_id: nuevo.id };
    }

    const especialidadesOriginal = new Set(
      (original.especialidades ?? []).map((e) => String(e.id))
    );
    const comparte = (nuevo.especialidades ?? []).some((e) =>
      especialidadesOriginal.has(String(e.id))
    );
    if (!comparte) {
      return { success: false, mensaje: 'Solo puedes cambiar a un médico de la misma especialidad' };
    }

    return { success: true, medico_id: nuevo.id };
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
