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

module.exports = {
  ZONA_HORARIA,
  formatearFechaHoraLocal,
  formatearFechaLocal,
  formatearHoraLocal,
  formatearTextoLocal,
};
