import { useEffect, useState, useCallback } from 'react';
import { faXmark, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import MultiSelect from './MultiSelect';

/**
 * FormModal — modal genérico de formulario (o vista de solo lectura).
 *
 * Props:
 *  titulo           – string
 *  campos           – array de definiciones de campo
 *  valoresIniciales – objeto con los valores precargados
 *  onSubmit         – función que recibe el objeto de valores
 *  onCerrar         – función para cerrar el modal
 *  errores          – objeto { [nombre]: mensajeError }
 *  guardando        – boolean, deshabilita el botón Guardar
 *  soloLectura      – boolean, renderiza vista de datos en lugar de formulario
 *  renderVerUsuario – (opcional) función que devuelve JSX para la vista Ver usuario
 */
export default function FormModal({
  titulo,
  campos = [],
  valoresIniciales = {},
  onSubmit,
  onCerrar,
  errores = {},
  guardando = false,
  soloLectura = false,
  renderVerUsuario,
}) {
  const [valores, setValores] = useState(() => construirEstadoInicial(campos, valoresIniciales));
  const [passwordVisible, setPasswordVisible] = useState({});

  // Reiniciar estado cuando cambien los valores iniciales (usuario diferente).
  useEffect(() => {
    setValores(construirEstadoInicial(campos, valoresIniciales));
    setPasswordVisible({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valoresIniciales]);

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [cerrar]);

  const handleSubmit = (e) => {
    if (soloLectura) return;
    e.preventDefault();
    onSubmit(valores);
  };

  const actualizarValor = (nombre, valor) => {
    setValores((prev) => ({ ...prev, [nombre]: valor }));
  };

  const togglePassword = (nombre) => {
    setPasswordVisible((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  // ── Vista de solo lectura personalizada ──────────────────────────────────
  if (soloLectura && renderVerUsuario) {
    return (
      <div className="modal-overlay" onClick={cerrar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{titulo}</h2>
            <button className="modal-cerrar" onClick={cerrar} aria-label="Cerrar">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="modal-ver-body">
            {renderVerUsuario()}
          </div>
          <div className="modal-acciones">
            <button type="button" className="btn btn-primario" onClick={cerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario editable (o solo lectura genérico) ──────────────────────
  return (
    <div className="modal-overlay" onClick={cerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-cerrar" onClick={cerrar} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form modal-form-body">
          {campos
            .filter((campo) => !soloLectura || campo.tipo !== 'password')
            .map((campo) => (
              <CampoFormulario
                key={campo.nombre}
                campo={campo}
                valor={valores[campo.nombre] ?? (
                  campo.tipo === 'checkbox' ? false :
                  campo.tipo === 'multiselect' ? [] :
                  campo.tipo === 'file' ? null : ''
                )}
                error={errores[campo.nombre]}
                soloLectura={soloLectura}
                passwordVisible={!!passwordVisible[campo.nombre]}
                onTogglePassword={() => togglePassword(campo.nombre)}
                onChange={(val) => actualizarValor(campo.nombre, val)}
              />
            ))}

          {errores.form && (
            <span className="form-error form-error-global">{errores.form}</span>
          )}

          <div className="modal-acciones">
            {!soloLectura && (
              <button
                type="button"
                className="btn btn-secundario"
                onClick={cerrar}
                disabled={guardando}
              >
                Cancelar
              </button>
            )}
            {!soloLectura && (
              <button
                type="submit"
                className="btn btn-primario"
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Guardando…
                  </>
                ) : 'Guardar'}
              </button>
            )}
            {soloLectura && (
              <button type="button" className="btn btn-primario" onClick={cerrar}>
                Cerrar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sub-componente de campo ─────────────────────────────────────────────────
function CampoFormulario({ campo, valor, error, soloLectura, passwordVisible, onTogglePassword, onChange }) {
  const comun = {
    name: campo.nombre,
    id: `campo-${campo.nombre}`,
    disabled: soloLectura,
    required: campo.requerido && !soloLectura,
    className: `input${error ? ' input-error' : ''}`,
  };

  let inputEl;

  switch (campo.tipo) {
    case 'textarea':
      inputEl = (
        <textarea
          {...comun}
          value={valor}
          rows={campo.filas || 3}
          placeholder={campo.placeholder}
          readOnly={soloLectura}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;

    case 'select':
      inputEl = (
        <select
          {...comun}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{campo.placeholder || 'Selecciona…'}</option>
          {campo.opciones?.map((op) => (
            <option key={op.valor} value={op.valor} disabled={op.deshabilitado}>
              {op.etiqueta}
            </option>
          ))}
        </select>
      );
      break;

    case 'checkbox':
      return (
        <div className="form-campo">
          <label className="form-checkbox-label" htmlFor={`campo-${campo.nombre}`}>
            <input
              type="checkbox"
              id={`campo-${campo.nombre}`}
              name={campo.nombre}
              checked={!!valor}
              disabled={soloLectura}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{campo.etiqueta}</span>
          </label>
          {error && <span className="form-error">{error}</span>}
        </div>
      );

    case 'multiselect':
      inputEl = (
        <MultiSelect
          id={`campo-${campo.nombre}`}
          etiqueta={campo.etiqueta}
          opciones={campo.opciones || []}
          valor={valor}
          onChange={onChange}
          soloLectura={soloLectura}
          cargando={campo.cargando}
          placeholder={campo.placeholder}
          aviso={campo.aviso}
          mensajeVacio={campo.mensajeVacio}
        />
      );
      break;

    case 'password':
      inputEl = (
        <div className="input-password-wrapper">
          <input
            {...comun}
            type={passwordVisible ? 'text' : 'password'}
            value={valor}
            placeholder={campo.placeholder}
            autoComplete="new-password"
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="input-password-toggle"
            onClick={onTogglePassword}
            tabIndex={-1}
            aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <FontAwesomeIcon icon={passwordVisible ? faEyeSlash : faEye} />
          </button>
        </div>
      );
      break;

    case 'file':
      inputEl = (
        <div className="form-archivo">
          {campo.fotoActual && (
            <img
              src={campo.fotoActual}
              alt="Foto actual"
              className="form-archivo-preview"
            />
          )}
          <input
            {...comun}
            type="file"
            className={`form-archivo-input${error ? ' input-error' : ''}`}
            accept={campo.accept || 'image/*'}
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
          {valor?.name && (
            <span className="form-ayuda">Archivo seleccionado: {valor.name}</span>
          )}
        </div>
      );
      break;

    default:
      inputEl = (
        <input
          {...comun}
          type={campo.tipo || 'text'}
          value={valor}
          placeholder={campo.placeholder}
          readOnly={soloLectura}
          min={campo.min}
          max={campo.max}
          step={campo.step}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className="form-campo">
      {campo.tipo !== 'checkbox' && (
        <label className="form-label" htmlFor={campo.tipo === 'multiselect' ? `campo-${campo.nombre}-buscar` : `campo-${campo.nombre}`}>
          {campo.etiqueta}
          {campo.requerido && !soloLectura && <span className="form-requerido"> *</span>}
        </label>
      )}
      {inputEl}
      {campo.ayuda && !error && (
        <span className="form-ayuda">{campo.ayuda}</span>
      )}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// ── Utilidad ───────────────────────────────────────────────────────────────
function construirEstadoInicial(campos, valoresIniciales) {
  const estado = {};
  campos.forEach((campo) => {
    if (campo.tipo === 'checkbox') {
      estado[campo.nombre] = valoresIniciales[campo.nombre] ?? false;
    } else if (campo.tipo === 'multiselect') {
      const inicial = valoresIniciales[campo.nombre];
      estado[campo.nombre] = Array.isArray(inicial) ? inicial.map(String) : [];
    } else if (campo.tipo === 'file') {
      estado[campo.nombre] = null;
    } else {
      estado[campo.nombre] = valoresIniciales[campo.nombre] ?? '';
    }
  });
  return estado;
}