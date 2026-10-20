'use strict';

const Cita = require('../../domain/entities/Cita');
const Recordatorio = require('../../domain/entities/Recordatorio');
const EstadoCita = require('../../domain/value-objects/EstadoCita');
const ReagendarCita = require('./ReagendarCita');

// RN-103: el paciente responde desde Telegram con confirmar, cancelar o
// reagendar; el sistema actualiza la cita según la respuesta.
// RN-104: la respuesta queda registrada en el recordatorio.
// El webhook lo recibe n8n (RN-107) y nos manda { chatId, uuidCita, respuesta }.
class ProcesarRespuestaTelegram {
  constructor(citaRepository, recordatorioRepository, horarioRepository) {
    this.citas = citaRepository;
    this.recordatorios = recordatorioRepository;
    this.reagendar = new ReagendarCita(citaRepository, horarioRepository);
  }

  async execute({ chatId = null, uuidCita, respuesta, recordatorioId = null } = {}) {
    if (!uuidCita) {
      return { success: false, mensaje: 'Falta el identificador de la cita' };
    }
    if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
      return { success: false, mensaje: `Respuesta inválida: use "${Recordatorio.RESPUESTAS.CONFIRMAR}", "${Recordatorio.RESPUESTAS.CANCELAR}" o "${Recordatorio.RESPUESTAS.REAGENDAR}"` };
    }

    const row = await this.citas.obtenerPorUuid(uuidCita);
    if (!row) {
      return { success: false, mensaje: 'Cita no encontrada' };
    }
    const cita = Cita.fromRow(row);

    // RN-104: registra la respuesta en el recordatorio que originó el mensaje
    await this._registrarRespuesta(cita.id, respuesta, recordatorioId);

    switch (respuesta) {
      case Recordatorio.RESPUESTAS.CONFIRMAR:
        return this._confirmar(cita, chatId);

      case Recordatorio.RESPUESTAS.CANCELAR:
        return this._cancelar(cita, chatId);

      case Recordatorio.RESPUESTAS.REAGENDAR:
        // RN-083: no cambia el estado; devuelve las 3 opciones para que
        // n8n las mande por Telegram y el paciente elija.
        const propuestas = await this.reagendar.proponerHorarios(cita.id);
        return {
          ...propuestas,
          mensaje: propuestas.success && propuestas.data.length
            ? 'Elige una de estas opciones para reagendar [RN-083]'
            : propuestas.mensaje
        };

      default:
        return { success: false, mensaje: 'Respuesta no procesada' };
    }
  }

  async _registrarRespuesta(citaId, respuesta, recordatorioId) {
    let recordatorio = null;
    if (recordatorioId) {
      recordatorio = await this.recordatorios.obtenerPorId(recordatorioId);
      if (recordatorio && Number(recordatorio.cita_id) !== Number(citaId)) recordatorio = null;
    }
    if (!recordatorio) {
      const lista = await this.recordatorios.listarPorCita(citaId);
      recordatorio = [...lista].reverse().find((r) => r.respuesta == null) || lista[lista.length - 1] || null;
    }
    if (recordatorio) {
      await this.recordatorios.registrarRespuesta(recordatorio.id, respuesta);
    }
  }

  async _confirmar(cita, chatId) {
    const confirmada = EstadoCita.fromClave('confirmada');
    if (!cita.estado.esVigente()) {
      return { success: false, chatId, mensaje: `La cita ya no está vigente (estado "${cita.estado.clave}")` };
    }
    if (!cita.puedeTransicionarA(confirmada)) {
      return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
    }
    const data = await this.citas.cambiarEstado(cita.id, confirmada.id);
    return { success: true, chatId, data, mensaje: 'Cita confirmada por Telegram' };
  }

  async _cancelar(cita, chatId) {
    if (!cita.estado.esVigente()) {
      return { success: false, chatId, mensaje: `La cita ya no está vigente (estado "${cita.estado.clave}")` };
    }
    const cancelada = EstadoCita.fromClave('cancelada');
    if (!cita.puedeTransicionarA(cancelada)) {
      return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
    }
    // RN-086 🔶: el plazo mínimo aplica también por Telegram
    if (cita.fueraDePlazoCancelacion(2)) {
      return { success: false, chatId, mensaje: 'Faltan menos de 2 horas para la cita; no es posible cancelarla [RN-086]' };
    }
    const data = await this.citas.cambiarEstado(cita.id, cancelada.id);
    return { success: true, chatId, data, mensaje: 'Cita cancelada por Telegram; el horario quedó libre' };
  }
}

module.exports = ProcesarRespuestaTelegram;
