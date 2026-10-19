'use strict';

const db = require('../../infrastructure/db');
const CitaRepository = require('../../domain/ports/CitaRepository');
const TraslapeError = require('../../domain/value-objects/TraslapeError');

// El EXCLUDE USING gist de citas dispara con código 23P01.
const CODIGO_EXCLUIR = '23P01';

function traducirError(error) {
  if (error && error.code === CODIGO_EXCLUIR) {
    // RN-075: el médico ya tiene una cita vigente que se traslapa en el rango.
    return new TraslapeError('El horario ya fue ocupado para ese médico en esa fecha y hora');
  }
  return error;
}

class PostgresCitaRepository extends CitaRepository {
  // Devuelve la cita con estado y nombre del paciente/médico legibles.
  async crear({ paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos = 30, motivo = null, notas = null, estado_id = 1 }) {
    try {
      const result = await db.query(
        `INSERT INTO citas (paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos, motivo, notas, estado_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
        [paciente_id, medico_id, consultorio_id, fecha_hora, duracion_minutos, motivo, notas, estado_id]
      );
      return result.rows[0];
    } catch (error) {
      throw traducirError(error);
    }
  }

  async obtenerPorId(id) {
    const result = await db.query(
      `SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
              c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
              ec.clave AS estado
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // RN-009: el uuid_publico es el identificador expuesto en API y Telegram.
  async obtenerPorUuid(uuid_publico) {
    const result = await db.query(
      `SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
              c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
              ec.clave AS estado
       FROM citas c
       JOIN estados_cita ec ON ec.id = c.estado_id
       WHERE c.uuid_publico = $1`,
      [uuid_publico]
    );
    return result.rows[0] || null;
  }

  // RN-053: visibilidad por rol. admin ve todas; médico y paciente solo las suyas.
  async listar({ paciente_id = null, medico_id = null, estado = null, fecha_desde = null, fecha_hasta = null, page = 1, limit = 10 } = {}) {
    const condiciones = [];
    const valores = [];

    if (paciente_id !== null) { valores.push(paciente_id); condiciones.push(`c.paciente_id = $${valores.length}`); }
    if (medico_id !== null) { valores.push(medico_id); condiciones.push(`c.medico_id = $${valores.length}`); }
    if (estado !== null) {
      valores.push(estado);
      condiciones.push(`c.estado_id = (SELECT id FROM estados_cita WHERE clave = $${valores.length})`);
    }
    if (fecha_desde !== null) { valores.push(fecha_desde); condiciones.push(`c.fecha_hora >= $${valores.length}`); }
    if (fecha_hasta !== null) { valores.push(fecha_hasta); condiciones.push(`c.fecha_hora <= $${valores.length}`); }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) FROM citas c ${where}`;
    const totalResult = await db.query(countSql, valores);
    const total = parseInt(totalResult.rows[0].count, 10);

    const sql = `
      SELECT c.id, c.uuid_publico, c.paciente_id, c.medico_id, c.consultorio_id, c.fecha_hora,
             c.duracion_minutos, c.fecha_fin, c.estado_id, c.motivo, c.notas, c.created_at, c.updated_at,
             ec.clave AS estado
      FROM citas c
      JOIN estados_cita ec ON ec.id = c.estado_id
      ${where}
      ORDER BY c.fecha_hora ASC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}
    `;
    const result = await db.query(sql, [...valores, limit, offset]);

    return { data: result.rows, total, page, limit };
  }

  // RN-080: la transición se valida en domain antes de llegar aquí.
  // RN-090: el trigger trg_citas_historial registra el cambio (origen 'sistema').
  async cambiarEstado(id, estado_id) {
    const result = await db.query(
      `UPDATE citas SET estado_id = $1 WHERE id = $2
       RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                 duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
      [estado_id, id]
    );
    return result.rows[0] || null;
  }

  // Usado por reagendar: mueve fecha_hora o duración. Dispara de nuevo el
  // trigger de fecha_fin, por lo que un solape posterior también lo detecta la BD.
  async actualizar(id, cambios) {
    const campos = [];
    const valores = [];

    if (cambios.fecha_hora !== undefined) { valores.push(cambios.fecha_hora); campos.push(`fecha_hora = $${valores.length}`); }
    if (cambios.duracion_minutos !== undefined) { valores.push(cambios.duracion_minutos); campos.push(`duracion_minutos = $${valores.length}`); }
    if (cambios.consultorio_id !== undefined) { valores.push(cambios.consultorio_id); campos.push(`consultorio_id = $${valores.length}`); }
    if (cambios.motivo !== undefined) { valores.push(cambios.motivo); campos.push(`motivo = $${valores.length}`); }
    if (cambios.notas !== undefined) { valores.push(cambios.notas); campos.push(`notas = $${valores.length}`); }

    if (campos.length === 0) return null;
    valores.push(id);

    try {
      const result = await db.query(
        `UPDATE citas SET ${campos.join(', ')} WHERE id = $${valores.length}
         RETURNING id, uuid_publico, paciente_id, medico_id, consultorio_id, fecha_hora,
                   duracion_minutos, fecha_fin, estado_id, motivo, notas, created_at, updated_at`,
        valores
      );
      return result.rows[0] || null;
    } catch (error) {
      throw traducirError(error);
    }
  }

  // RN-075: pre-check de traslape para responder "El horario ya fue ocupado"
  // en vez de un error técnico (la BD lo garantiza con EXCLUDE USING gist, RN-074).
  async buscarTraslape({ medico_id, fecha_hora, fecha_fin, excluirId = null }) {
    const valores = [medico_id, fecha_hora, fecha_fin];
    let sql = `SELECT 1 FROM citas
               WHERE medico_id = $1 AND estado_id IN (1, 2, 3)
                 AND tstzrange(fecha_hora, fecha_fin) && tstzrange($2::timestamptz, $3::timestamptz)`;
    if (excluirId !== null) {
      valores.push(excluirId);
      sql += ` AND id <> $${valores.length}`;
    }
    const result = await db.query(sql, valores);
    return result.rows.length > 0;
  }

  // RN-090: historial de estados, de solo inserción (RN-092).
  async listarHistorial(cita_id) {
    const result = await db.query(
      `SELECT h.id, h.cita_id, h.estado_anterior, h.estado_nuevo, h.cambiado_por, h.origen,
              h.comentario, h.created_at,
              ea.clave AS estado_anterior_clave, en.clave AS estado_nuevo_clave
       FROM historial_estados_cita h
       LEFT JOIN estados_cita ea ON ea.id = h.estado_anterior
       JOIN estados_cita en ON en.id = h.estado_nuevo
       WHERE h.cita_id = $1
       ORDER BY h.created_at ASC`,
      [cita_id]
    );
    return result.rows;
  }
}

module.exports = PostgresCitaRepository;
