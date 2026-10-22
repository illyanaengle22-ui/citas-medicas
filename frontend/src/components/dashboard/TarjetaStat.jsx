import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function TarjetaStat({
  icono,
  valor,
  etiqueta,
  detalle,
  compacto = false,
}) {
  const valorMostrado = typeof valor === 'number'
    ? new Intl.NumberFormat('es-MX').format(valor)
    : valor;

  return (
    <article className="tarjeta-stat" aria-label={`${etiqueta}: ${valorMostrado}`}>
      <span className="tarjeta-stat-icono" aria-hidden="true">
        <FontAwesomeIcon icon={icono} />
      </span>
      <div className="tarjeta-stat-info">
        <span className={`tarjeta-stat-valor${compacto ? ' tarjeta-stat-valor--compacto' : ''}`}>
          {valorMostrado}
        </span>
        <span className="tarjeta-stat-etiqueta">{etiqueta}</span>
        {detalle && <span className="tarjeta-stat-detalle">{detalle}</span>}
      </div>
    </article>
  );
}
