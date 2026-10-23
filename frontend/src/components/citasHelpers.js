// Helpers compartidos por las páginas de citas (admin, médico y paciente).
// Centraliza el vocabulario de estados y el formateo de fechas para que las
// tres vistas se vean idénticas.

export const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
  { valor: 7, etiqueta: 'Domingo' },
];

// RN-113: se trabaja por clave, no por id numérico.
export const ESTADOS_CITA = [
  { clave: 'pendiente', etiqueta: 'Pendiente' },
  { clave: 'confirmada', etiqueta: 'Confirmada' },
  { clave: 'reagendada', etiqueta: 'Reagendada' },
  { clave: 'cancelada', etiqueta: 'Cancelada' },
  { clave: 'completada', etiqueta: 'Completada' },
  { clave: 'no_asistio', etiqueta: 'No asistió' },
];

// RN-076: pendiente, confirmada y reagendada ocupan agenda y son modificables.
export const ESTADOS_VIGENTES = ['pendiente', 'confirmada', 'reagendada'];
export const ESTADOS_FINALES = ['cancelada', 'completada', 'no_asistio'];

export function claseEstado(estado) {
  if (estado === 'confirmada' || estado === 'completada') return 'badge badge-exito';
  if (estado === 'cancelada' || estado === 'no_asistio') return 'badge badge-error';
  if (estado === 'reagendada') return 'badge badge-info';
  return 'badge badge-pendiente';
}

export function etiquetaEstado(estado) {
  return ESTADOS_CITA.find((e) => e.clave === estado)?.etiqueta ?? estado ?? '—';
}

export function esVigente(estado) {
  return ESTADOS_VIGENTES.includes(estado);
}

export function esFinal(estado) {
  return ESTADOS_FINALES.includes(estado);
}

// 2026-10-26T16:00:00.000Z → "26 oct 2026, 10:00"
export function formatearFechaHora(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// 2026-10-26T16:00:00.000Z → "26 oct 2026"
export function formatearFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// 2026-10-26T16:00:00.000Z → "10:00"
export function formatearHora(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatearDuracion(minutos) {
  if (!minutos && minutos !== 0) return '—';
  const n = Number(minutos);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// "09:00:00" | "09:00" → "09:00"
export function horaCorta(hora) {
  if (!hora) return '—';
  return String(hora).slice(0, 5);
}

// Date → "YYYY-MM-DD" (usa la zona local del navegador).
export function fechaISO(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Convierte "YYYY-MM-DDTHH:MM" (datetime-local) a ISO completo para el backend.
export function aISOCompleto(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

// Nombres de catálogo como objeto de acceso rápido: { "2": "Consultorio Central" }
export function indicePorId(lista, campoId = 'id', campoNombre = 'nombre') {
  const mapa = {};
  (lista ?? []).forEach((item) => {
    mapa[String(item[campoId])] = item[campoNombre];
  });
  return mapa;
}
