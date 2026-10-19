'use strict';

const db = require('../../infrastructure/db');
const RecordatorioRepository = require('../../domain/ports/RecordatorioRepository');
const Recordatorio = require('../../domain/entities/Recordatorio');

const COLUMNAS =
  'id, cita_id, canal, tipo, estado, respuesta, enviado_at, respondido_at';

class PostgresRecordatorioRepository extends RecordatorioRepository {
  // RN-105: se crea un recordatorio de un tipo dado solo si aún no existe para esa cita.
  async crear({ cita_id, canal = 'telegram', tipo, estado = 'enviado' }) {
    const result = await db.query(
      `INSERT INTO recordatorios (cita_id, canal, tipo, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNAS}`,
      [cita_id, canal, tipo, estado]
    );
    return result.rows[0];
  }

  async obtenerPorId(id) {
    const result = await db.query(`SELECT ${COLUMNAS} FROM recordatorios WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async listarPorCita(cita_id) {
    const result = await db.query(
      `SELECT ${COLUMNAS} FROM recordatorios WHERE cita_id = $1 ORDER BY enviado_at ASC`,
      [cita_id]
    );
    return result.rows;
  }

  // RN-105: no se envía el mismo tipo de recordatorio dos veces para la misma cita.
  async existeTipo(cita_id, tipo) {
    const result = await db.query(
      `SELECT 1 FROM recordatorios WHERE cita_id = $1 AND tipo = $2 LIMIT 1`,
      [cita_id, tipo]
    );
    return result.rows.length > 0;
  }

  // RN-102: citas vigentes, con telegram vinculado y sin recordatorio de ese tipo.
  async buscarCandidatos({ tipo, ventanaHoras = 24 } = {}) {
    const result = await db.query(
      `SELECT c.id AS cita_id, c.uuid_publico, c.fecha_hora, c.duracion_minutos,
              p.telegram_chat_id,
              um.nombre AS medico_nombre, up.nombre AS paciente_nombre,
              ec.clave AS estado
       FROM citas c
       JOIN pacientes p ON p.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios um ON um.id = m.usuario_id
       JOIN usuarios up ON up.id = p.usuario_id
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.estado_id IN (1, 2, 3)
         AND p.telegram_chat_id IS NOT NULL
         AND c.fecha_hora > now()
         AND c.fecha_hora <= now() + ($1 || ' hours')::interval
         AND NOT EXISTS (
           SELECT 1 FROM recordatorios r WHERE r.cita_id = c.id AND r.tipo = $2
         )
       ORDER BY c.fecha_hora ASC`,
      [ventanaHoras, tipo]
    );
    return result.rows;
  }

  async marcarEnviado(id) {
    const result = await db.query(
      `UPDATE recordatorios SET estado = 'enviado', enviado_at = now() WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id]
    );
    return result.rows[0] || null;
  }

  // RN-106: si el envío falla, el estado lo refleja y la cita no se ve afectada.
  async marcarFallido(id) {
    const result = await db.query(
      `UPDATE recordatorios SET estado = 'fallido' WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id]
    );
    return result.rows[0] || null;
  }

  // RN-103 / RN-104: respuesta del paciente (confirmar, cancelar, reagendar).
  async registrarRespuesta(id, respuesta) {
    const valido = Object.values(Recordatorio.RESPUESTAS);
    if (!valido.includes(respuesta)) {
      throw new Error(`Respuesta inválida: debe ser una de ${valido.join(', ')}`);
    }
    const result = await db.query(
      `UPDATE recordatorios SET respuesta = $1, respondido_at = now() WHERE id = $2 RETURNING ${COLUMNAS}`,
      [respuesta, id]
    );
    return result.rows[0] || null;
  }
}

module.exports = PostgresRecordatorioRepository;
