import { useState, useMemo } from 'react';
import { faInbox } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function CrudTable({
  columnas,
  datos,
  cargando,
  acciones = [],
  mensajeVacio = 'No hay registros para mostrar',
  buscar = false,
  placeholderBuscar = 'Buscar...',
}) {
  const [termino, setTermino] = useState('');

  const datosFiltrados = useMemo(() => {
    if (!buscar || !termino.trim()) return datos;
    const terminoLower = termino.toLowerCase();
    return datos.filter((fila) =>
      columnas.some((col) => {
        const valor = fila[col.clave];
        return valor != null && String(valor).toLowerCase().includes(terminoLower);
      })
    );
  }, [datos, termino, columnas, buscar]);

  if (cargando) {
    return (
      <div className="crud-cargando">
        <div className="spinner" />
        <span>Cargando...</span>
      </div>
    );
  }

  const hayAcciones = typeof acciones === 'function' || acciones.length > 0;

  return (
    <div className="crud-table-container">
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

      {datosFiltrados.length === 0 ? (
        <div className="crud-vacio">
          <FontAwesomeIcon icon={faInbox} className="crud-vacio-icono" />
          <p>{mensajeVacio}</p>
        </div>
      ) : (
        <div className="crud-table-scroll">
          <table className="crud-table">
            <thead>
              <tr>
                {columnas.map((col) => (
                  <th key={col.clave}>{col.titulo}</th>
                ))}
                {hayAcciones && (
                  <th className="crud-th-acciones">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.map((fila, idx) => {
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
