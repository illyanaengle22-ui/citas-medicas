import { useEffect } from 'react';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function FormModal({
  titulo,
  campos = [],
  valoresIniciales = {},
  onSubmit,
  onCerrar,
  errores = {},
  guardando = false,
  soloLectura = false,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCerrar]);

  const handleSubmit = (e) => {
    if (soloLectura) return;
    e.preventDefault();
    const valores = {};
    campos.forEach((campo) => {
      if (campo.tipo === 'checkbox') {
        valores[campo.nombre] = e.target[campo.nombre]?.checked ?? false;
      } else {
        valores[campo.nombre] = e.target[campo.nombre]?.value ?? '';
      }
    });
    onSubmit(valores);
  };

  const renderCampo = (campo) => {
    const nombre = campo.nombre;
    const valor = valoresIniciales[nombre] ?? (campo.tipo === 'checkbox' ? false : '');
    const error = errores[nombre];
    const comun = {
      name: nombre,
      disabled: soloLectura,
      required: campo.requerido && !soloLectura,
    };

    switch (campo.tipo) {
      case 'textarea':
        return (
          <textarea
            className={`input ${error ? 'input-error' : ''}`}
            {...comun}
            defaultValue={valor}
            rows={campo.filas || 3}
            placeholder={campo.placeholder}
            readOnly={soloLectura}
          />
        );

      case 'select':
        return (
          <select
            className={`input ${error ? 'input-error' : ''}`}
            {...comun}
            defaultValue={valor}
          >
            {campo.placeholder && <option value="">{campo.placeholder}</option>}
            {campo.opciones?.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              {...comun}
              defaultChecked={valor}
            />
            <span>{campo.etiqueta}</span>
          </label>
        );

      default:
        return (
          <input
            type={campo.tipo || 'text'}
            className={`input ${error ? 'input-error' : ''}`}
            {...comun}
            defaultValue={valor}
            placeholder={campo.placeholder}
            readOnly={soloLectura}
          />
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form modal-form-body">
          {campos.map((campo) => (
            <div key={campo.nombre} className="form-campo">
              {campo.tipo !== 'checkbox' && (
                <label className="form-label">
                  {campo.etiqueta}
                  {campo.requerido && !soloLectura && <span className="form-requerido"> *</span>}
                </label>
              )}
              {renderCampo(campo)}
              {errores[campo.nombre] && (
                <span className="form-error">{errores[campo.nombre]}</span>
              )}
            </div>
          ))}

          <div className="modal-acciones">
            {!soloLectura && (
              <button type="button" className="btn btn-secundario" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </button>
            )}
            {!soloLectura && (
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            )}
            {soloLectura && (
              <button type="button" className="btn btn-primario" onClick={onCerrar}>
                Cerrar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}