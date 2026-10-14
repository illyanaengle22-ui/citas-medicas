import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function ConfirmDialog({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  enConfirmacion = false,
  onConfirmar,
  onCancelar,
  tipo = 'peligro',
}) {
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal modal-confirmacion" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-cerrar" onClick={onCancelar} aria-label="Cerrar">
            <FontAwesomeIcon icon={['fas', 'times']} />
          </button>
        </div>

        <div className="modal-body">
          <p className="confirmacion-mensaje">{mensaje}</p>
        </div>

        <div className="modal-acciones">
          <button className="btn btn-secundario" onClick={onCancelar} disabled={enConfirmacion}>
            {textoCancelar}
          </button>
          <button
            className={`btn ${tipo === 'peligro' ? 'btn-error' : 'btn-primario'}`}
            onClick={onConfirmar}
            disabled={enConfirmacion}
          >
            {enConfirmacion ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
