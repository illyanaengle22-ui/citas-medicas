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
// RN-089: las citas reagendadas pasan directamente a 'confirmada', por lo que
// 'reagendada' ya no se expone como filtro activo en las vistas.
export const ESTADOS_CITA = [
  { clave: 'pendiente', etiqueta: 'Pendiente' },
  { clave: 'confirmada', etiqueta: 'Confirmada' },
  { clave: 'cancelada', etiqueta: 'Cancelada' },
  { clave: 'completada', etiqueta: 'Completada' },
  { clave: 'no_asistio', etiqueta: 'No asistió' },
];

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_asistio: 'No asistió',
};

// RN-076: pendiente y confirmada ocupan agenda y son modificables (RN-089 las reagendadas van a confirmada).
export const ESTADOS_VIGENTES = ['pendiente', 'confirmada'];
export const ESTADOS_FINALES = ['cancelada', 'completada', 'no_asistio'];

export function claseEstado(estado) {
  if (estado === 'confirmada' || estado === 'completada') return 'badge badge-exito';
  if (estado === 'cancelada' || estado === 'no_asistio') return 'badge badge-error';
  if (estado === 'reagendada') return 'badge badge-info';
  return 'badge badge-pendiente';
}

export function etiquetaEstado(estado) {
  return ETIQUETAS_ESTADO[estado] ?? ESTADOS_CITA.find((e) => e.clave === estado)?.etiqueta ?? estado ?? '—';
}

export function esVigente(estado) {
  return ESTADOS_VIGENTES.includes(estado);
}

export function esFinal(estado) {
  return ESTADOS_FINALES.includes(estado);
}

// Regla de completada: se habilita desde 5 minutos antes de la hora de inicio.
// El backend vuelve a validar esta condición; aquí solo controlamos la UI.
export function puedeMarcarCompletada(fechaHora, toleranciaMinutos = 5) {
  if (!fechaHora) return false;
  const inicio = new Date(fechaHora).getTime();
  if (Number.isNaN(inicio)) return false;
  return Date.now() >= inicio - toleranciaMinutos * 60 * 1000;
}

// true si la fecha/hora ya pasó (o es exactamente ahora). Se usa para no
// ofrecer acciones que el backend rechaza, como cancelar una cita pasada.
export function yaPaso(fechaHora) {
  if (!fechaHora) return false;
  const momento = new Date(fechaHora).getTime();
  return !Number.isNaN(momento) && momento <= Date.now();
}

// true si la cita es estrictamente en el futuro
export function esFutura(fechaHora) {
  if (!fechaHora) return false;
  const momento = new Date(fechaHora).getTime();
  return !Number.isNaN(momento) && momento > Date.now();
}

// RN-086: true si faltan menos de X horas para el inicio de la cita
export function faltanMenosDeHoras(fechaHora, horas = 2) {
  if (!fechaHora) return false;
  const momento = new Date(fechaHora).getTime();
  if (Number.isNaN(momento)) return false;
  const limiteMs = horas * 60 * 60 * 1000;
  return momento - Date.now() < limiteMs;
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
