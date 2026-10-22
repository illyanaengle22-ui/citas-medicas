import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';

export default function EmptyState({ mensaje = 'Aún no hay datos para mostrar', icono = faChartLine }) {
  return (
    <div className="dash-empty" role="status">
      <span className="dash-empty-icono" aria-hidden="true">
        <FontAwesomeIcon icon={icono} />
      </span>
      <p>{mensaje}</p>
    </div>
  );
}
