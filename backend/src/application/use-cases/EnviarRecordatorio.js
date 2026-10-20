'use strict';

const Recordatorio = require('../../domain/entities/Recordatorio');

// RN-100 / RN-101: recordatorios de 24 h o 2 h antes de la cita.
// RN-107: la notificación sale por NotificacionPort (adaptador n8n -> Telegram).
// RN-106: si el envío falla, el recordatorio queda "fallido" y la cita no se ve afectada.
class EnviarRecordatorio {
  constructor(recordatorioRepository, notificacionPort) {
    this.repo = recordatorioRepository;
    this.notif = notificacionPort;
  }

  // Busca candidatos (RN-102) y envía el tipo indicado. Sin candidatos no hace nada.
  async execute({ tipo = Recordatorio.TIPOS.H24, ventanaHoras = null } = {}) {
    if (!Object.values(Recordatorio.TIPOS).includes(tipo)) {
      return { success: false, mensaje: `Tipo de recordatorio inválido: use "${Recordatorio.TIPOS.H24}" o "${Recordatorio.TIPOS.H2}"` };
    }

    const ventana = ventanaHoras != null ? ventanaHoras : (tipo === Recordatorio.TIPOS.H24 ? 24 : 2);
    const candidatos = await this.repo.buscarCandidatos({ tipo, ventanaHoras: ventana });

    let enviados = 0;
    let fallidos = 0;
    const detalles = [];

    for (const cand of candidatos) {
      // RN-105: nunca dos veces el mismo tipo para la misma cita
      if (await this.repo.existeTipo(cand.cita_id, tipo)) continue;

      const recordatorio = await this.repo.crear({ cita_id: cand.cita_id, canal: 'telegram', tipo });

      const r = await this.notif.enviarRecordatorio({
        chatId: cand.telegram_chat_id,
        cita: cand,
        tipo
      });

      if (r.ok) {
        await this.repo.marcarEnviado(recordatorio.id);
        enviados++;
        detalles.push({ cita_id: cand.cita_id, ok: true });
      } else {
        await this.repo.marcarFallido(recordatorio.id);
        fallidos++;
        detalles.push({ cita_id: cand.cita_id, ok: false, error: r.error });
      }
    }

    return {
      success: true,
      data: { total: candidatos.length, enviados, fallidos, detalles },
      mensaje: `${enviados} recordatorio(s) enviado(s), ${fallidos} fallido(s)`
    };
  }
}

module.exports = EnviarRecordatorio;
