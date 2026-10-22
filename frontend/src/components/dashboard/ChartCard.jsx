import EmptyState from './EmptyState';

export default function ChartCard({
  id,
  titulo,
  descripcion,
  resumenCorto,
  vacio = false,
  mensajeVacio,
  className = '',
  children,
}) {
  const tituloId = `${id}-titulo`;

  return (
    <section className={`dash-chart ${className}`.trim()} aria-labelledby={tituloId}>
      <header className="dash-chart-cabecera">
        <div>
          <h2 id={tituloId} className="dash-chart-titulo">{titulo}</h2>
          {descripcion && <p className="dash-chart-descripcion">{descripcion}</p>}
        </div>
        {/* Resumen compacto: solo el total del período, alineado a la derecha */}
        {!vacio && resumenCorto && (
          <span className="dash-chart-resumen-corto">{resumenCorto}</span>
        )}
      </header>

      <div className="dash-chart-cuerpo">
        {vacio ? <EmptyState mensaje={mensajeVacio} /> : children}
      </div>
    </section>
  );
}
