'use strict';

const estadosValidos = {
  enviado: 'enviado',
  fallido: 'fallido'
};

class Recordatorio {
  static TIPOS = Object.freeze({ H24: '24h', H2: '2h' });
  static RESPUESTAS = Object.freeze({ CONFIRMAR: 'confirmar', CANCELAR: 'cancelar', REAGENDAR: 'reagendar' });

  constructor({ id, cita_id, canal = 'telegram', tipo, estado = 'enviado', respuesta = null, enviado_at, respondido_at }) {
    this.id = id;
    this.cita_id = cita_id;
    this.canal = canal;
    this.tipo = tipo;
    this.estado = estado;
    this.respuesta = respuesta;
    this.enviado_at = enviado_at;
    this.respondido_at = respondido_at;
  }

  static fromRow(row) {
    return new Recordatorio(row);
  }

  // RN-100: primer recordatorio 24 horas antes
  esDe24Horas() {
    return this.tipo === Recordatorio.TIPOS.H24;
  }

  // RN-101: segundo recordatorio 2 horas antes
  esDe2Horas() {
    return this.tipo === Recordatorio.TIPOS.H2;
  }

  // RN-103: el paciente responde confirmar, cancelar o reagendar
  tieneRespuesta() {
    return this.respuesta !== null && this.respuesta !== undefined;
  }

  // RN-106: el estado refleja si el envío falló; la cita no se ve afectada
  fueExitoso() {
    return this.estado === estadosValidos.enviado;
  }

  fallo() {
    return this.estado === estadosValidos.fallido;
  }
}

module.exports = Recordatorio;
