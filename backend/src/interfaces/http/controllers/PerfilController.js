'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../../infrastructure/db');

/**
 * GET /api/usuarios/perfil
 * Devuelve el perfil del usuario autenticado.
 */
async function obtenerPerfil(req, res) {
  try {
    const usuarioId = req.usuario.id;

    const { rows } = await db.query(
      `SELECT u.id, u.nombre, u.email, u.foto_url, u.created_at, u.ultimo_login,
              r.clave AS rol, e.clave AS estado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    return res.json({ ok: true, mensaje: 'Perfil obtenido', data: rows[0] });
  } catch (err) {
    console.error('[Perfil] Error obtenerPerfil:', err.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener el perfil' });
  }
}

/**
 * PUT /api/usuarios/perfil
 * Actualiza nombre, email, password y/o foto del usuario autenticado.
 * Acepta multipart/form-data (si viene foto) o application/json (sin foto).
 */
async function actualizarPerfil(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { nombre, email, password } = req.body;
    const archivoFoto = req.file; // puede ser undefined si no se subió foto

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ ok: false, mensaje: 'El email no tiene un formato válido' });
    }

    if (password && password.trim().length > 0 && password.trim().length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const campos = [];
    const valores = [];
    let idx = 1;

    if (nombre && nombre.trim()) {
      campos.push(`nombre = $${idx++}`);
      valores.push(nombre.trim());
    }

    if (email && email.trim()) {
      campos.push(`email = $${idx++}`);
      valores.push(email.trim().toLowerCase());
    }

    if (password && password.trim().length >= 8) {
      const hash = await bcrypt.hash(password.trim(), 10);
      campos.push(`password_hash = $${idx++}`);
      valores.push(hash);
    }

    if (archivoFoto) {
      // Construye URL relativa accesible via /uploads/perfiles/<filename>
      const fotoUrl = `/uploads/perfiles/${archivoFoto.filename}`;
      campos.push(`foto_url = $${idx++}`);
      valores.push(fotoUrl);
    }

    if (campos.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar' });
    }

    valores.push(usuarioId);

    const { rows } = await db.query(
      `UPDATE usuarios
       SET ${campos.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, nombre, email, foto_url`,
      valores
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    // Mantiene sincronizada la foto del médico en su tabla de perfil público.
    if (archivoFoto && Number(req.usuario.rol_id) === 2) {
      try {
        await db.query(
          `UPDATE medicos SET foto_url = $1
           WHERE usuario_id = $2 AND deleted_at IS NULL`,
          [rows[0].foto_url, usuarioId]
        );
      } catch (syncErr) {
        // La foto ya quedó guardada en usuarios; no se invalida la respuesta.
        console.error('[Perfil] No se pudo sincronizar foto del médico:', syncErr.message);
      }
    }

    return res.json({ ok: true, mensaje: 'Perfil actualizado correctamente', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado por otro usuario' });
    }
    console.error('[Perfil] Error actualizarPerfil:', err.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar el perfil' });
  }
}

module.exports = { obtenerPerfil, actualizarPerfil };
