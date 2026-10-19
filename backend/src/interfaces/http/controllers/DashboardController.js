'use strict';

const PostgresUsuarioRepository = require('../../../infrastructure/adapters/PostgresUsuarioRepository');
const ObtenerEstadisticasUsuarios = require('../../../application/use-cases/ObtenerEstadisticasUsuarios');

const repo = new PostgresUsuarioRepository();

async function obtenerEstadisticas(req, res) {
  try {
    // Reutiliza el caso de uso de usuarios para mantener consistencia
    const caso = new ObtenerEstadisticasUsuarios(repo);
    const data = await caso.execute();
    return res.json({ ok: true, stats: data });
  } catch (error) {
    console.error('[Dashboard] Error estadísticas:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener estadísticas' });
  }
}

module.exports = { obtenerEstadisticas };