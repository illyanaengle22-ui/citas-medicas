import { fechaLocalISO, OPCIONES_RANGO } from './rangoFechas';

export default function FiltroRango({
  preset,
  rango,
  onPreset,
  onRango,
  deshabilitado = false,
}) {
  const hoy = fechaLocalISO();
  const personalizado = preset === 'personalizado';

  function cambiar(campo, valor) {
    onRango({ ...rango, [campo]: valor });
  }

  return (
    <div className="dash-filtros">
      <div className="dash-filtros-grupo" role="group" aria-label="Rango de fechas del dashboard">
        {OPCIONES_RANGO.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            className={`dash-filtro-btn${preset === opcion.id ? ' dash-filtro-btn--activo' : ''}`}
            aria-pressed={preset === opcion.id}
            onClick={() => onPreset(opcion.id)}
            disabled={deshabilitado}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      {personalizado && (
        <div className="dash-filtros-fechas">
          <label className="dash-filtro-campo">
            <span>Desde</span>
            <input
              type="date"
              value={rango.inicio}
              max={rango.fin || hoy}
              onChange={(evento) => cambiar('inicio', evento.target.value)}
              disabled={deshabilitado}
            />
          </label>
          <label className="dash-filtro-campo">
            <span>Hasta</span>
            <input
              type="date"
              value={rango.fin}
              min={rango.inicio || undefined}
              max={hoy}
              onChange={(evento) => cambiar('fin', evento.target.value)}
              disabled={deshabilitado}
            />
          </label>
        </div>
      )}
    </div>
  );
}
