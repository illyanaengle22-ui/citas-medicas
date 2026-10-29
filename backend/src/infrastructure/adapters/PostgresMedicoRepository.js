'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../infrastructure/db');
const MedicoRepository = require('../../domain/ports/MedicoRepository');
const Medico = require('../../domain/entities/Medico');

// ── Errores de dominio ─────────────────────────────────────────────────────
class DuplicadoEmailError extends Error {
  constructor() { super('El email ya está registrado'); this.name = 'DuplicadoEmailError'; }
}
class DuplicadoCedulaError extends Error {
  constructor() { super('La cédula profesional ya está registrada'); this.name = 'DuplicadoCedulaError'; }
}
class CitasPendientesError extends Error {
  constructor() { super('El médico tiene citas pendientes'); this.name = 'CitasPendientesError'; }
}
class EspecialidadInvalidaError extends Error {
  constructor(id) { super(`La especialidad con id ${id} no existe o está inactiva`); this.name = 'EspecialidadInvalidaError'; }
}
class ConsultorioInvalidoError extends Error {
  constructor(id) { super(`El consultorio con id ${id} no existe o está inactivo`); this.name = 'ConsultorioInvalidoError'; }
}

// ── Columnas SELECT para el formato estable (RN-047) ──────────────────────
// pg devuelve BIGINT como string; mantenemos ese comportamiento para
// consistencia con Usuarios y Consultorios (no se toca el parser global).
const SQL_MEDICO_COMPLETO = `
  SELECT
    m.id,
    m.usuario_id,
    u.nombre,
    u.email,
    CONCAT('Dr. ', u.nombre)                            AS medico_mostrar,
    m.cedula_profesional,
    m.telefono,
    m.foto_url,
    m.costo_consulta,
    m.activo,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', me.especialidad_id, 'nombre', e.nombre))
        FILTER (WHERE me.especialidad_id IS NOT NULL),
      '[]'
    )                                                   AS especialidades,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', mc.consultorio_id::text, 'nombre', c.nombre))
        FILTER (WHERE mc.consultorio_id IS NOT NULL),
      '[]'
    )                                                   AS consultorios
  FROM medicos m
  JOIN usuarios u ON u.id = m.usuario_id AND u.deleted_at IS NULL
  LEFT JOIN medico_especialidades me ON me.medico_id = m.id
  LEFT JOIN especialidades e ON e.id = me.especialidad_id
  LEFT JOIN medico_consultorios mc ON mc.medico_id = m.id
  LEFT JOIN consultorios c ON c.id = mc.consultorio_id AND c.deleted_at IS NULL
`;

class PostgresMedicoRepository extends MedicoRepository {

  // ── Normalización ─────────────────────────────────────────────────────────
  _normalizarNombre(nombre) {
    return String(nombre).trim().replace(/\s+/g, ' ');
  }

  _normalizarTelefono(telefono) {
    if (telefono === undefined || telefono === null) return null;
    const soloDigitos = String(telefono).replace(/[\s\-()]/g, '');
    return soloDigitos === '' ? null : soloDigitos;
  }

  _normalizarEmail(email) {
    return String(email).trim().toLowerCase();
  }

  _normalizarCosto(costo) {
    if (costo === undefined || costo === null || costo === '') return null;
    const numero = Number(costo);
    if (!Number.isFinite(numero)) return null;
    return Number(numero.toFixed(2));
  }

  // ── Validación de relaciones ───────────────────────────────────────────────
  async _validarEspecialidadesActivas(ids, client) {
    for (const id of ids) {
      const r = await client.query(
        'SELECT 1 FROM especialidades WHERE id = $1 AND activo = true',
        [id]
      );
      if (r.rows.length === 0) throw new EspecialidadInvalidaError(id);
    }
  }

  async _validarConsultoriosActivos(ids, client) {
    for (const id of ids) {
      const r = await client.query(
        'SELECT 1 FROM consultorios WHERE id = $1 AND activo = true AND deleted_at IS NULL',
        [id]
      );
      if (r.rows.length === 0) throw new ConsultorioInvalidoError(id);
    }
  }

