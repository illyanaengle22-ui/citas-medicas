'use strict';

const PostgresCitaRepository = require('../../infrastructure/adapters/PostgresCitaRepository');
const PostgresRecordatorioRepository = require('../../infrastructure/adapters/PostgresRecordatorioRepository');
const PostgresHorarioRepository = require('../../infrastructure/adapters/PostgresHorarioRepository');
const ProcesarRespuestaTelegram = require('../../application/use-cases/ProcesarRespuestaTelegram');
const Recordatorio = require('../../domain/entities/Recordatorio');

const citaRepo = new PostgresCitaRepository();
const recordatorioRepo = new PostgresRecordatorioRepository();
const horarioRepo = new PostgresHorarioRepository();

// RN-107: el webhook es el único punto de entrada de n8n. No usa JWT de usuario:
// se autentica con el secreto compartido (N8N_WEBHOOK_SECRET) en la cabecera
// x-webhook-secret, el mismo que envía el adaptador de salida.
function secretValido(req) {
  const esperado = process.env.N8N_WEBHOOK_SECRET;
  // Sin secreto configurado se acepta en desarrollo; en producción se debe definir.
  if (!esperado) return true;
  return req.headers['x-webhook-secret'] === esperado;
}

function responder400(res, mensaje) {
  return res.status(400).json({ ok: false, mensaje });
}

// uuid_publico es columna UUID de PostgreSQL: un valor mal formado haría
// fallar la consulta con 22P02, así que se valida aquí y se responde 400.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/webhooks/n8n/respuesta
// Body: { chatId, uuidCita, respuesta: 'confirmar'|'cancelar'|'reagendar', recordatorioId? }
// RN-103: el paciente responde desde Telegram; la cita se actualiza según la respuesta.
async function recibirRespuesta(req, res) {
  if (!secretValido(req)) {
    return res.status(401).json({ ok: false, mensaje: 'Secreto de webhook inválido' });
  }

  try {
    const { chatId, uuidCita, respuesta, recordatorioId } = req.body || {};

    if (!uuidCita || typeof uuidCita !== 'string') {
      return responder400(res, 'uuidCita es requerido');
    }
    if (!RE_UUID.test(uuidCita)) {
      return responder400(res, 'uuidCita no tiene un formato de UUID válido');
    }
    if (!Object.values(Recordatorio.RESPUESTAS).includes(respuesta)) {
      return responder400(
        res,
        `respuesta inválida; use: ${Object.values(Recordatorio.RESPUESTAS).join(', ')}`
      );
    }
    if (chatId !== undefined && chatId !== null && typeof chatId !== 'string' && typeof chatId !== 'number') {
      return responder400(res, 'chatId debe ser texto o número');
    }

    const caso = new ProcesarRespuestaTelegram(citaRepo, recordatorioRepo, horarioRepo);
    const resultado = await caso.execute({
      chatId: chatId ?? null,
      uuidCita,
      respuesta,
      recordatorioId: recordatorioId ?? null,
    });

    if (!resultado.success) {
      return responder400(res, resultado.mensaje);
    }

    // Si es reagendar, n8n recibe las opciones para enviarlas por Telegram (RN-083).
    return res.json({ ok: true, mensaje: resultado.mensaje, data: resultado.data ?? null });
  } catch (error) {
    console.error('[Webhook n8n] Error al procesar respuesta:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al procesar la respuesta' });
  }
}

// POST /api/webhooks/n8n/health — ping para que n8n verifique la conexión.
async function salud(req, res) {
  if (!secretValido(req)) {
    return res.status(401).json({ ok: false, mensaje: 'Secreto de webhook inválido' });
  }
  return res.json({ ok: true, mensaje: 'Webhook n8n activo' });
}

module.exports = { recibirRespuesta, salud };
