import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Selector múltiple reutilizable con buscador y checkboxes.
 *
 * Props:
 *  id            – prefijo para los ids de los controles
 *  etiqueta      – nombre accesible del grupo
 *  opciones      – [{ valor, etiqueta, deshabilitado? }]
 *  valor         – arreglo de valores seleccionados (se normalizan a string)
 *  onChange      – recibe el nuevo arreglo de valores string
 *  soloLectura   – muestra solo las etiquetas seleccionadas
 *  cargando      – muestra el estado de carga
 *  aviso         – { mensaje, enlace?, textoEnlace? } cuando no hay opciones activas
 *  mensajeVacio  – texto cuando no hay opciones y no hay aviso
 */
export default function MultiSelect({
  id = 'multi-select',
  etiqueta = '',
  opciones = [],
  valor = [],
  onChange,
  soloLectura = false,
  cargando = false,
  placeholder = 'Buscar…',
  aviso = null,
  mensajeVacio = 'No hay opciones disponibles',
}) {
  const [filtro, setFiltro] = useState('');

  const seleccionados = useMemo(
    () => (Array.isArray(valor) ? valor : []).map(String),
    [valor]
  );

  const termino = filtro.trim().toLowerCase();
  const visibles = termino === ''
    ? opciones
    : opciones.filter((op) => String(op.etiqueta).toLowerCase().includes(termino));

  const orden = useMemo(
    () => new Map(opciones.map((op, i) => [String(op.valor), i])),
    [opciones]
  );

  function alternar(valorOpcion) {
    const siguiente = new Set(seleccionados);
    if (siguiente.has(valorOpcion)) siguiente.delete(valorOpcion);
    else siguiente.add(valorOpcion);

    // Conservar el orden de las opciones para que el resultado sea estable.
    onChange(
      [...siguiente].sort(
        (a, b) => (orden.get(a) ?? Number.MAX_SAFE_INTEGER) - (orden.get(b) ?? Number.MAX_SAFE_INTEGER)
      )
    );
  }

  if (soloLectura) {
    const etiquetas = opciones
      .filter((op) => seleccionados.includes(String(op.valor)))
      .map((op) => op.etiqueta);
    return (
      <div className="multi-select-solo-lectura">
        {etiquetas.length > 0 ? etiquetas.join(', ') : '—'}
      </div>
    );
  }

  // Si no hay opciones activas, se muestra el aviso con enlace en vez de un
  // selector vacío. Si hay opciones (por ejemplo, asignaciones inactivas en
  // edición), se muestra el aviso junto con la lista para no perder datos.
  const ocultarSelector = !cargando && opciones.length === 0 && !!aviso;

  return (
    <div className="multi-select">
      {aviso && !cargando && (
        <div className="multi-select-aviso" role="status">
          <span>{aviso.mensaje}</span>
          {aviso.enlace && (
            <Link className="multi-select-aviso-enlace" to={aviso.enlace}>
              {aviso.textoEnlace || 'Ir a gestionar'}
            </Link>
          )}
        </div>
      )}

      {!ocultarSelector && (
        <>
          <div className="multi-select-cabecera">
            <input
              type="text"
              id={`${id}-buscar`}
              className="input multi-select-buscar"
              placeholder={placeholder}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label={`Buscar en ${etiqueta || id}`}
            />
            <span className="multi-select-contador">
              {seleccionados.length} seleccionada{seleccionados.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="multi-select-lista" role="group" aria-label={etiqueta || id}>
            {cargando ? (
              <span className="multi-select-vacio">Cargando opciones…</span>
            ) : visibles.length === 0 ? (
              <span className="multi-select-vacio">
                {opciones.length === 0 ? mensajeVacio : 'Sin resultados'}
              </span>
            ) : (
              visibles.map((op) => {
                const valorOpcion = String(op.valor);
                const marcada = seleccionados.includes(valorOpcion);
                return (
                  <label
                    key={valorOpcion}
                    className={`multi-select-opcion${marcada ? ' seleccionada' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      disabled={op.deshabilitado}
                      onChange={() => alternar(valorOpcion)}
                    />
                    <span>{op.etiqueta}</span>
                  </label>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
