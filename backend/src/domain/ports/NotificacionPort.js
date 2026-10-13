'use strict';

// RN-107: el backend no habla directamente con Telegram;
// este puerto lo implementa el adaptador de n8n (FASE 2).
// Ambos métodos resuelven { ok: boolean, error?: string }.
class NotificacionPort {
  async enviar({ chatId, mensaje, tipo = 'texto', referencia = null }) {
    throw new Error('Método no implementado');
  }

  // RN-100 / RN-101: recordatorio de 24 h o 2 h antes de la cita
  async enviarRecordatorio({ chatId, cita, tipo }) {
    throw new Error('Método no implementado');
  }
}

module.exports = NotificacionPort;
