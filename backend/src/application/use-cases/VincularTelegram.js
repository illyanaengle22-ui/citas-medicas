'use strict';

const RE_CHAT_ID = /^-?\d{1,30}$/;
const RE_CODIGO = /^[A-Z0-9]{6}$/;

function normalizarChatId(valor) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return RE_CHAT_ID.test(limpio) ? limpio : null;
}

function normalizarCodigo(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^\/START\s+/i, '')
    .trim()
    .toUpperCase();
}

function esErrorDeDatos(error) {
  return error?.code === '22003' || error?.code === '22P02';
}

// RN-116: vincula un chat de Telegram con la cuenta de un paciente canjeando
// el código de 6 caracteres que genera la webapp.
//
// El caso de uso es idempotente a propósito: n8n puede reiniciarse y perder la
// memoria de qué chats ya vinculó, pero la verdad vive en la tabla `pacientes`
// (`telegram_chat_id`). Si el chat ya está vinculado no se toca nada y se
// responde "Ya vinculado", de modo que el bot siga siendo utilizable.
class VincularTelegram {
  constructor(db) {
    this.db = db;
  }

  // Paciente dueño de un chatId, exista o no un usuario activo detrás.
  async pacientePorChat(chatId) {
    const { rows } = await this.db.query(
      `SELECT p.id AS paciente_id,
              u.id, u.uuid_publico, u.email, u.rol_id, u.nombre,
              (e.clave = 'activo') AS activo
       FROM pacientes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.telegram_chat_id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL`,
      [chatId]
    );

    const fila = rows[0];
    if (!fila) return null;

    return {
      pacienteId: String(fila.paciente_id),
      activo: fila.activo === true,
      usuario: fila.activo
        ? {
            id: fila.id,
            uuid_publico: fila.uuid_publico,
            email: fila.email,
            rol_id: fila.rol_id,
            nombre: fila.nombre,
          }
        : null,
    };
  }

  // GET /api/telegram/estado/:chatId — ¿este chat ya está vinculado?
  async estadoPorChat(chatId) {
    const chat = normalizarChatId(chatId);
    if (!chat) {
      return { status: 400, ok: false, mensaje: 'chatId inválido' };
    }

    const vinculado = await this.pacientePorChat(chat);
    return {
      status: 200,
      ok: true,
      mensaje: 'Estado de vinculación',
      data: {
        vinculado: Boolean(vinculado),
        paciente_id: vinculado ? vinculado.pacienteId : null,
      },
    };
  }

