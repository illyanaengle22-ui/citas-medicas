import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { formatearNumero } from './chartTheme';

export default function StatCard({
  icono,
  etiqueta,
  valor,
  aviso,
  to,
  destacada = false,
}) {
  const valorMostrado = typeof valor === 'number' ? formatearNumero(valor) : valor;
  const clase = [
    'dash-stat',
    destacada ? 'dash-stat--destacada' : '',
    to ? 'dash-stat--enlace' : '',
  ].filter(Boolean).join(' ');

  const contenido = (
    <>
      <span className="dash-stat-icono" aria-hidden="true">
        <FontAwesomeIcon icon={icono} />
      </span>
      <span className="dash-stat-info">
        <span className="dash-stat-valor">{valorMostrado}</span>
        <span className="dash-stat-etiqueta">{etiqueta}</span>
        {aviso && <span className="dash-stat-aviso">{aviso}</span>}
      </span>
      {to && (
        <span className="dash-stat-flecha" aria-hidden="true">
          <FontAwesomeIcon icon={faArrowRight} />
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={clase}
        aria-label={`${etiqueta}: ${valorMostrado}${aviso ? `. ${aviso}` : ''}`}
      >
        {contenido}
      </Link>
    );
  }

  return (
    <article className={clase} aria-label={`${etiqueta}: ${valorMostrado}`}>
      {contenido}
    </article>
  );
}
