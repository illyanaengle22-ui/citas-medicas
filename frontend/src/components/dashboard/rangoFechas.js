export const OPCIONES_RANGO = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '7d', etiqueta: 'Últimos 7 días' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: '30d', etiqueta: 'Últimos 30 días' },
  { id: 'personalizado', etiqueta: 'Personalizado' },
];

export function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function sumarDiasISO(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

export function rangoDePreset(preset) {
  const fin = fechaLocalISO();

  switch (preset) {
    case 'hoy':
      return { inicio: fin, fin };
    case '7d':
      return { inicio: sumarDiasISO(fin, -6), fin };
    case 'mes':
      return { inicio: `${fin.slice(0, 7)}-01`, fin };
    case '30d':
    default:
      return { inicio: sumarDiasISO(fin, -29), fin };
  }
}

export function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const fecha = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fecha);
}

export function formatearRango({ inicio, fin }) {
  if (!inicio || !fin) return '';
  return `Del ${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`;
}
