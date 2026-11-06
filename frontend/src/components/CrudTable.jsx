import { useState, useMemo } from 'react';
import {
  faInbox,
  faArrowDownWideShort,
  faArrowUpWideShort,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function valorFecha(val) {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const num = Number(val);
  if (!Number.isNaN(num) && num > 1000000000000) return num;
  const time = new Date(val).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function CrudTable({
  columnas,
  datos,
  cargando,
  acciones = [],
  mensajeVacio = 'No hay registros para mostrar',
  buscar = false,
  placeholderBuscar = 'Buscar...',
  mostrarOrdenFecha = true,
  columnaFechaProp = null,
}) {
  const [termino, setTermino] = useState('');
  const [ordenFecha, setOrdenFecha] = useState('reciente'); // 'reciente' | 'vieja'

  // Detecta automáticamente qué columna contiene fechas
  const columnaFecha = useMemo(() => {
    if (!mostrarOrdenFecha) return null;
    if (columnaFechaProp) return columnaFechaProp;

    const colExplicita = columnas.find((col) =>
      /^(fecha_hora|fecha|created_at|updated_at|ultima_cita|fecha_cita)$/i.test(col.clave)
    );
    if (colExplicita) return colExplicita.clave;

    const colParcial = columnas.find((col) =>
      /fecha|created/i.test(col.clave)
    );
    if (colParcial) return colParcial.clave;

    if (Array.isArray(datos) && datos.length > 0) {
      const muestra = datos[0];
      for (const col of columnas) {
        const val = muestra[col.clave];
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          return col.clave;
        }
      }
    }
    return null;
  }, [columnas, datos, columnaFechaProp, mostrarOrdenFecha]);

  const alternarOrden = () => {
    setOrdenFecha((prev) => (prev === 'reciente' ? 'vieja' : 'reciente'));
  };

  const datosFiltradosYOrdenados = useMemo(() => {
    let res = datos || [];
    if (buscar && termino.trim()) {
      const terminoLower = termino.toLowerCase();
      res = res.filter((fila) =>
        columnas.some((col) => {
          const valor = fila[col.clave];
          return valor != null && String(valor).toLowerCase().includes(terminoLower);
        })
      );
    }
    if (columnaFecha && ordenFecha) {
      res = [...res].sort((a, b) => {
        const timeA = valorFecha(a[columnaFecha]);
        const timeB = valorFecha(b[columnaFecha]);
        return ordenFecha === 'reciente' ? timeB - timeA : timeA - timeB;
      });
    }
    return res;
  }, [datos, termino, columnas, buscar, columnaFecha, ordenFecha]);

  if (cargando) {
    return (
      <div className="crud-cargando">
        <div className="spinner" />
        <span>Cargando...</span>
      </div>
    );
  }

  const hayAcciones = typeof acciones === 'function' || acciones.length > 0;
  const hayBarraSuperior = buscar || columnaFecha;

  return (
    <div className="crud-table-container">
      {hayBarraSuperior && (
        <div className="crud-barra-superior">
          {buscar && (
            <div className="crud-buscar">
              <input
                type="text"
                className="input crud-buscar-input"
                placeholder={placeholderBuscar}
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
              />
            </div>
          )}

          {columnaFecha && (
            <div className="crud-orden-fecha">
              <FontAwesomeIcon
                icon={ordenFecha === 'reciente' ? faArrowDownWideShort : faArrowUpWideShort}
                className="crud-orden-icono"
                aria-hidden="true"
              />
              <select
                className="input crud-orden-select"
                value={ordenFecha}
                onChange={(e) => setOrdenFecha(e.target.value)}
                aria-label="Ordenar por fecha"
                title="Ordenar por fecha"
              >
                <option value="reciente">Más recientes primero</option>
                <option value="vieja">Más antiguas primero</option>
              </select>
            </div>
          )}
        </div>
      )}

      {datosFiltradosYOrdenados.length === 0 ? (
        <div className="crud-vacio">
          <FontAwesomeIcon icon={faInbox} className="crud-vacio-icono" />
          <p>{mensajeVacio}</p>
        </div>
      ) : (
        <div className="crud-table-scroll">
          <table className="crud-table">
            <thead>
              <tr>
                {columnas.map((col) => {
                  const esFecha = col.clave === columnaFecha;
                  return (
                    <th
                      key={col.clave}
                      className={esFecha ? 'crud-th-ordenable' : ''}
                      onClick={esFecha ? alternarOrden : undefined}
                      title={esFecha ? 'Clic para alternar orden por fecha' : undefined}
                    >
                      <div className="crud-th-contenido">
                        <span>{col.titulo}</span>
                        {esFecha && (
                          <FontAwesomeIcon
                            icon={ordenFecha === 'reciente' ? faArrowDownWideShort : faArrowUpWideShort}
                            className="crud-th-icono-orden"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
                {hayAcciones && (
                  <th className="crud-th-acciones">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {datosFiltradosYOrdenados.map((fila, idx) => {
                const accionesFila = typeof acciones === 'function'
                  ? acciones(fila)
                  : acciones;
                const accionesVisibles = accionesFila.filter(
                  (a) => !a.mostrar || a.mostrar(fila)
                );
                return (
                  <tr key={fila.id ?? idx}>
                    {columnas.map((col) => (
                      <td key={col.clave}>
                        {col.render ? col.render(fila) : fila[col.clave]}
                      </td>
                    ))}
                    {hayAcciones && (
                      <td className="crud-td-acciones">
                        {accionesVisibles.map((accion, i) => (
                          <button
                            key={i}
                            className={`btn btn-sm btn-icono ${accion.clase || 'btn-accion'}`}
                            onClick={() => accion.onClick(fila)}
                            title={accion.titulo}
                            aria-label={accion.titulo}
                            disabled={Boolean(accion.disabled)}
                          >
                            <FontAwesomeIcon icon={accion.icono} />
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
