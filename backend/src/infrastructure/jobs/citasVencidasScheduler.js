'use strict';

const db = require('../db');

/**
 * RN-087: Citas pasadas: Si una cita pasa de su hora de fin y sigue "pendiente" o "confirmada",
 * el sistema la marcará como "no_asistio" (origen: sistema).
 *
 * RN-088: Citas sin confirmar: Si una cita se crea en estado "pendiente" y no es confirmada
 * por el paciente en 30 minutos, el sistema la cancelará automáticamente para liberar el horario
 * (origen: sistema, motivo: "Expirada por falta de confirmación").
 */
async function ejecutarLimpiezaCitasVencidas() {
  // 1. RN-087: Citas 'pendiente' o 'confirmada' cuya fecha_hora + duracion_minutos < NOW() -> 'no_asistio'
  let client1 = null;
  try {
    client1 = await db.getClient();
    await client1.query('BEGIN');
    await client1.query(
      `SELECT set_config('app.cambiado_por', '', true),
              set_config('app.origen', 'sistema', true),
              set_config('app.comentario', 'Cita pasada sin asistencia', true)`
    );
    const res1 = await client1.query(
      `UPDATE citas
       SET estado_id = (SELECT id FROM estados_cita WHERE clave = 'no_asistio')
       WHERE estado_id IN (SELECT id FROM estados_cita WHERE clave IN ('pendiente', 'confirmada'))
         AND (fecha_hora + (duracion_minutos * INTERVAL '1 minute')) < NOW()
       RETURNING id`
    );
    await client1.query('COMMIT');
    if (res1.rowCount > 0) {
      console.log(`[CitasVencidas] RN-087: ${res1.rowCount} cita(s) pasada(s) marcada(s) como 'no_asistio'`);
    }
  } catch (error) {
    if (client1) {
      try { await client1.query('ROLLBACK'); } catch (_) { /* ignorar */ }
    }
    console.error('[CitasVencidas] Error al procesar RN-087 (citas pasadas):', error.message);
  } finally {
    if (client1) client1.release();
  }

  // 2. RN-088: Citas 'pendiente' con created_at > 30 min de antigüedad y fecha_hora futura -> 'cancelada'
  let client2 = null;
  try {
    client2 = await db.getClient();
    await client2.query('BEGIN');
    await client2.query(
      `SELECT set_config('app.cambiado_por', '', true),
              set_config('app.origen', 'sistema', true),
              set_config('app.comentario', 'Expirada por falta de confirmación', true)`
    );
    const res2 = await client2.query(
      `UPDATE citas
       SET estado_id = (SELECT id FROM estados_cita WHERE clave = 'cancelada'),
           motivo = COALESCE(motivo, 'Expirada por falta de confirmación')
       WHERE estado_id = (SELECT id FROM estados_cita WHERE clave = 'pendiente')
         AND created_at < (NOW() - INTERVAL '30 minutes')
         AND fecha_hora > NOW()
       RETURNING id`
    );
    await client2.query('COMMIT');
    if (res2.rowCount > 0) {
      console.log(`[CitasVencidas] RN-088: ${res2.rowCount} cita(s) no confirmada(s) cancelada(s) por expiración`);
    }
  } catch (error) {
    if (client2) {
      try { await client2.query('ROLLBACK'); } catch (_) { /* ignorar */ }
    }
    console.error('[CitasVencidas] Error al procesar RN-088 (citas no confirmadas):', error.message);
  } finally {
    if (client2) client2.release();
  }
}

function iniciarCitasVencidasScheduler({
  intervaloMs = Number(process.env.CITAS_VENCIDAS_INTERVAL_MS) || 15 * 60 * 1000,
} = {}) {
  if (process.env.CITAS_VENCIDAS_ENABLED === 'false') {
    console.log('[CitasVencidas] Scheduler desactivado por CITAS_VENCIDAS_ENABLED=false');
    return null;
  }

  let ejecutando = false;
  const ejecutar = async () => {
    if (ejecutando) return;
    ejecutando = true;
    try {
      await ejecutarLimpiezaCitasVencidas();
    } catch (error) {
      console.error('[CitasVencidas] Error en el ciclo del scheduler:', error.message);
    } finally {
      ejecutando = false;
    }
  };

  const timer = setInterval(ejecutar, Math.max(60_000, intervaloMs));
  timer.unref();

  // Primera ejecución inmediata al arrancar
  ejecutar();
  console.log(`[CitasVencidas] Scheduler activo cada ${Math.round(intervaloMs / 1000 / 60)} min`);
  return timer;
}

module.exports = {
  ejecutarLimpiezaCitasVencidas,
  iniciarCitasVencidasScheduler,
};
