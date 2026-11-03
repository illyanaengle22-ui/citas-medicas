'use strict';

// La BD guarda `timestamptz` y la API expone `fecha_hora` en UTC (ISO 8601).
// Para mensajes de Telegram/n8n y recordatorios necesitamos la hora local de la
// clínica sin depender del TZ del proceso de Node.
const ZONA_HORARIA = process.env.APP_TIMEZONE || 'America/Mexico_City';

function normalizarOffset(valor) {
  const offset = String(valor || '').replace('GMT', '');
  if (/^[+-]\d{2}:\d{2}$/.test(offset)) return offset;
  const partes = offset.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!partes) return '+00:00';
  return `${partes[1]}${partes[2].padStart(2, '0')}:${partes[3] || '00'}`;
}

function partesFechaHoraLocal(fecha) {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) return null;

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(valor);

  const datos = Object.fromEntries(
    partes
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value])
  );

  const offsetParte = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    timeZoneName: 'longOffset',
  })
    .formatToParts(valor)
    .find((parte) => parte.type === 'timeZoneName');

  const offset = normalizarOffset(offsetParte?.value);
  const dia = `${datos.year}-${datos.month}-${datos.day}`;
  const hora = `${datos.hour}:${datos.minute}`;

  return {
    fecha: dia,
    hora,
    iso: `${dia}T${hora}:${datos.second}${offset}`,
  };
}

function formatearFechaHoraLocal(fecha) {
  return partesFechaHoraLocal(fecha);
}

function formatearFechaLocal(fecha) {
  return partesFechaHoraLocal(fecha)?.fecha ?? null;
}

function formatearHoraLocal(fecha) {
  return partesFechaHoraLocal(fecha)?.hora ?? null;
}

function formatearTextoLocal(fecha, opciones = {}) {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) return null;
  return valor.toLocaleString('es-MX', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opciones,
  });
}

// Día ISO 8601 (1 = lunes ... 7 = domingo) en la zona de la clínica,
// sin depender de la zona horaria del proceso de Node.
function diaSemanaLocal(fecha) {
  const partes = partesFechaHoraLocal(fecha);
  if (!partes) return null;
  const [anio, mes, dia] = partes.fecha.split('-').map(Number);
  const diaJs = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaJs === 0 ? 7 : diaJs;
}

// Construye un ISO 8601 con el offset de la clínica para una fecha/hora local.
// Se toma el offset del mediodía de ese día; para México no hay DST desde 2022.
function construirFechaHoraLocal(fecha, hora) {
  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  const [hh, mm] = String(hora).split(':').map(Number);
  if ([anio, mes, dia, hh, mm].some((n) => !Number.isInteger(n))) return null;

  const referencia = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  const partes = partesFechaHoraLocal(referencia);
  if (!partes) return null;
  const offset = partes.iso.slice(-6);

  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    + `T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00${offset}`;
}

module.exports = {
  ZONA_HORARIA,
  formatearFechaHoraLocal,
  formatearFechaLocal,
  formatearHoraLocal,
  formatearTextoLocal,
  diaSemanaLocal,
  construirFechaHoraLocal,
};
