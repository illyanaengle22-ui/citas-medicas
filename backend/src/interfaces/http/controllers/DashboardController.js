'use strict';

const PostgresDashboardRepository = require('../../../infrastructure/adapters/PostgresDashboardRepository');
const ObtenerResumenAdmin = require('../../../application/use-cases/ObtenerResumenAdmin');
const ObtenerResumenMedico = require('../../../application/use-cases/ObtenerResumenMedico');
const ObtenerResumenPaciente = require('../../../application/use-cases/ObtenerResumenPaciente');
const { resolverRango } = require('../utils/rangoFechas');

const repo = new PostgresDashboardRepository();

async function obtenerResumenAdmin(req, res) {
  const rango = resolverRango(req.query);

  if (rango.error) {
    return res.status(400).json({ ok: false, mensaje: rango.error });
  }

  try {
    const caso = new ObtenerResumenAdmin(repo);
    const data = await caso.execute(rango);
    return res.json({
      ok: true,
      mensaje: 'Resumen del dashboard administrativo',
      data,
    });
  } catch (error) {
    console.error('[Dashboard] Error al obtener resumen admin:', error.message);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener el resumen del dashboard',
    });
  }
}

async function obtenerResumenMedico(req, res) {
  try {
    const caso = new ObtenerResumenMedico(repo);
    const data = await caso.execute(req.usuario.id);
    return res.json({
      ok: true,
      mensaje: 'Resumen del dashboard médico',
      data,
    });
  } catch (error) {
    console.error('[Dashboard] Error al obtener resumen médico:', error.message);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener el resumen del dashboard',
    });
  }
}

async function obtenerResumenPaciente(req, res) {
  try {
    const caso = new ObtenerResumenPaciente(repo);
    const data = await caso.execute(req.usuario.id);
    return res.json({
      ok: true,
      mensaje: 'Resumen del dashboard paciente',
      data,
    });
  } catch (error) {
    console.error('[Dashboard] Error al obtener resumen paciente:', error.message);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener el resumen del dashboard',
    });
  }
}

module.exports = { obtenerResumenAdmin, obtenerResumenMedico, obtenerResumenPaciente };
