import { useEffect, useMemo, useRef, useState } from 'react';
import {
  faXmark, faUser, faUserDoctor, faCalendarDay, faClock, faLocationDot,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiFetch, construirQuery } from '../services/api';
import { fechaISO, formatearDuracion, formatearFechaHora, horaCorta } from './citasHelpers';

const MS_DIA = 24 * 60 * 60 * 1000;
// Se calcula al cargar el módulo para no llamar a Date() durante el render.
// El botón "Hoy" recalcula la fecha real al hacer clic.
const HOY = fechaISO(new Date());

function nombreMedico(medico) {
  return medico?.medico_mostrar ?? medico?.nombre ?? 'Médico';
}

function especialidadesTexto(medico) {
  return (medico?.especialidades ?? [])
    .map((e) => e?.nombre)
    .filter(Boolean)
    .join(', ');
}

// "2026-11-09" → "09 nov 2026" sin que la zona horaria del navegador mueva el día.
function formatearFechaISO(fecha) {
  if (!fecha) return '—';
  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  if (!anio || !mes || !dia) return fecha;
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// Suma la duración de la cita a la hora de inicio del hueco.
function horaFin(horaInicio, duracionMinutos) {
  const [horas, minutos] = String(horaInicio).split(':').map(Number);
  const total = horas * 60 + minutos + Number(duracionMinutos || 0);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Modal de reagendamiento pensado para el flujo real:
 *  1. elegir médico (opcional, solo dentro de la misma especialidad),
 *  2. elegir fecha,
 *  3. elegir un horario libre concreto.
 *
 * Sustituye el select de "propuestas" + datetime-local, que obligaba a
 * adivinar si una hora estaba disponible.
 */
export default function ReagendarCitaModal({
  cita,
  onCerrar,
  onReagendada,
  mostrarToast,
  titulo = 'Reagendar cita',
  mostrarPaciente = false,
}) {
  const [medicos, setMedicos] = useState([]);
  const [cargandoMedicos, setCargandoMedicos] = useState(true);
  const [medicoId, setMedicoId] = useState(String(cita.medico_id ?? ''));
  const [fecha, setFecha] = useState('');
  const [huecos, setHuecos] = useState([]);
  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const [huecosConsultados, setHuecosConsultados] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [refresco, setRefresco] = useState(0);
  const pendienteRef = useRef(null);

  // Cerrar con Escape.
  useEffect(() => {
    const alPresionar = (e) => { if (e.key === 'Escape' && !guardando) onCerrar(); };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onCerrar, guardando]);

  // Catálogo de médicos para poder ofrecer cambio dentro de la especialidad.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await apiFetch('/api/medicos');
        if (vivo) setMedicos(Array.isArray(data) ? data : []);
      } catch (e) {
        if (vivo) setError(e.message);
      } finally {
        if (vivo) setCargandoMedicos(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const medicoActual = useMemo(
    () => medicos.find((m) => String(m.id) === String(cita.medico_id)) ?? null,
    [medicos, cita.medico_id],
  );

  const especialidadesActuales = useMemo(
    () => new Set((medicoActual?.especialidades ?? []).map((e) => String(e.id))),
    [medicoActual],
  );

  // Solo médicos activos que compartan al menos una especialidad con el
  // médico original (o el propio médico original).
  const medicosDisponibles = useMemo(() => {
    const activos = medicos.filter((m) => m.activo !== false);
    if (!medicoActual) return activos;
    if (especialidadesActuales.size === 0) {
      return activos.filter((m) => String(m.id) === String(cita.medico_id));
    }
    return activos.filter((m) =>
      String(m.id) === String(cita.medico_id) ||
      (m.especialidades ?? []).some((e) => especialidadesActuales.has(String(e.id)))
    );
  }, [medicos, medicoActual, especialidadesActuales, cita.medico_id]);

  // Si el médico original ya no aparece en el catálogo, lo mostramos igual
  // para no dejar el select sin su valor actual.
  const opcionesMedico = useMemo(() => {
    const lista = [...medicosDisponibles];
    if (cita.medico_id && !lista.some((m) => String(m.id) === String(cita.medico_id))) {
      lista.unshift({
        id: cita.medico_id,
        medico_mostrar: cita.medico_nombre,
        especialidades: [],
      });
    }
    return lista;
  }, [medicosDisponibles, cita.medico_id, cita.medico_nombre]);

  const medicoSeleccionado = useMemo(
    () => medicos.find((m) => String(m.id) === String(medicoId)) ?? null,
    [medicos, medicoId],
  );

  function nombreConsultorio(consultorioId) {
    const delMedico = medicoSeleccionado?.consultorios
      ?.find((c) => String(c.id) === String(consultorioId))?.nombre;
    if (delMedico) return delMedico;
    if (String(consultorioId) === String(cita.consultorio_id)) {
      return cita.consultorio_nombre ?? 'Consultorio';
    }
    return 'Consultorio';
  }

  // RN-083: los 3 huecos más cercanos del médico seleccionado.
  useEffect(() => {
    let vivo = true;
    setCargandoSugerencias(true);
    (async () => {
      try {
        const data = await apiFetch(
          `/api/citas/${cita.id}/propuestas${construirQuery({ medico_id: medicoId })}`
        );
        if (!vivo) return;
        const lista = Array.isArray(data) ? data : [];
        setSugerencias(lista);
        // Primera fecha por defecto: la del primer hueco propuesto.
        setFecha((previa) => previa || (lista[0]?.fecha_hora
          ? String(lista[0].fecha_hora).slice(0, 10)
          : fechaISO(new Date(Date.now() + MS_DIA))));
      } catch {
        if (!vivo) return;
        setSugerencias([]);
        setFecha((previa) => previa || fechaISO(new Date(Date.now() + MS_DIA)));
      } finally {
        if (vivo) setCargandoSugerencias(false);
      }
    })();
    return () => { vivo = false; };
  }, [cita.id, medicoId]);

  // Huecos reales del día seleccionado. Se recargan al cambiar fecha o médico.
  useEffect(() => {
    if (!medicoId || !fecha) return undefined;
    let vivo = true;
    setCargandoHuecos(true);
    setHuecosConsultados(false);
    setSeleccion(null);
    setError('');
    (async () => {
      try {
        const data = await apiFetch(
          `/api/horarios/medico/${medicoId}${construirQuery({
            fecha,
            duracion_minutos: cita.duracion_minutos,
          })}`
        );
        if (!vivo) return;
        const lista = Array.isArray(data) ? data : [];
        setHuecos(lista);

        // Si el usuario llegó haciendo clic en una sugerencia, seleccionamos
        // ese horario en cuanto terminen de cargar los huecos del día.
        const pendiente = pendienteRef.current;
        pendienteRef.current = null;
        if (pendiente) {
          const encontrado = lista.find(
            (h) => horaCorta(h.hora_inicio) === horaCorta(pendiente)
          );
          if (encontrado) setSeleccion(encontrado);
        }
      } catch (e) {
        if (vivo) {
          setHuecos([]);
          setError(e.message);
        }
      } finally {
        if (vivo) {
          setCargandoHuecos(false);
          setHuecosConsultados(true);
        }
      }
    })();
    return () => { vivo = false; };
  }, [medicoId, fecha, cita.duracion_minutos, refresco]);

  function cambiarMedico(valor) {
    setMedicoId(valor);
    setFecha('');
    setSeleccion(null);
    setError('');
  }

  function elegirSugerencia(sugerencia) {
    const nuevaFecha = String(sugerencia.fecha_hora).slice(0, 10);
    pendienteRef.current = sugerencia.hora_inicio;
    if (nuevaFecha === fecha) {
      // Misma fecha: el efecto de huecos no se vuelve a ejecutar, así que
      // seleccionamos directamente si el horario ya está en la lista.
      const encontrado = huecos.find(
        (h) => horaCorta(h.hora_inicio) === horaCorta(sugerencia.hora_inicio)
      );
      pendienteRef.current = null;
      if (encontrado) setSeleccion(encontrado);
    } else {
      setFecha(nuevaFecha);
    }
  }

  async function confirmar() {
    if (!seleccion) {
      setError('Selecciona un horario disponible.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await apiFetch(`/api/citas/${cita.id}`, {
        method: 'PUT',
        body: {
          fecha_hora: `${fecha}T${horaCorta(seleccion.hora_inicio)}`,
          medico_id: Number(medicoId),
          consultorio_id: Number(seleccion.consultorio_id),
        },
      });
      const mensajeExito = 'Cita reagendada con éxito. Tu nuevo horario está confirmado.';
      mostrarToast?.(mensajeExito);
      onReagendada(mensajeExito);
    } catch (e) {
      setError(e.message);
      if (e.status === 409) setRefresco((n) => n + 1);
    } finally {
      setGuardando(false);
    }
  }

  const hayOtrosMedicos = opcionesMedico.length > 1;

  return (
    <div className="modal-overlay" onClick={() => { if (!guardando) onCerrar(); }}>
      <div
        className="modal modal-reagendar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reagendar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="reagendar-titulo">{titulo}</h2>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
            disabled={guardando}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="reagendar-cuerpo">
          <div className="reagendar-actual">
            <span className="reagendar-actual-etiqueta">Cita actual</span>
            {mostrarPaciente && cita.paciente_nombre && (
              <span className="reagendar-actual-linea">
                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                {cita.paciente_nombre}
              </span>
            )}
            <span className="reagendar-actual-linea">
              <FontAwesomeIcon icon={faUserDoctor} aria-hidden="true" />
              {cita.medico_nombre ?? 'Médico'}
            </span>
            <span className="reagendar-actual-linea">
              <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" />
              {formatearFechaHora(cita.fecha_hora)}
              {' · '}
              {formatearDuracion(cita.duracion_minutos)}
            </span>
            <span className="reagendar-actual-linea">
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              {cita.consultorio_nombre ?? 'Consultorio'}
            </span>
          </div>

          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">1</span>
              Médico
            </h3>
            {cargandoMedicos ? (
              <p className="panel-vacio">Cargando médicos…</p>
            ) : (
              <>
                <select
                  className="input"
                  value={medicoId}
                  onChange={(e) => cambiarMedico(e.target.value)}
                  disabled={guardando}
                  aria-label="Médico"
                >
                  {opcionesMedico.map((m) => {
                    const especialidades = especialidadesTexto(m);
                    return (
                      <option key={m.id} value={String(m.id)}>
                        {nombreMedico(m)}{especialidades ? ` — ${especialidades}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="form-ayuda">
                  {hayOtrosMedicos
                    ? 'Puedes cambiar de médico dentro de la misma especialidad.'
                    : 'No hay otros médicos disponibles en esta especialidad.'}
                </p>
              </>
            )}
          </section>

          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">2</span>
              Fecha
            </h3>
            <div className="reagendar-fecha-fila">
              <input
                type="date"
                className="input"
                min={HOY}
                value={fecha}
                onChange={(e) => { setFecha(e.target.value); setError(''); }}
                disabled={guardando}
                aria-label="Fecha de la cita"
              />
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setFecha(fechaISO(new Date()))}
                disabled={guardando}
              >
                Hoy
              </button>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setFecha(fechaISO(new Date(Date.now() + MS_DIA)))}
                disabled={guardando}
              >
                Mañana
              </button>
            </div>
          </section>

          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
              Próximos horarios
            </h3>
            {cargandoSugerencias ? (
              <p className="panel-vacio">Buscando los horarios más cercanos…</p>
            ) : sugerencias.length === 0 ? (
              <p className="panel-vacio">No hay sugerencias para este médico. Elige otra fecha.</p>
            ) : (
              <div className="agendar-chips">
                {sugerencias.map((s, i) => (
                  <button
                    key={`${s.fecha_hora}-${s.consultorio_id}-${i}`}
                    type="button"
                    className="agendar-chip"
                    onClick={() => elegirSugerencia(s)}
                    disabled={guardando}
                  >
                    {formatearFechaISO(String(s.fecha_hora).slice(0, 10))}
                    {' · '}
                    {horaCorta(s.hora_inicio)}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">3</span>
              Horario
            </h3>
            {!fecha ? (
              <p className="panel-vacio">Elige una fecha para ver los horarios.</p>
            ) : cargandoHuecos ? (
              <p className="panel-vacio">Buscando horarios disponibles…</p>
            ) : !huecosConsultados ? (
              <p className="panel-vacio">Selecciona una fecha.</p>
            ) : huecos.length === 0 ? (
              <p className="panel-vacio">
                No hay horarios disponibles para este día. Prueba con otra fecha.
              </p>
            ) : (
              <div className="reagendar-slots">
                {huecos.map((h) => {
                  const activo = seleccion
                    && seleccion.hora_inicio === h.hora_inicio
                    && String(seleccion.consultorio_id) === String(h.consultorio_id);
                  return (
                    <button
                      key={`${h.hora_inicio}-${h.consultorio_id}`}
                      type="button"
                      className={`reagendar-slot${activo ? ' activo' : ''}`}
                      onClick={() => { setSeleccion(h); setError(''); }}
                      disabled={guardando}
                    >
                      <span className="reagendar-slot-hora">
                        {horaCorta(h.hora_inicio)} – {horaFin(h.hora_inicio, cita.duracion_minutos)}
                      </span>
                      <span className="reagendar-slot-lugar">
                        {nombreConsultorio(h.consultorio_id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="reagendar-resumen">
            <FontAwesomeIcon icon={faClock} aria-hidden="true" />
            <span>
              {seleccion ? (
                <>
                  <strong>Nueva cita:</strong>{' '}
                  {nombreMedico(medicoSeleccionado)}
                  {' · '}
                  {formatearFechaISO(fecha)}
                  {' · '}
                  {horaCorta(seleccion.hora_inicio)}
                  {' · '}
                  {nombreConsultorio(seleccion.consultorio_id)}
                </>
              ) : (
                'Selecciona un horario para continuar.'
              )}
            </span>
          </div>

          {error && <p className="form-error form-error-global">{error}</p>}
        </div>

        <div className="modal-acciones">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primario"
            onClick={confirmar}
            disabled={!seleccion || guardando}
          >
            {guardando ? 'Reagendando…' : 'Confirmar reagendamiento'}
          </button>
        </div>
      </div>
    </div>
  );
}
