'use strict';

const PostgresRecordatorioRepository = require('../adapters/PostgresRecordatorioRepository');
const N8nNotificacionAdapter = require('../adapters/N8nNotificacionAdapter');
const EnviarRecordatorio = require('../../application/use-cases/EnviarRecordatorio');
const Recordatorio = require('../../domain/entities/Recordatorio');

// RN-100 / RN-101: sin un proceso que dispare los recordatorios, la regla no
// se cumple aunque el caso de uso exista. Este job revisa periódicamente las
// citas próximas y envía el recordatorio de 24 h y el de 2 h.
function iniciarRecordatorios({
  intervaloMs = Number(process.env.REMINDERS_INTERVAL_MS) || 5 * 60 * 1000,
} = {}) {
  if (process.env.REMINDERS_ENABLED === 'false') {
    console.log('[Recordatorios] Scheduler desactivado por REMINDERS_ENABLED=false');
    return null;
  }
  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn('[Recordatorios] N8N_WEBHOOK_URL no configurado; scheduler desactivado');
    return null;
  }

  const caso = new EnviarRecordatorio(
    new PostgresRecordatorioRepository(),
    new N8nNotificacionAdapter()
  );

  let ejecutando = false;
  const ejecutar = async () => {
    if (ejecutando) return;
    ejecutando = true;
    try {
      for (const tipo of [Recordatorio.TIPOS.H24, Recordatorio.TIPOS.H2]) {
        const resultado = await caso.execute({ tipo });
        if (resultado.data?.enviados || resultado.data?.fallidos) {
          console.log(`[Recordatorios] ${tipo}: ${resultado.mensaje}`);
        }
      }
    } catch (error) {
      console.error('[Recordatorios] Error en el ciclo:', error.message);
    } finally {
      ejecutando = false;
    }
  };

  const timer = setInterval(ejecutar, Math.max(60_000, intervaloMs));
  timer.unref();
  // Primera ejecución inmediata para no esperar hasta 5 minutos tras un deploy.
  ejecutar();
  console.log(`[Recordatorios] Scheduler activo cada ${Math.round(intervaloMs / 1000)}s`);
  return timer;
}

module.exports = { iniciarRecordatorios };