  // ── Mapeo de fila a entidad ────────────────────────────────────────────────
  _filaAEntidad(row) {
    return new Medico({
      id:                row.id,
      usuario_id:        row.usuario_id,
      nombre:            row.nombre,
      email:             row.email,
      medico_mostrar:    row.medico_mostrar,
      cedula_profesional: row.cedula_profesional,
      telefono:          row.telefono,
      foto_url:          row.foto_url,
      costo_consulta:    row.costo_consulta === null ? null : Number(row.costo_consulta),
      activo:            row.activo,
      especialidades:    row.especialidades,
      consultorios:      row.consultorios,
    });
  }

  // ── listar ────────────────────────────────────────────────────────────────
  // RN-044: no-admin solo ve médicos activos con ≥1 especialidad activa.
  // RN-047: formato estable.
  async listar({ incluirInactivos = false, soloConEspecialidad = false,
                  especialidadId = null, consultorioId = null, q = null } = {}) {
    const condiciones = ['m.deleted_at IS NULL'];
    const valores = [];

    if (!incluirInactivos) {
      condiciones.push('m.activo = true');
    }

    if (especialidadId !== null) {
      valores.push(especialidadId);
      condiciones.push(`EXISTS (
        SELECT 1 FROM medico_especialidades me2
        WHERE me2.medico_id = m.id AND me2.especialidad_id = $${valores.length}
      )`);
    }

    if (consultorioId !== null) {
      valores.push(consultorioId);
      condiciones.push(`EXISTS (
        SELECT 1 FROM medico_consultorios mc2
        WHERE mc2.medico_id = m.id AND mc2.consultorio_id = $${valores.length}
      )`);
    }

    if (q && String(q).trim() !== '') {
      valores.push(`%${String(q).trim()}%`);
      condiciones.push(`(u.nombre ILIKE $${valores.length} OR m.cedula_profesional ILIKE $${valores.length})`);
    }

    // RN-044: no-admin solo ve médicos con al menos una especialidad activa
    if (soloConEspecialidad) {
      condiciones.push(`EXISTS (
        SELECT 1 FROM medico_especialidades me3
        JOIN especialidades e3 ON e3.id = me3.especialidad_id
        WHERE me3.medico_id = m.id AND e3.activo = true
      )`);
    }

    const sql = `
      ${SQL_MEDICO_COMPLETO}
      WHERE ${condiciones.join(' AND ')}
      GROUP BY m.id, u.nombre, u.email, m.cedula_profesional, m.telefono, m.foto_url, m.costo_consulta, m.activo, m.usuario_id
      ORDER BY u.nombre ASC
    `;

    const result = await db.query(sql, valores);
    return result.rows.map(r => this._filaAEntidad(r));
  }

