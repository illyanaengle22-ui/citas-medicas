'use strict';

const db = require('../../../infrastructure/db');

const rolesValidos = { 1: 'admin', 2: 'medico', 3: 'paciente' };

function rolClave(usuario) {
  return rolesValidos[usuario?.rol_id] || null;
}

function esAdmin(usuario) {
  return rolClave(usuario) === 'admin';
}

// El JWT guarda el id de `usuarios`; los controladores necesitan el id de la
// tabla `medicos` o `pacientes` para filtrar por rol (RN-053 / matriz de permisos).
async function medicoIdDeUsuario(usuarioId) {
  const result = await db.query(
    'SELECT id FROM medicos WHERE usuario_id = $1 AND deleted_at IS NULL',
    [usuarioId]
  );
  return result.rows[0]?.id ?? null;
}

async function pacienteIdDeUsuario(usuarioId) {
  const result = await db.query(
    'SELECT id FROM pacientes WHERE usuario_id = $1 AND deleted_at IS NULL',
    [usuarioId]
  );
  return result.rows[0]?.id ?? null;
}

// RN-063: un médico solo puede tener horarios en consultorios a los que está asignado.
async function medicoTieneConsultorio(medicoId, consultorioId) {
  const result = await db.query(
    `SELECT 1 FROM medico_consultorios mc
     JOIN consultorios c ON c.id = mc.consultorio_id AND c.deleted_at IS NULL
     WHERE mc.medico_id = $1 AND mc.consultorio_id = $2`,
    [medicoId, consultorioId]
  );
  return result.rows.length > 0;
}

module.exports = {
  rolClave,
  esAdmin,
  medicoIdDeUsuario,
  pacienteIdDeUsuario,
  medicoTieneConsultorio,
};
