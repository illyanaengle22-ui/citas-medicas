'use strict';

const db = require('../../infrastructure/db');
const DashboardRepository = require('../../domain/ports/DashboardRepository');

class PostgresDashboardRepository extends DashboardRepository {
  async obtenerTotales(fechaInicio, fechaFin) {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM usuarios
          WHERE deleted_at IS NULL) AS usuarios,
        (SELECT COUNT(*)::int
           FROM usuarios u
           JOIN estados_cuenta ec ON ec.id = u.estado_id
          WHERE u.deleted_at IS NULL
            AND ec.clave = 'pendiente') AS pendientes,
        (SELECT COUNT(*)::int
           FROM medicos m
           JOIN usuarios u ON u.id = m.usuario_id
          WHERE m.deleted_at IS NULL
            AND m.activo = TRUE
            AND u.deleted_at IS NULL) AS "medicosActivos",
        (SELECT COUNT(*)::int
           FROM pacientes p
           JOIN usuarios u ON u.id = p.usuario_id
          WHERE p.deleted_at IS NULL
            AND u.deleted_at IS NULL) AS pacientes,
        (SELECT COUNT(*)::int
           FROM consultorios
          WHERE deleted_at IS NULL
            AND activo = TRUE) AS "consultoriosActivos",
        (SELECT COUNT(*)::int
           FROM especialidades
          WHERE activo = TRUE) AS "especialidadesActivas",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= CURRENT_DATE
            AND fecha_hora < CURRENT_DATE + INTERVAL '1 day'
            AND fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasHoy",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= date_trunc('month', now())
            AND fecha_hora < date_trunc('month', now()) + INTERVAL '1 month'
            AND fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasMes",
        (SELECT COUNT(*)::int
           FROM citas
          WHERE fecha_hora >= $1::date
            AND fecha_hora < $2::date + INTERVAL '1 day') AS "citasRango"
    `, [fechaInicio, fechaFin]);

    return result.rows[0];
  }

  async obtenerUsuariosPorRol() {
    const result = await db.query(`
      SELECT r.clave AS rol, COUNT(u.id)::int AS total
        FROM roles r
        LEFT JOIN usuarios u
          ON u.rol_id = r.id
         AND u.deleted_at IS NULL
       GROUP BY r.id, r.clave
       ORDER BY r.id
    `);
    return result.rows;
  }

  async obtenerUsuariosPorEstado() {
    const result = await db.query(`
      SELECT ec.clave AS estado, COUNT(u.id)::int AS total
        FROM estados_cuenta ec
        LEFT JOIN usuarios u
          ON u.estado_id = ec.id
         AND u.deleted_at IS NULL
       GROUP BY ec.id, ec.clave
       ORDER BY ec.id
    `);
    return result.rows;
  }

  async obtenerRegistrosPorMes(fechaInicio, fechaFin, agrupacion = 'mes') {
    if (agrupacion === 'dia') {
      const result = await db.query(`
        WITH dias AS (
          SELECT generate_series(
            $1::date,
            $2::date,
            INTERVAL '1 day'
          )::date AS dia
        )
        SELECT
          to_char(d.dia, 'YYYY-MM-DD') AS fecha,
          trim(to_char(d.dia, 'TMDD "de" TMMonth')) AS etiqueta,
          COUNT(u.id)::int AS total
        FROM dias d
        LEFT JOIN usuarios u
          ON u.deleted_at IS NULL
         AND u.created_at >= d.dia
         AND u.created_at < d.dia + INTERVAL '1 day'
        GROUP BY d.dia
        ORDER BY d.dia
      `, [fechaInicio, fechaFin]);
      return result.rows;
    }

    const result = await db.query(`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', $1::date),
          date_trunc('month', $2::date),
          INTERVAL '1 month'
        ) AS mes
      )
      SELECT
        to_char(m.mes, 'YYYY-MM') AS mes,
        trim(to_char(m.mes, 'TMMonth YYYY')) AS etiqueta,
        COUNT(u.id)::int AS total
      FROM meses m
      LEFT JOIN usuarios u
        ON u.deleted_at IS NULL
       AND u.created_at >= GREATEST(m.mes, $1::date)
       AND u.created_at < LEAST(m.mes + INTERVAL '1 month', $2::date + INTERVAL '1 day')
      GROUP BY m.mes
      ORDER BY m.mes
    `, [fechaInicio, fechaFin]);
    return result.rows;
  }

  async obtenerMedicosPorEspecialidad() {
    const result = await db.query(`
      SELECT e.nombre AS especialidad, COUNT(DISTINCT m.id)::int AS total
        FROM medicos m
        JOIN usuarios u
          ON u.id = m.usuario_id
         AND u.deleted_at IS NULL
        JOIN medico_especialidades me ON me.medico_id = m.id
        JOIN especialidades e ON e.id = me.especialidad_id
       WHERE m.deleted_at IS NULL
         AND m.activo = TRUE
         AND e.activo = TRUE
       GROUP BY e.id, e.nombre
       ORDER BY total DESC, especialidad ASC
       LIMIT 8
    `);
    return result.rows;
  }

  async obtenerMedicosPorConsultorio() {
    const result = await db.query(`
      SELECT c.nombre AS consultorio, COUNT(DISTINCT m.id)::int AS total
        FROM medicos m
        JOIN usuarios u
          ON u.id = m.usuario_id
         AND u.deleted_at IS NULL
        JOIN medico_consultorios mc ON mc.medico_id = m.id
        JOIN consultorios c
          ON c.id = mc.consultorio_id
         AND c.deleted_at IS NULL
         AND c.activo = TRUE
       WHERE m.deleted_at IS NULL
         AND m.activo = TRUE
       GROUP BY c.id, c.nombre
       ORDER BY total DESC, consultorio ASC
    `);
    return result.rows;
  }

  async obtenerCitasPorEstado(fechaInicio, fechaFin) {
    const result = await db.query(`
      SELECT ec.clave AS estado, COUNT(c.id)::int AS total
        FROM estados_cita ec
        LEFT JOIN citas c
          ON c.estado_id = ec.id
         AND c.fecha_hora >= $1::date
         AND c.fecha_hora < $2::date + INTERVAL '1 day'
       GROUP BY ec.id, ec.clave
       ORDER BY ec.id
    `, [fechaInicio, fechaFin]);
    return result.rows;
  }

  async obtenerCitasPorDia(fechaInicio, fechaFin) {
    const result = await db.query(`
      WITH dias AS (
        SELECT generate_series(
          $1::date,
          $2::date,
          INTERVAL '1 day'
        )::date AS dia
      )
      SELECT
        to_char(d.dia, 'YYYY-MM-DD') AS fecha,
        trim(to_char(d.dia, 'TMDD "de" TMMonth')) AS etiqueta,
        COUNT(c.id)::int AS total
      FROM dias d
      LEFT JOIN citas c
        ON c.fecha_hora >= d.dia
       AND c.fecha_hora < d.dia + INTERVAL '1 day'
      GROUP BY d.dia
      ORDER BY d.dia
    `, [fechaInicio, fechaFin]);
    return result.rows;
  }

  async obtenerPorcentajes(fechaInicio, fechaFin) {
    const result = await db.query(`
      WITH usuarios AS (
        SELECT
          COUNT(*)::numeric AS total,
          COUNT(*) FILTER (WHERE ec.clave = 'pendiente')::numeric AS pendientes
        FROM usuarios u
        JOIN estados_cuenta ec ON ec.id = u.estado_id
        WHERE u.deleted_at IS NULL
      ), citas AS (
        SELECT
          COUNT(*)::numeric AS total,
          COUNT(*) FILTER (WHERE ec.clave = 'confirmada')::numeric AS confirmadas
        FROM citas c
        JOIN estados_cita ec ON ec.id = c.estado_id
        WHERE c.fecha_hora >= $1::date
          AND c.fecha_hora < $2::date + INTERVAL '1 day'
      )
      SELECT
        COALESCE(
          ROUND(100.0 * u.pendientes / NULLIF(u.total, 0), 1),
          0
        )::float8 AS "cuentasPendientes",
        COALESCE(
          ROUND(100.0 * c.confirmadas / NULLIF(c.total, 0), 1),
          0
        )::float8 AS "citasConfirmadas"
      FROM usuarios u
      CROSS JOIN citas c
    `, [fechaInicio, fechaFin]);
    return result.rows[0];
  }

  async obtenerDuracionPromedio(fechaInicio, fechaFin) {
    const result = await db.query(`
      WITH promedio AS (
        SELECT COALESCE(ROUND(AVG(duracion_minutos)), 0)::int AS minutos
        FROM citas
        WHERE fecha_hora >= $1::date
          AND fecha_hora < $2::date + INTERVAL '1 day'
      )
      SELECT
        minutos AS "duracionPromedioCitas",
        CONCAT(
          TRUNC(minutos / 60.0)::int,
          ' h ',
          MOD(minutos, 60),
          ' min'
        ) AS "duracionPromedioTexto"
      FROM promedio
    `, [fechaInicio, fechaFin]);
    return result.rows[0];
  }

  // ── Dashboard del médico ────────────────────────────────────────────────

  async obtenerTotalesMedico(usuarioId) {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN medicos m ON m.id = c.medico_id
          WHERE m.usuario_id = $1
            AND m.deleted_at IS NULL
            AND c.fecha_hora >= CURRENT_DATE
            AND c.fecha_hora < CURRENT_DATE + INTERVAL '1 day') AS "citasHoy",
        (SELECT COUNT(DISTINCT c.paciente_id)::int
           FROM citas c
           JOIN medicos m ON m.id = c.medico_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE m.usuario_id = $1
            AND m.deleted_at IS NULL
            AND ec.clave = 'completada') AS "pacientesAtendidos"
    `, [usuarioId]);
    return result.rows[0];
  }

  async obtenerProximasCitasMedico(usuarioId) {
    const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        up.nombre AS paciente
      FROM citas c
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.usuario_id = $1
       AND m.deleted_at IS NULL
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN usuarios up
        ON up.id = p.usuario_id
       AND up.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.fecha_hora >= now()
        AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
      ORDER BY c.fecha_hora ASC
      LIMIT 5
    `, [usuarioId]);
    return result.rows;
  }

  async obtenerAgendaHoyMedico(usuarioId) {
    const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        up.nombre AS paciente
      FROM citas c
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.usuario_id = $1
       AND m.deleted_at IS NULL
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN usuarios up
        ON up.id = p.usuario_id
       AND up.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      WHERE c.fecha_hora >= CURRENT_DATE
        AND c.fecha_hora < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY c.fecha_hora ASC
    `, [usuarioId]);
    return result.rows;
  }

  async obtenerCitasSemanaMedico(usuarioId) {
    const result = await db.query(`
      WITH dias AS (
        SELECT generate_series(
          date_trunc('week', CURRENT_DATE)::date,
          (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date,
          INTERVAL '1 day'
        )::date AS dia
      )
      SELECT
        to_char(d.dia, 'YYYY-MM-DD') AS fecha,
        trim(to_char(d.dia, 'TMDy DD')) AS etiqueta,
        COUNT(c.id)::int AS total
      FROM dias d
      LEFT JOIN medicos m
        ON m.usuario_id = $1
       AND m.deleted_at IS NULL
      LEFT JOIN citas c
        ON c.medico_id = m.id
       AND c.fecha_hora >= d.dia
       AND c.fecha_hora < d.dia + INTERVAL '1 day'
       AND c.estado_id IN (1, 2, 3, 5)
      GROUP BY d.dia
      ORDER BY d.dia
    `, [usuarioId]);
    return result.rows;
  }

  // ── Dashboard del paciente ──────────────────────────────────────────────

  async obtenerTotalesPaciente(usuarioId) {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE p.usuario_id = $1
            AND p.deleted_at IS NULL
            AND c.fecha_hora >= now()
            AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')) AS "citasProgramadas",
        (SELECT COUNT(*)::int
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN estados_cita ec ON ec.id = c.estado_id
          WHERE p.usuario_id = $1
            AND p.deleted_at IS NULL
            AND ec.clave = 'completada') AS "citasCompletadas"
    `, [usuarioId]);
    return result.rows[0];
  }

  async obtenerProximasCitasPaciente(usuarioId) {
    const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        um.nombre AS medico,
        e.nombre AS especialidad,
        co.nombre AS consultorio
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      JOIN consultorios co ON co.id = c.consultorio_id
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      WHERE c.fecha_hora >= now()
        AND ec.clave IN ('pendiente', 'confirmada', 'reagendada')
      ORDER BY c.fecha_hora ASC
      LIMIT 5
    `, [usuarioId]);
    return result.rows;
  }

  async obtenerMedicoPrincipalPaciente(usuarioId) {
    const result = await db.query(`
      SELECT
        um.nombre AS medico,
        e.nombre AS especialidad,
        COUNT(*)::int AS total
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      GROUP BY m.id, um.nombre, e.nombre
      ORDER BY total DESC, um.nombre ASC
      LIMIT 1
    `, [usuarioId]);
    return result.rows[0] ?? null;
  }

  async obtenerHistorialCitasPaciente(usuarioId) {
    const result = await db.query(`
      SELECT
        c.id,
        c.fecha_hora AS "fechaHora",
        to_char(c.fecha_hora, 'YYYY-MM-DD') AS fecha,
        to_char(c.fecha_hora, 'HH24:MI') AS hora,
        c.duracion_minutos AS "duracionMinutos",
        c.motivo,
        ec.clave AS estado,
        um.nombre AS medico,
        e.nombre AS especialidad,
        co.nombre AS consultorio
      FROM citas c
      JOIN pacientes p
        ON p.id = c.paciente_id
       AND p.usuario_id = $1
       AND p.deleted_at IS NULL
      JOIN medicos m
        ON m.id = c.medico_id
       AND m.deleted_at IS NULL
      JOIN usuarios um
        ON um.id = m.usuario_id
       AND um.deleted_at IS NULL
      JOIN estados_cita ec ON ec.id = c.estado_id
      JOIN consultorios co ON co.id = c.consultorio_id
      LEFT JOIN LATERAL (
        SELECT esp.nombre
          FROM medico_especialidades me
          JOIN especialidades esp ON esp.id = me.especialidad_id
         WHERE me.medico_id = m.id
           AND esp.activo = TRUE
         ORDER BY esp.nombre ASC
         LIMIT 1
      ) e ON TRUE
      WHERE (c.fecha_hora < now()
         OR ec.clave IN ('completada', 'cancelada', 'no_asistio'))
      ORDER BY c.fecha_hora DESC
      LIMIT 20
    `, [usuarioId]);
    return result.rows;
  }
}

module.exports = PostgresDashboardRepository;