  // ── obtenerPorId ──────────────────────────────────────────────────────────
  async obtenerPorId(id, { soloActivo = false } = {}) {
    const condiciones = ['m.id = $1', 'm.deleted_at IS NULL', 'u.deleted_at IS NULL'];
    if (soloActivo) condiciones.push('m.activo = true');

    const sql = `
      ${SQL_MEDICO_COMPLETO}
      WHERE ${condiciones.join(' AND ')}
      GROUP BY m.id, u.nombre, u.email, m.cedula_profesional, m.telefono, m.foto_url, m.costo_consulta, m.activo, m.usuario_id
    `;
    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) return null;
    return this._filaAEntidad(result.rows[0]);
  }

  // ── crear (RN-042: todo en una transacción) ───────────────────────────────
  async crear({ nombre, email, password, cedula_profesional, telefono,
                foto_url = null, costo_consulta = null,
                especialidades = [], consultorios = [] }) {
    const nombreNorm  = this._normalizarNombre(nombre);
    const emailNorm   = this._normalizarEmail(email);
    const telNorm     = this._normalizarTelefono(telefono);
    const costoNorm   = this._normalizarCosto(costo_consulta);
    const hash        = await bcrypt.hash(password, 10);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Validar especialidades y consultorios ANTES de insertar nada
      if (especialidades.length > 0) await this._validarEspecialidadesActivas(especialidades, client);
      if (consultorios.length  > 0) await this._validarConsultoriosActivos(consultorios, client);

      // Insertar usuario con rol 'medico' y estado 'activo' por subconsulta (RN-113)
      let usuarioResult;
      try {
        usuarioResult = await client.query(`
          INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
          VALUES (
            $1, $2, $3,
            (SELECT id FROM roles WHERE clave = 'medico'),
            (SELECT id FROM estados_cuenta WHERE clave = 'activo')
          )
          RETURNING id
        `, [nombreNorm, emailNorm, hash]);
      } catch (err) {
        if (err.code === '23505') throw new DuplicadoEmailError();
        throw err;
      }
      const usuario_id = usuarioResult.rows[0].id;

      // Insertar en medicos
      let medicoResult;
      try {
        medicoResult = await client.query(`
          INSERT INTO medicos (usuario_id, cedula_profesional, telefono, foto_url, costo_consulta)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [usuario_id, cedula_profesional, telNorm, foto_url, costoNorm]);
      } catch (err) {
        if (err.code === '23505') throw new DuplicadoCedulaError();
        throw err;
      }
      const medico_id = medicoResult.rows[0].id;

      // Insertar especialidades
      for (const espId of especialidades) {
        await client.query(
          'INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [medico_id, espId]
        );
      }

      // Insertar consultorios
      for (const conId of consultorios) {
        await client.query(
          'INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [medico_id, conId]
        );
      }

      await client.query('COMMIT');

      // Retornar con formato completo
      return await this.obtenerPorId(medico_id);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (re) {
        console.error('[Medicos] Error en ROLLBACK de crear:', re.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ── actualizar (nombre y email viven en usuarios) ─────────────────────────
  async actualizar(id, { nombre, email, cedula_profesional, telefono, password,
                         foto_url, costo_consulta }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Verificar que el médico existe
      const existe = await client.query(
        'SELECT usuario_id FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (existe.rows.length === 0) { await client.query('ROLLBACK'); return null; }
      const { usuario_id } = existe.rows[0];

      // Actualizar usuarios
      const camposU = [];
      const valsU   = [];
      if (nombre !== undefined) {
        camposU.push(`nombre = $${valsU.length + 1}`);
        valsU.push(this._normalizarNombre(nombre));
      }
      if (email !== undefined) {
        camposU.push(`email = $${valsU.length + 1}`);
        valsU.push(this._normalizarEmail(email));
      }
      if (password && password.trim() !== '') {
        camposU.push(`password_hash = $${valsU.length + 1}`);
        valsU.push(await bcrypt.hash(password, 10));
      }
      if (camposU.length > 0) {
        valsU.push(usuario_id);
        try {
          await client.query(
            `UPDATE usuarios SET ${camposU.join(', ')} WHERE id = $${valsU.length} AND deleted_at IS NULL`,
            valsU
          );
        } catch (err) {
          if (err.code === '23505') throw new DuplicadoEmailError();
          throw err;
        }
      }

      // Actualizar medicos
      const camposM = [];
      const valsM   = [];
      if (cedula_profesional !== undefined) {
        camposM.push(`cedula_profesional = $${valsM.length + 1}`);
        valsM.push(cedula_profesional);
      }
      if (telefono !== undefined) {
        camposM.push(`telefono = $${valsM.length + 1}`);
        valsM.push(this._normalizarTelefono(telefono));
      }
      if (foto_url !== undefined) {
        camposM.push(`foto_url = $${valsM.length + 1}`);
        valsM.push(foto_url);
      }
      if (costo_consulta !== undefined) {
        camposM.push(`costo_consulta = $${valsM.length + 1}`);
        valsM.push(this._normalizarCosto(costo_consulta));
      }
      if (camposM.length > 0) {
        valsM.push(id);
        try {
          await client.query(
            `UPDATE medicos SET ${camposM.join(', ')} WHERE id = $${valsM.length} AND deleted_at IS NULL`,
            valsM
          );
        } catch (err) {
          if (err.code === '23505') throw new DuplicadoCedulaError();
          throw err;
        }
      }

      await client.query('COMMIT');
      return await this.obtenerPorId(id);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (re) {
        console.error('[Medicos] Error en ROLLBACK de actualizar:', re.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ── cambiarEstado ──────────────────────────────────────────────────────────
  async cambiarEstado(id, activo) {
    const result = await db.query(
      `UPDATE medicos SET activo = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [activo, id]
    );
    if (result.rows.length === 0) return null;
    return await this.obtenerPorId(id);
  }

  // ── reemplazarEspecialidades (transacción: borra + inserta) ───────────────
  async reemplazarEspecialidades(id, especialidadIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const existe = await client.query(
        'SELECT 1 FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id]
      );
      if (existe.rows.length === 0) { await client.query('ROLLBACK'); return null; }

      if (especialidadIds.length > 0) await this._validarEspecialidadesActivas(especialidadIds, client);

      // Borrar las que ya no están
      if (especialidadIds.length > 0) {
        await client.query(
          `DELETE FROM medico_especialidades
           WHERE medico_id = $1 AND especialidad_id <> ALL($2::smallint[])`,
          [id, especialidadIds]
        );
      } else {
        await client.query('DELETE FROM medico_especialidades WHERE medico_id = $1', [id]);
      }

      // Insertar las nuevas
      for (const espId of especialidadIds) {
        await client.query(
          'INSERT INTO medico_especialidades (medico_id, especialidad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, espId]
        );
      }

      await client.query('COMMIT');
      return await this.obtenerPorId(id);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (re) {
        console.error('[Medicos] Error en ROLLBACK de reemplazarEspecialidades:', re.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ── reemplazarConsultorios ────────────────────────────────────────────────
  async reemplazarConsultorios(id, consultorioIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const existe = await client.query(
        'SELECT 1 FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id]
      );
      if (existe.rows.length === 0) { await client.query('ROLLBACK'); return null; }

      if (consultorioIds.length > 0) await this._validarConsultoriosActivos(consultorioIds, client);

      if (consultorioIds.length > 0) {
        await client.query(
          `DELETE FROM medico_consultorios
           WHERE medico_id = $1 AND consultorio_id <> ALL($2::bigint[])`,
          [id, consultorioIds]
        );
      } else {
        await client.query('DELETE FROM medico_consultorios WHERE medico_id = $1', [id]);
      }

      for (const conId of consultorioIds) {
        await client.query(
          'INSERT INTO medico_consultorios (medico_id, consultorio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, conId]
        );
      }

      await client.query('COMMIT');
      return await this.obtenerPorId(id);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (re) {
        console.error('[Medicos] Error en ROLLBACK de reemplazarConsultorios:', re.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ── eliminar (RN-045: soft delete en medicos + usuario, con check de citas) ─
  async eliminar(id) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Verificar que existe
      const existe = await client.query(
        'SELECT usuario_id FROM medicos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (existe.rows.length === 0) { await client.query('ROLLBACK'); return null; }
      const { usuario_id } = existe.rows[0];

      // Verificar citas futuras vigentes (pendiente, confirmada, reagendada) por clave (RN-113)
      // La consulta funciona igual si la tabla está vacía.
      const citas = await client.query(`
        SELECT 1 FROM citas
        WHERE medico_id = $1
          AND estado_id IN (
            SELECT id FROM estados_cita WHERE clave IN ('pendiente','confirmada','reagendada')
          )
          AND fecha_hora > now()
        LIMIT 1
      `, [id]);

      if (citas.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new CitasPendientesError();
      }

      // Soft delete en medicos y su usuario (RN-045)
      await client.query(
        'UPDATE medicos  SET deleted_at = now() WHERE id = $1', [id]
      );
      await client.query(
        'UPDATE usuarios SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [usuario_id]
      );

      await client.query('COMMIT');
      return { id };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (re) {
        console.error('[Medicos] Error en ROLLBACK de eliminar:', re.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  PostgresMedicoRepository,
  DuplicadoEmailError,
  DuplicadoCedulaError,
  CitasPendientesError,
  EspecialidadInvalidaError,
  ConsultorioInvalidoError,
};