  // POST /api/telegram/vincular — n8n recibe "/start <código>" y lo canjea.
  async execute({ chatId, codigo } = {}) {
    const chat = normalizarChatId(chatId);
    if (!chat) {
      return { status: 400, ok: false, mensaje: 'chatId inválido' };
    }

    // Idempotencia: el chat ya está en la BD, no hay nada que canjear.
    const yaVinculado = await this.pacientePorChat(chat);
    if (yaVinculado) {
      return { status: 200, ok: true, mensaje: 'Ya vinculado', data: yaVinculado };
    }

    const cod = normalizarCodigo(codigo);
    if (!cod) {
      return { status: 400, ok: false, mensaje: 'codigo es requerido' };
    }
    if (!RE_CODIGO.test(cod)) {
      return { status: 400, ok: false, mensaje: 'Código inválido: debe tener 6 caracteres alfanuméricos' };
    }

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT codigo, paciente_id, creado_en, expira_en, usado_en, usado_chat_id
         FROM telegram_codigos
         WHERE codigo = $1
         FOR UPDATE`,
        [cod]
      );
      const registro = rows[0];

      if (!registro) {
        await client.query('ROLLBACK');
        return { status: 400, ok: false, mensaje: 'Código no existe o no fue generado en esta webapp' };
      }

      if (registro.usado_en) {
        // Reintento del mismo chat con el mismo código: idempotente.
        if (registro.usado_chat_id === chat) {
          const vinculado = await client.query(
            'SELECT 1 FROM pacientes WHERE id = $1 AND telegram_chat_id = $2 AND deleted_at IS NULL',
            [registro.paciente_id, chat]
          );
          if (vinculado.rows.length > 0) {
            const usuario = await this._usuarioActivo(client, registro.paciente_id);
            await client.query('COMMIT');
            return {
              status: 200,
              ok: true,
              mensaje: 'Ya vinculado',
              data: { pacienteId: String(registro.paciente_id), activo: Boolean(usuario), usuario },
            };
          }
        }

        await client.query('ROLLBACK');
        return { status: 409, ok: false, mensaje: 'Este código ya fue utilizado; genera uno nuevo en la webapp' };
      }

      if (new Date(registro.expira_en).getTime() <= Date.now()) {
        await client.query('ROLLBACK');
        return { status: 400, ok: false, mensaje: 'Código expirado; genera uno nuevo en la webapp' };
      }

      const chatEnUso = await client.query(
        `SELECT id FROM pacientes
         WHERE telegram_chat_id = $1 AND id <> $2 AND deleted_at IS NULL`,
        [chat, registro.paciente_id]
      );
      if (chatEnUso.rows.length > 0) {
        await client.query('ROLLBACK');
        return { status: 409, ok: false, mensaje: 'Este chat ya está vinculado a otra cuenta [RN-051]' };
      }

      const usuario = await this._usuarioActivo(client, registro.paciente_id);
      if (!usuario) {
        await client.query('ROLLBACK');
        return { status: 409, ok: false, mensaje: 'La cuenta del paciente no está activa; no se puede vincular' };
      }

      const actualizado = await client.query(
        `UPDATE pacientes
         SET telegram_chat_id = $1, updated_at = now()
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [chat, registro.paciente_id]
      );
      if (actualizado.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 409, ok: false, mensaje: 'No se pudo vincular: el chat o la cuenta ya está en uso' };
      }

      const marcado = await client.query(
        `UPDATE telegram_codigos
         SET usado_en = now(), usado_chat_id = $1
         WHERE codigo = $2 AND usado_en IS NULL
         RETURNING codigo`,
        [chat, cod]
      );
      if (marcado.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 409, ok: false, mensaje: 'El código ya fue utilizado; genera uno nuevo en la webapp' };
      }

      await client.query('COMMIT');

      return {
        status: 200,
        ok: true,
        mensaje: 'Cuenta vinculada correctamente',
        data: { pacienteId: String(registro.paciente_id), activo: true, usuario },
      };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      // RN-051: un chat no puede estar ligado a dos pacientes.
      if (error.code === '23505') {
        return { status: 409, ok: false, mensaje: 'Este chat ya está vinculado a otra cuenta [RN-051]' };
      }
      if (esErrorDeDatos(error)) {
        return { status: 400, ok: false, mensaje: 'Dato inválido' };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // DELETE /api/telegram/vincular — el paciente desvincula su propia cuenta.
  async desvincularPorPaciente(pacienteId) {
    return this._desvincular({ pacienteId });
  }

  // DELETE /api/telegram/vincular/:chatId — n8n desvincula un chat.
  async desvincularPorChat(chatId) {
    const chat = normalizarChatId(chatId);
    if (!chat) {
      return { status: 400, ok: false, mensaje: 'chatId inválido' };
    }
    return this._desvincular({ chatId: chat });
  }

  // Deja `pacientes.telegram_chat_id` en NULL. Es idempotente: si la cuenta ya
  // no estaba vinculada responde 200 con `desvinculado: false`.
  async _desvincular({ pacienteId = null, chatId = null } = {}) {
    if (pacienteId === null && chatId === null) {
      return { status: 400, ok: false, mensaje: 'Falta el paciente o el chatId' };
    }

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE pacientes
            SET telegram_chat_id = NULL, updated_at = now()
          WHERE deleted_at IS NULL
            AND telegram_chat_id IS NOT NULL
            AND ($1::bigint IS NULL OR id = $1)
            AND ($2::text IS NULL OR telegram_chat_id = $2)
          RETURNING id`,
        [pacienteId, chatId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          status: 200,
          ok: true,
          mensaje: 'La cuenta no estaba vinculada',
          data: { desvinculado: false },
        };
      }

      // Un código pendiente no debe volver a vincular el chat sin pasar por la webapp.
      await client.query(
        'DELETE FROM telegram_codigos WHERE paciente_id = $1 AND usado_en IS NULL',
        [rows[0].id]
      );

      await client.query('COMMIT');
      return {
        status: 200,
        ok: true,
        mensaje: 'Cuenta desvinculada',
        data: { desvinculado: true, paciente_id: String(rows[0].id) },
      };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (esErrorDeDatos(error)) {
        return { status: 400, ok: false, mensaje: 'Dato inválido' };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async _usuarioActivo(client, pacienteId) {
    const { rows } = await client.query(
      `SELECT u.id, u.uuid_publico, u.email, u.rol_id, u.nombre
       FROM usuarios u
       JOIN pacientes p ON p.usuario_id = u.id
       JOIN estados_cuenta e ON e.id = u.estado_id
       WHERE p.id = $1
         AND p.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND e.clave = 'activo'`,
      [pacienteId]
    );
    return rows[0] || null;
  }
}

module.exports = { VincularTelegram, normalizarChatId, normalizarCodigo };
