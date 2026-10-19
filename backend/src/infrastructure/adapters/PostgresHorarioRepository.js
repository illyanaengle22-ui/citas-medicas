'use strict';

const db = require('../../infrastructure/db');
const HorarioRepository = require('../../domain/ports/HorarioRepository');
const TraslapeError = require('../../domain/value-objects/TraslapeError');

// Columnas que se devuelven al exterior (nunca datos internos).
const COLUMNAS =
  'id, medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo, created_at, updated_at';

// El EXCLUDE USING gist de horarios dispara con código 23P01.
const CODIGO_EXCLUIR = '23P01';

function traducirError(error) {
  if (error && error.code === CODIGO_EXCLUIR) {
    // RN-062: dos bloques del mismo médico y día que se traslapan.
    return new TraslapeError('El médico ya tiene un bloque en ese día y horario que se traslapa');
  }
  return error;
}

class PostgresHorarioRepository extends HorarioRepository {
  async crear({ medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo = true }) {
    try {
      const result = await db.query(
        `INSERT INTO horarios (medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNAS}`,
        [medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo]
      );
      return result.rows[0];
    } catch (error) {
      throw traducirError(error);
    }
  }

  async obtenerPorId(id) {
    const result = await db.query(`SELECT ${COLUMNAS} FROM horarios WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async listarPorMedico(medico_id, { soloActivos = true } = {}) {
    const condiciones = ['medico_id = $1'];
    const valores = [medico_id];

    if (soloActivos) {
      condiciones.push('activo = true');
    }

    const result = await db.query(
      `SELECT ${COLUMNAS} FROM horarios
       WHERE ${condiciones.join(' AND ')}
       ORDER BY dia_semana ASC, hora_inicio ASC`,
      valores
    );
    return result.rows;
  }

  async actualizar(id, cambios) {
    const campos = [];
    const valores = [];

    if (cambios.medico_id !== undefined) { valores.push(cambios.medico_id); campos.push(`medico_id = $${valores.length}`); }
    if (cambios.consultorio_id !== undefined) { valores.push(cambios.consultorio_id); campos.push(`consultorio_id = $${valores.length}`); }
    if (cambios.dia_semana !== undefined) { valores.push(cambios.dia_semana); campos.push(`dia_semana = $${valores.length}`); }
    if (cambios.hora_inicio !== undefined) { valores.push(cambios.hora_inicio); campos.push(`hora_inicio = $${valores.length}`); }
    if (cambios.hora_fin !== undefined) { valores.push(cambios.hora_fin); campos.push(`hora_fin = $${valores.length}`); }
    if (cambios.activo !== undefined) { valores.push(cambios.activo); campos.push(`activo = $${valores.length}`); }

    if (campos.length === 0) return null;

    valores.push(id);

    try {
      const result = await db.query(
        `UPDATE horarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING ${COLUMNAS}`,
        valores
      );
      return result.rows[0] || null;
    } catch (error) {
      throw traducirError(error);
    }
  }

  // RN-064: los horarios se desactivan sin borrarse; las citas agendadas no se tocan.
  async desactivar(id) {
    const result = await db.query(
      `UPDATE horarios SET activo = false WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id]
    );
    return result.rows[0] || null;
  }

  // RN-062: pre-check de traslape (la BD lo garantiza igual con EXCLUDE USING gist).
  async existeTraslape({ medico_id, dia_semana, hora_inicio, hora_fin, excluirId = null }) {
    const valores = [medico_id, dia_semana, hora_inicio, hora_fin];
    let sql = `SELECT 1 FROM horarios
               WHERE medico_id = $1 AND dia_semana = $2 AND activo = true
                 AND timerange(hora_inicio, hora_fin) && timerange($3::time, $4::time)`;
    if (excluirId !== null) {
      valores.push(excluirId);
      sql += ` AND id <> $${valores.length}`;
    }
    const result = await db.query(sql, valores);
    return result.rows.length > 0;
  }

  // RN-065: huecos = horarios activos del día menos el tiempo ocupado por citas vigentes.
  async buscarHuecos({ medico_id, fecha, duracion_minutos, consultorio_id = null }) {
    // fecha llega como 'YYYY-MM-DD'; el día ISO 8601 se resuelve en la BD para
    // no depender de la zona horaria del servidor.
    const diaResult = await db.query(`SELECT EXTRACT(ISODOW FROM $1::date)::int AS dia`, [fecha]);
    const dia_semana = diaResult.rows[0].dia;

    const valoresHorario = [medico_id, dia_semana];
    let sqlHorario = `SELECT id, consultorio_id, hora_inicio, hora_fin FROM horarios
                      WHERE medico_id = $1 AND dia_semana = $2 AND activo = true`;
    if (consultorio_id !== null) {
      valoresHorario.push(consultorio_id);
      sqlHorario += ` AND consultorio_id = $${valoresHorario.length}`;
    }
    sqlHorario += ' ORDER BY hora_inicio ASC';
    const bloques = await db.query(sqlHorario, valoresHorario);

    if (bloques.rows.length === 0) return [];

    // Citas vigentes (pendiente, confirmada, reagendada) de ese médico en ese día.
    const citasResult = await db.query(
      `SELECT fecha_hora, fecha_fin FROM citas
       WHERE medico_id = $1
         AND estado_id IN (1, 2, 3)
         AND fecha_hora::date = $2::date
       ORDER BY fecha_hora ASC`,
      [medico_id, fecha]
    );

    const enMinutos = (t) => {
      const [h, m] = String(t).split(':');
      return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
    };

    const huecos = [];
    const duracion = Number(duracion_minutos);

    for (const bloque of bloques.rows) {
      const bloqueInicio = enMinutos(bloque.hora_inicio);
      const bloqueFin = enMinutos(bloque.hora_fin);

      // Ocupaciones dentro de este bloque, en minutos desde medianoche del día.
      const ocupaciones = citasResult.rows
        .map((c) => ({
          inicio: enMinutos(c.fecha_hora),
          fin: enMinutos(c.fecha_fin)
        }))
        .filter((c) => c.fin > bloqueInicio && c.inicio < bloqueFin)
        .sort((a, b) => a.inicio - b.inicio);

      let cursor = bloqueInicio;
      for (const ocupacion of ocupaciones) {
        if (ocupacion.inicio - cursor >= duracion) {
          huecos.push({
            horario_id: bloque.id,
            consultorio_id: bloque.consultorio_id,
            hora_inicio: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00`,
            hora_fin: `${String(Math.floor(ocupacion.inicio / 60)).padStart(2, '0')}:${String(ocupacion.inicio % 60).padStart(2, '0')}:00`,
            duracion_minutos: ocupacion.inicio - cursor
          });
        }
        cursor = Math.max(cursor, ocupacion.fin);
      }

      if (bloqueFin - cursor >= duracion) {
        huecos.push({
          horario_id: bloque.id,
          consultorio_id: bloque.consultorio_id,
          hora_inicio: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00`,
          hora_fin: `${String(Math.floor(bloqueFin / 60)).padStart(2, '0')}:${String(bloqueFin % 60).padStart(2, '0')}:00`,
          duracion_minutos: bloqueFin - cursor
        });
      }
    }

    return huecos;
  }
}

module.exports = PostgresHorarioRepository;
