import { apiFetch, construirQuery } from './api';

const LIMITE_POR_PAGINA = 100;

/**
 * Descarga todas las citas visibles para el usuario autenticado.
 *
 * `GET /api/citas` pagina con un máximo de 100 registros por petición. El
 * calendario necesita el conjunto completo para no dejar citas fuera, así que
 * recorre las páginas hasta consumir `total`.
 *
 * La visibilidad sigue siendo la del backend:
 *   - admin  → todas las citas
 *   - médico → solo las de su agenda
 *   - paciente → solo las suyas
 */
export async function obtenerTodasLasCitas(filtros = {}) {
  const citas = [];
  let pagina = 1;
  let total = null;

  while (total === null || citas.length < total) {
    const data = await apiFetch(
      `/api/citas${construirQuery({ ...filtros, page: pagina, limit: LIMITE_POR_PAGINA })}`
    );

    const lote = Array.isArray(data?.citas) ? data.citas : [];
    citas.push(...lote);

    const totalBackend = Number(data?.total);
    total = Number.isFinite(totalBackend) ? totalBackend : citas.length;

    if (lote.length === 0 || lote.length < LIMITE_POR_PAGINA) break;
    pagina += 1;
  }

  return citas;
}
