import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  faCalendarPlus, faUserDoctor, faCalendarDay, faClock, faStethoscope, faLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { apiFetch, construirQuery } from '../../services/api';
import { horaCorta, fechaISO } from '../../components/citasHelpers';

// Duraciones sugeridas (RN-071: 10–240 min).
const DURACIONES = [15, 30, 45, 60, 90, 120];

export default function AgendarCita() {
  const navigate = useNavigate();

  // Catálogos: se derivan de /api/medicos (RN-047 incluye especialidades[] y
  // consultorios[]). Evitamos /api/especialidades por un bug preexistente de
  // una columna inexistente en el esquema.
  const [medicos, setMedicos] = useState([]);
  const [cargandoMedicos, setCargandoMedicos] = useState(true);

  // Selección del wizard.
  const [especialidadId, setEspecialidadId] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [duracion, setDuracion] = useState(30);
  const [motivo, setMotivo] = useState('');
  const [huecoSeleccionado, setHuecoSeleccionado] = useState(null);

  // Huecos y envío.
  const [huecos, setHuecos] = useState([]);
  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const [huecosConsultados, setHuecosConsultados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState(null);
  const [errorPaso, setErrorPaso] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await apiFetch('/api/medicos');
        if (!vivo) return;
        setMedicos(Array.isArray(data) ? data : (data?.data ?? []));
      } catch (err) {
        if (vivo) mostrarToast(err.message, 'error');
      } finally {
        if (vivo) setCargandoMedicos(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 4000);
  }

  // Especialidades únicas derivadas de los médicos.
  const especialidades = useMemo(() => {
    const mapa = new Map();
    medicos.forEach((m) => {
      (m.especialidades ?? []).forEach((e) => {
        if (e?.id != null && !mapa.has(String(e.id))) {
          mapa.set(String(e.id), { id: String(e.id), nombre: e.nombre });
        }
      });
    });
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [medicos]);

  // Médicos de la especialidad elegida (solo activos).
  const medicosFiltrados = useMemo(() => {
    const activos = medicos.filter((m) => m.activo !== false);
    if (!especialidadId) return activos;
    return activos.filter((m) =>
      (m.especialidades ?? []).some((e) => String(e.id) === String(especialidadId))
    );
  }, [medicos, especialidadId]);

  const medicoSeleccionado = useMemo(
    () => medicos.find((m) => String(m.id) === String(medicoId)) ?? null,
    [medicos, medicoId],
  );

  function cambiarEspecialidad(valor) {
    setEspecialidadId(valor);
    setMedicoId('');
    setHuecos([]);
    setHuecoSeleccionado(null);
    setHuecosConsultados(false);
  }

  function cambiarMedico(valor) {
    setMedicoId(valor);
    setHuecos([]);
    setHuecoSeleccionado(null);
    setHuecosConsultados(false);
  }

  // ── Consultar huecos (RN-065) ─────────────────────────────────────────────
  const puedeConsultar = especialidadId && medicoId && fecha && duracion;

  const consultarHuecos = useCallback(async () => {
    if (!puedeConsultar) return;
    setCargandoHuecos(true);
    setErrorPaso(null);
    setHuecoSeleccionado(null);
    try {
      const query = construirQuery({ fecha, duracion_minutos: duracion });
      const data = await apiFetch(`/api/horarios/medico/${medicoId}${query}`);
      setHuecos(Array.isArray(data) ? data : []);
      setHuecosConsultados(true);
    } catch (err) {
      mostrarToast(err.message, 'error');
      setHuecos([]);
      setHuecosConsultados(true);
    } finally {
      setCargandoHuecos(false);
    }
  }, [puedeConsultar, medicoId, fecha, duracion]);

  // ── Agendar ───────────────────────────────────────────────────────────────
  async function agendar() {
    if (!huecoSeleccionado) {
      setErrorPaso('Selecciona un horario disponible.');
      return;
    }
    if (medicoSeleccionado?.consultorios?.length) {
      const asignado = medicoSeleccionado.consultorios
        .some((c) => String(c.id) === String(huecoSeleccionado.consultorio_id));
      if (!asignado) {
        setErrorPaso('El médico no está asignado a ese consultorio [RN-063].');
        return;
      }
    }

    setEnviando(true);
    setErrorPaso(null);
    try {
      const fechaHora = `${fecha}T${huecoSeleccionado.hora_inicio}`;
      await apiFetch('/api/citas', {
        method: 'POST',
        body: {
          medico_id: medicoId,
          consultorio_id: huecoSeleccionado.consultorio_id,
          fecha_hora: fechaHora,
          duracion_minutos: Number(duracion),
          motivo: motivo.trim() || undefined,
        },
      });
      mostrarToast('Cita agendada correctamente');
      navigate('/paciente/citas');
    } catch (err) {
      // 409 = traslape (RN-074/RN-078): refrescar los huecos para no
      // dejar al usuario con un horario que ya no existe.
      if (err.status === 409) {
        mostrarToast(err.message, 'error');
        consultarHuecos();
      } else {
        setErrorPaso(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  // Fecha mínima: hoy (RN-073: no se agendan citas en el pasado).
  const hoy = fechaISO(new Date());

  return (
    <div className="paciente-agendar">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faCalendarPlus} aria-hidden="true" /> Agendar Cita
        </h2>
      </div>

      <div className="agendar-pasos">
        {/* ── Paso 1: Especialidad ─────────────────────────────────────── */}
        <section className="agendar-paso">
          <h3 className="agendar-paso-titulo">
            <span className="agendar-paso-numero">1</span>
            <FontAwesomeIcon icon={faStethoscope} aria-hidden="true" /> Especialidad
          </h3>
          {cargandoMedicos ? (
            <p className="panel-vacio">Cargando especialidades…</p>
          ) : especialidades.length === 0 ? (
            <p className="panel-vacio">No hay especialidades disponibles.</p>
          ) : (
            <div className="agendar-chips">
              {especialidades.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`agendar-chip ${String(especialidadId) === String(e.id) ? 'activo' : ''}`}
                  onClick={() => cambiarEspecialidad(String(especialidadId) === String(e.id) ? '' : e.id)}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Paso 2: Médico ───────────────────────────────────────────── */}
        <section className="agendar-paso">
          <h3 className="agendar-paso-titulo">
            <span className="agendar-paso-numero">2</span>
            <FontAwesomeIcon icon={faUserDoctor} aria-hidden="true" /> Médico
          </h3>
          {!especialidadId ? (
            <p className="panel-vacio">Elige una especialidad para ver los médicos.</p>
          ) : medicosFiltrados.length === 0 ? (
            <p className="panel-vacio">No hay médicos en esta especialidad.</p>
          ) : (
            <div className="agendar-chips">
              {medicosFiltrados.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`agendar-chip ${String(medicoId) === String(m.id) ? 'activo' : ''}`}
                  onClick={() => cambiarMedico(String(medicoId) === String(m.id) ? '' : String(m.id))}
                >
                  <FontAwesomeIcon icon={faUserDoctor} aria-hidden="true" />{' '}
                  {m.medico_mostrar ?? m.nombre}
                </button>
              ))}
            </div>
          )}
          {medicoSeleccionado && medicoSeleccionado.consultorios?.length > 0 && (
            <p className="agendar-info">
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />{' '}
              Consultorios: {medicoSeleccionado.consultorios.map((c) => c.nombre).join(', ')}
            </p>
          )}
        </section>

        {/* ── Paso 3: Fecha y duración ─────────────────────────────────── */}
        <section className="agendar-paso">
          <h3 className="agendar-paso-titulo">
            <span className="agendar-paso-numero">3</span>
            <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" /> Fecha y duración
          </h3>
          {!medicoId ? (
            <p className="panel-vacio">Elige un médico para continuar.</p>
          ) : (
            <div className="agendar-campos">
              <label className="form-campo">
                <span className="form-label">Fecha</span>
                <input
                  type="date"
                  className="input"
                  min={hoy}
                  value={fecha}
                  onChange={(e) => { setFecha(e.target.value); setHuecoSeleccionado(null); setHuecosConsultados(false); }}
                />
              </label>
              <label className="form-campo">
                <span className="form-label">Duración (minutos)</span>
                <select
                  className="input"
                  value={duracion}
                  onChange={(e) => { setDuracion(Number(e.target.value)); setHuecoSeleccionado(null); setHuecosConsultados(false); }}
                >
                  {DURACIONES.map((d) => (
                    <option key={d} value={d}>{d} minutos</option>
                  ))}
                </select>
              </label>
              <label className="form-campo form-campo-ancho">
                <span className="form-label">Motivo (opcional)</span>
                <input
                  type="text"
                  className="input"
                  maxLength={200}
                  placeholder="Describe brevemente el motivo de la consulta"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <div className="agendar-campos-accion">
                <button
                  type="button"
                  className="btn btn-primario"
                  disabled={!puedeConsultar || cargandoHuecos}
                  onClick={consultarHuecos}
                >
                  <FontAwesomeIcon icon={faClock} aria-hidden="true" />
                  {' '}{cargandoHuecos ? 'Buscando…' : 'Ver horarios disponibles'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Paso 4: Horario ──────────────────────────────────────────── */}
        <section className="agendar-paso">
          <h3 className="agendar-paso-titulo">
            <span className="agendar-paso-numero">4</span>
            <FontAwesomeIcon icon={faClock} aria-hidden="true" /> Horario
          </h3>
          {!huecosConsultados ? (
            <p className="panel-vacio">Consulta los horarios disponibles para este día.</p>
          ) : cargandoHuecos ? (
            <p className="panel-vacio">Cargando horarios…</p>
          ) : huecos.length === 0 ? (
            <p className="panel-vacio">No hay horarios disponibles para esta fecha. Intenta con otro día.</p>
          ) : (
            <div className="agendar-chips">
              {huecos.map((h, i) => {
                const id = `${h.horario_id}-${h.hora_inicio}-${i}`;
                const activo = huecoSeleccionado && `${huecoSeleccionado.horario_id}-${huecoSeleccionado.hora_inicio}` === `${h.horario_id}-${h.hora_inicio}`;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`agendar-chip ${activo ? 'activo' : ''}`}
                    onClick={() => setHuecoSeleccionado(h)}
                  >
                    {horaCorta(h.hora_inicio)} – {horaCorta(h.hora_fin)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="agendar-confirmacion">
            <h4>Resumen</h4>
            <ul className="agendar-resumen">
              <li>
                <FontAwesomeIcon icon={faStethoscope} aria-hidden="true" />{' '}
                {especialidades.find((e) => String(e.id) === String(especialidadId))?.nombre ?? '—'}
              </li>
              <li>
                <FontAwesomeIcon icon={faUserDoctor} aria-hidden="true" />{' '}
                {medicoSeleccionado?.medico_mostrar ?? '—'}
              </li>
              <li>
                <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" />{' '}
                {fecha || '—'} · {duracion} min
              </li>
              <li>
                <FontAwesomeIcon icon={faClock} aria-hidden="true" />{' '}
                {huecoSeleccionado
                  ? `${horaCorta(huecoSeleccionado.hora_inicio)} – ${horaCorta(huecoSeleccionado.hora_fin)}`
                  : 'Selecciona un horario'}
              </li>
            </ul>

            {errorPaso && <p className="form-error-global">{errorPaso}</p>}

            <button
              type="button"
              className="btn btn-primario btn-block"
              disabled={!huecoSeleccionado || enviando}
              onClick={agendar}
            >
              {enviando ? 'Agendando…' : 'Confirmar cita'}
            </button>
          </div>
        </section>
      </div>

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
