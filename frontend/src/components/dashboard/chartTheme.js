export const PALETA = [
  '#5E9BBA',
  '#2E9E6B',
  '#B8A528',
  '#D9534F',
  '#8C7BB8',
  '#4A87A6',
  '#E08B4F',
  '#6B8E23',
];

export const COLORES_ROL = {
  admin: '#5E9BBA',
  medico: '#2E9E6B',
  paciente: '#B8A528',
};

export const COLORES_ESTADO = {
  activo: '#2E9E6B',
  pendiente: '#B8A528',
  rechazado: '#D9534F',
};

export const COLORES_CITA = {
  pendiente: '#B8A528',
  confirmada: '#2E9E6B',
  reagendada: '#5E9BBA',
  cancelada: '#D9534F',
  completada: '#6B8E23',
  no_asistio: '#8C7BB8',
};

export const ESTILO_TOOLTIP = {
  borderRadius: 12,
  border: '1px solid var(--borde)',
  boxShadow: 'var(--sombra-hover)',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: '0.85rem',
  padding: '0.65rem 0.8rem',
};

export const ESTILO_EJE = {
  fontSize: 11,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fill: '#2A1B4F',
  opacity: 0.7,
};

const ETIQUETAS_ROL = {
  admin: 'Administrador',
  medico: 'Médico',
  paciente: 'Paciente',
};

const ETIQUETAS_ESTADO = {
  activo: 'Activo',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
};

const ETIQUETAS_CITA = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_asistio: 'No asistió',
};

function capitalizar(valor) {
  const texto = String(valor ?? '').replaceAll('_', ' ');
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Sin dato';
}

export function etiquetaRol(valor) {
  return ETIQUETAS_ROL[valor] ?? capitalizar(valor);
}

export function etiquetaEstado(valor) {
  return ETIQUETAS_ESTADO[valor] ?? capitalizar(valor);
}

export function etiquetaCita(valor) {
  return ETIQUETAS_CITA[valor] ?? capitalizar(valor);
}

export function formatearNumero(valor) {
  const numero = Number(valor);
  return new Intl.NumberFormat('es-MX').format(Number.isFinite(numero) ? numero : 0);
}

export function formatearHoraActualizacion(fecha = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

export function sumarTotales(items) {
  return (items ?? []).reduce((total, item) => total + Number(item?.total ?? 0), 0);
}
