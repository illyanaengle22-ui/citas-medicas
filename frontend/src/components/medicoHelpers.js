export function inicialesMedico(nombre) {
  const limpio = String(nombre || '').replace(/^Dr\.?\s+/i, '').trim();
  if (!limpio) return '?';
  return limpio
    .split(/\s+/)
    .map((parte) => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function nombreMedico(medico) {
  return medico?.medico_mostrar || (medico?.nombre ? `Dr. ${medico.nombre}` : 'Médico');
}

export function formatearCosto(valor) {
  if (valor === null || valor === undefined || valor === '') return 'Consultar costo';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'Consultar costo';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(numero);
}

export function especialidadPrincipal(medico) {
  const especialidades = Array.isArray(medico?.especialidades) ? medico.especialidades : [];
  if (especialidades.length === 0) return 'Medicina general';
  const primera = especialidades[0]?.nombre || 'Medicina general';
  return especialidades.length > 1
    ? `${primera} +${especialidades.length - 1}`
    : primera;
}
