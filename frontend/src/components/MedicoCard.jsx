import { useState } from 'react';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { urlArchivo } from '../services/api';
import {
  especialidadPrincipal,
  formatearCosto,
  inicialesMedico,
  nombreMedico,
} from './medicoHelpers';
import './MedicoCard.css';

/**
 * Tarjeta de médico reutilizable.
 *
 * Si recibe `onSelect`, se renderiza como botón seleccionable (por ejemplo,
 * en el wizard de agendamiento). Sin `onSelect` es una tarjeta informativa.
 */
export default function MedicoCard({ medico, onSelect, selected = false, className = '' }) {
  const [fotoFallida, setFotoFallida] = useState(null);
  const foto = urlArchivo(medico?.foto_url);
  const nombre = nombreMedico(medico);
  const especialidad = especialidadPrincipal(medico);
  const activo = medico?.activo !== false;
  const mostrarFoto = foto && fotoFallida !== foto;

  const clases = [
    'medico-card',
    selected ? 'medico-card--seleccionado' : '',
    className,
  ].filter(Boolean).join(' ');

  const contenido = (
    <>
      <div className="medico-card-foto">
        {mostrarFoto ? (
          <img
            src={foto}
            alt={`Foto de ${nombre}`}
            loading="lazy"
            onError={() => setFotoFallida(foto)}
          />
        ) : (
          <div className="medico-card-avatar" aria-hidden="true">
            {inicialesMedico(nombre)}
          </div>
        )}
        <span className={`medico-card-badge badge ${activo ? 'badge-exito' : 'badge-inactivo'}`}>
          {activo ? 'Disponible' : 'No disponible'}
        </span>
      </div>

      <div className="medico-card-cuerpo">
        <h3 className="medico-card-nombre" title={nombre}>{nombre}</h3>
        <p className="medico-card-especialidad" title={especialidad}>
          {especialidad}
        </p>

        <div className="medico-card-pie">
          <div className="medico-card-costo">
            <span className="medico-card-costo-label">Consulta</span>
            <strong>{formatearCosto(medico?.costo_consulta)}</strong>
          </div>

          {typeof onSelect === 'function' && (
            <span className={`medico-card-seleccion ${selected ? 'activa' : ''}`}>
              {selected ? (
                <>
                  <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                  Seleccionado
                </>
              ) : 'Elegir'}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (typeof onSelect === 'function') {
    return (
      <button
        type="button"
        className={clases}
        onClick={() => onSelect(medico)}
        aria-pressed={selected}
      >
        {contenido}
      </button>
    );
  }

  return <article className={clases}>{contenido}</article>;
}
