'use strict';

// Utilidades para el rango de fechas del dashboard administrativo.
// Las fechas viajan como YYYY-MM-DD y se interpretan como días completos.

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_POR_DEFECTO = 30;
const MAX_DIAS = 366;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function esFechaISO(texto) {
  if (typeof texto !== 'string' || !RE_FECHA.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio
    && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia
  );
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function contarDias(fechaInicio, fechaFin) {
  const inicio = Date.parse(`${fechaInicio}T00:00:00Z`);
  const fin = Date.parse(`${fechaFin}T00:00:00Z`);
  return Math.round((fin - inicio) / MS_POR_DIA) + 1;
}

/**
 * Normaliza y valida los query params `fecha_inicio` y `fecha_fin`.
 * - Sin parámetros: últimos 30 días (incluye hoy).
 * - Solo `fecha_inicio`: hasta hoy.
 * - Solo `fecha_fin`: los 30 días que terminan en esa fecha.
 */
function resolverRango(query = {}) {
  const inicioCrudo = query.fecha_inicio;
  const finCrudo = query.fecha_fin;

  if (inicioCrudo !== undefined && !esFechaISO(inicioCrudo)) {
    return { error: 'fecha_inicio debe tener el formato YYYY-MM-DD y ser una fecha válida' };
  }
  if (finCrudo !== undefined && !esFechaISO(finCrudo)) {
    return { error: 'fecha_fin debe tener el formato YYYY-MM-DD y ser una fecha válida' };
  }

  const fechaFin = finCrudo ?? fechaLocalISO();
  const fechaInicio = inicioCrudo ?? sumarDias(fechaFin, -(DIAS_POR_DEFECTO - 1));

  if (fechaInicio > fechaFin) {
    return { error: 'fecha_inicio no puede ser posterior a fecha_fin' };
  }

  const dias = contarDias(fechaInicio, fechaFin);
  if (dias > MAX_DIAS) {
    return { error: `El rango no puede superar ${MAX_DIAS} días` };
  }

  return { fechaInicio, fechaFin, dias };
}

module.exports = {
  DIAS_POR_DEFECTO,
  MAX_DIAS,
  resolverRango,
  esFechaISO,
  sumarDias,
  contarDias,
};
