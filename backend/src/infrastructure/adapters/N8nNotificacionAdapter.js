'use strict';

// RN-107: el backend no habla directamente con Telegram; publica el mensaje en un
// webhook de n8n (expuesto con ngrok en desarrollo) y n8n llama a la API de Telegram.
// Implementa NotificacionPort: ambos métodos resuelven { ok, error? }.
class N8nNotificacionAdapter {
  constructor({ webhookUrl = process.env.N8N_WEBHOOK_URL, secret = process.env.N8N_WEBHOOK_SECRET, timeoutMs = 8000 } = {}) {
    this.webhookUrl = webhookUrl;
    this.secret = secret;
    this.timeoutMs = timeoutMs;
  }

  _urlLista() {
    return typeof this.webhookUrl === 'string' && this.webhookUrl.trim() !== '';
  }

  async _post(payload) {
    if (!this._urlLista()) {
      // Sin webhook configurado no debe tumbar el flujo (RN-106: la cita no se afecta).
      return { ok: false, error: 'N8N_WEBHOOK_URL no está configurado' };
    }

    const control = AbortSignal.timeout(this.timeoutMs);
    try {
      const respuesta = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.secret ? { 'x-webhook-secret': this.secret } : {})
        },
        body: JSON.stringify(payload),
        signal: control
      });

      if (!respuesta.ok) {
        return { ok: false, error: `n8n respondió ${respuesta.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async enviar({ chatId, mensaje, tipo = 'texto', referencia = null }) {
    return this._post({ accion: 'enviar', chatId, mensaje, tipo, referencia });
  }

  // RN-100 / RN-101: recordatorio de 24 h o 2 h antes de la cita.
  async enviarRecordatorio({ chatId, cita, tipo }) {
    const cuando = new Date(cita.fecha_hora).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const mensaje =
      tipo === '24h'
        ? `Te recordamos tu cita médica mañana (${cuando}). Responde CONFIRMAR, CANCELAR o REAGENDAR.`
        : `Tu cita médica es en 2 horas (${cuando}). Responde CONFIRMAR, CANCELAR o REAGENDAR.`;

    return this._post({
      accion: 'recordatorio',
      tipo,
      chatId,
      mensaje,
      cita: {
        uuid_publico: cita.uuid_publico,
        fecha_hora: cita.fecha_hora,
        duracion_minutos: cita.duracion_minutos,
        medico_nombre: cita.medico_nombre
      }
    });
  }
}

module.exports = N8nNotificacionAdapter;
