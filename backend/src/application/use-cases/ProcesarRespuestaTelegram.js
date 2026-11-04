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

  async execute({ chatId = null, uuidCita, respuesta, recordatorioId = null, fecha_hora = null, origen = 'telegram', cambiadoPor = null } = {}) {
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

    let resultado;
    switch (respuesta) {
      case Recordatorio.RESPUESTAS.CONFIRMAR:
        resultado = await this._confirmar(cita, chatId, { origen, cambiadoPor });
        break;

      case Recordatorio.RESPUESTAS.CANCELAR:
        resultado = await this._cancelar(cita, chatId, { origen, cambiadoPor });
        break;

      case Recordatorio.RESPUESTAS.REAGENDAR:
        // RN-103: si n8n ya envía la nueva fecha elegida, se aplica el cambio.
        // Si solo llega "reagendar", se devuelven las opciones para que el
        // paciente elija y n8n vuelva a llamar con fecha_hora.
        if (fecha_hora) {
          const cambio = await this.reagendar.execute(cita.id, {
            fecha_hora,
            cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
            origen,
          });
          resultado = { ...cambio, chatId };
        } else {
          const propuestas = await this.reagendar.proponerHorarios(cita.id);
          resultado = {
            ...propuestas,
            chatId,
            mensaje: propuestas.success && propuestas.data.length
              ? 'Elige una de estas opciones para reagendar [RN-083]'
              : propuestas.mensaje
          };
        }
        break;

      default:
        resultado = { success: false, mensaje: 'Respuesta no procesada' };
    }

    // RN-104: la respuesta se registra solo cuando la acción fue aceptada.
    if (resultado.success) {
      try {
        await this._registrarRespuesta(cita.id, respuesta, recordatorioId);
      } catch (error) {
        console.error('[Telegram] No se pudo registrar la respuesta:', error.message);
      }
    }

    return resultado;
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

  async _confirmar(cita, chatId, { origen = 'telegram', cambiadoPor = null } = {}) {
    const confirmada = EstadoCita.fromClave('confirmada');
    if (!cita.estado.esVigente()) {
      return { success: false, chatId, mensaje: `La cita ya no está vigente (estado "${cita.estado.clave}")` };
    }
    if (!cita.puedeTransicionarA(confirmada)) {
      return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "confirmada" [RN-080]` };
    }
    const data = await this.citas.cambiarEstado(cita.id, confirmada.id, {
      cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
      origen,
    });
    return { success: true, chatId, data, mensaje: 'Cita confirmada por Telegram' };
  }

  async _cancelar(cita, chatId, { origen = 'telegram', cambiadoPor = null } = {}) {
    if (!cita.estado.esVigente()) {
      return { success: false, chatId, mensaje: `La cita ya no está vigente (estado "${cita.estado.clave}")` };
    }
    const cancelada = EstadoCita.fromClave('cancelada');
    if (!cita.puedeTransicionarA(cancelada)) {
      return { success: false, chatId, mensaje: `No se puede pasar de "${cita.estado.clave}" a "cancelada" [RN-080]` };
    }
    // La cita ya pasó: no se cancela, se marca como completada/no_asistio.
    if (!cita.esFutura()) {
      return { success: false, chatId, mensaje: 'No puedes cancelar una cita que ya pasó. Contacta a la clínica para más información.' };
    }
    // RN-086 🔶: el plazo mínimo aplica también por Telegram
    if (cita.fueraDePlazoCancelacion(2)) {
      return { success: false, chatId, mensaje: 'Faltan menos de 2 horas para la cita; no es posible cancelarla [RN-086]' };
    }
    const data = await this.citas.cambiarEstado(cita.id, cancelada.id, {
      cambiadoPor: cambiadoPor ?? cita.paciente_usuario_id,
      origen,
    });
    return { success: true, chatId, data, mensaje: 'Cita cancelada por Telegram; el horario quedó libre' };
  }
}

module.exports = ProcesarRespuestaTelegram;
