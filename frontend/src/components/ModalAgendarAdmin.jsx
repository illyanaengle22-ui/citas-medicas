import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  faXmark, faUser, faUserDoctor, faCalendarDay, faClock, faStethoscope,
  faLocationDot, faMagnifyingGlass, faCheck, faCalendarPlus, faNotesMedical,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiFetch, construirQuery } from '../services/api';
import { fechaISO, horaCorta, formatearDuracion } from './citasHelpers';

const DURACIONES = [15, 30, 45, 60];
const MS_DIA = 24 * 60 * 60 * 1000;

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatearFechaBonita(fechaStr) {
  if (!fechaStr) return '—';
  const [anio, mes, dia] = String(fechaStr).split('-').map(Number);
  if (!anio || !mes || !dia) return fechaStr;
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function sumarMinutos(horaStr, minutos) {
  if (!horaStr) return '';
  const [h, m] = String(horaStr).split(':').map(Number);
  const total = h * 60 + m + Number(minutos || 0);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function ModalAgendarAdmin({
  onCerrar,
  onCitaAgendada,
  mostrarToast,
}) {
  const hoyStr = useMemo(() => fechaISO(new Date()), []);

  // ── Catálogos ─────────────────────────────────────────────────────────────
  const [pacientes, setPacientes] = useState([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);
  const [medicos, setMedicos] = useState([]);
  const [cargandoMedicos, setCargandoMedicos] = useState(true);

  // ── Paso 1: Paciente ──────────────────────────────────────────────────────
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [mostrarListaPacientes, setMostrarListaPacientes] = useState(false);

  // ── Paso 2: Médico y Fecha ────────────────────────────────────────────────
  const [especialidadId, setEspecialidadId] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [fecha, setFecha] = useState(hoyStr);
  const [duracion, setDuracion] = useState(30);

  // ── Paso 3: Horarios ──────────────────────────────────────────────────────
  const [huecos, setHuecos] = useState([]);
  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const [huecosConsultados, setHuecosConsultados] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  // ── Paso 4: Motivo y Guardar ──────────────────────────────────────────────
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorPaso, setErrorPaso] = useState('');

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !guardando) onCerrar();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCerrar, guardando]);

  // Cargar pacientes y médicos al montar
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [resPacientes, resMedicos] = await Promise.all([
          apiFetch('/api/pacientes'),
          apiFetch('/api/medicos?todos=true'),
        ]);
        if (!activo) return;
        setPacientes(Array.isArray(resPacientes) ? resPacientes : (resPacientes?.data ?? []));
        setMedicos(Array.isArray(resMedicos) ? resMedicos : (resMedicos?.data ?? []));
      } catch (err) {
        if (activo) setErrorPaso('Error al cargar datos iniciales: ' + err.message);
      } finally {
        if (activo) {
          setCargandoPacientes(false);
          setCargandoMedicos(false);
        }
      }
    })();
    return () => { activo = false; };
  }, []);

  // ── Filtro de Pacientes en tiempo real ────────────────────────────────────
  const pacientesFiltrados = useMemo(() => {
    const term = busquedaPaciente.trim().toLowerCase();
    if (!term) return [];
    return pacientes
      .filter((p) => {
        const nom = (p.nombre || '').toLowerCase();
        const em = (p.email || '').toLowerCase();
        const tel = String(p.telefono || '').replace(/\D/g, '');
        return nom.includes(term) || em.includes(term) || (tel && tel.includes(term));
      })
      .slice(0, 8);
  }, [pacientes, busquedaPaciente]);

  function seleccionarPaciente(p) {
    setPacienteSeleccionado(p);
    setBusquedaPaciente('');
    setMostrarListaPacientes(false);
    setErrorPaso('');
  }

  function deseleccionarPaciente() {
    setPacienteSeleccionado(null);
    setBusquedaPaciente('');
  }

  // ── Especialidades únicas ─────────────────────────────────────────────────
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

  // Médicos filtrados por especialidad
  const medicosFiltrados = useMemo(() => {
    const activos = medicos.filter((m) => m.activo !== false);
    if (!especialidadId) return activos;
    return activos.filter((m) =>
      (m.especialidades ?? []).some((e) => String(e.id) === String(especialidadId))
    );
  }, [medicos, especialidadId]);

  const medicoSeleccionado = useMemo(() => {
    return medicos.find((m) => String(m.id) === String(medicoId)) ?? null;
  }, [medicos, medicoId]);

  function cambiarEspecialidad(id) {
    setEspecialidadId(id);
    setMedicoId('');
    setHuecos([]);
    setSlotSeleccionado(null);
    setHuecosConsultados(false);
  }

  function cambiarMedico(id) {
    setMedicoId(id);
    setHuecos([]);
    setSlotSeleccionado(null);
    setHuecosConsultados(false);
  }

  // ── Consultar huecos disponibles (RN-065) ─────────────────────────────────
  const consultarHuecos = useCallback(async (idMed, fechaVal, duracionVal) => {
    if (!idMed || !fechaVal) return;
    setCargandoHuecos(true);
    setErrorPaso('');
    setSlotSeleccionado(null);
    try {
      const query = construirQuery({ fecha: fechaVal, duracion_minutos: duracionVal });
      const data = await apiFetch(`/api/horarios/medico/${idMed}${query}`);
      setHuecos(Array.isArray(data) ? data : []);
      setHuecosConsultados(true);
    } catch (err) {
      setErrorPaso(err.message);
      setHuecos([]);
      setHuecosConsultados(true);
    } finally {
      setCargandoHuecos(false);
    }
  }, []);

  // Auto-consultar horarios cuando médico, fecha o duración cambian
  useEffect(() => {
    if (medicoId && fecha) {
      consultarHuecos(medicoId, fecha, duracion);
    } else {
      setHuecos([]);
      setHuecosConsultados(false);
      setSlotSeleccionado(null);
    }
  }, [medicoId, fecha, duracion, consultarHuecos]);

  // ── Guardar cita como Admin (estado confirmada de inmediato) ───────────────
  async function handleConfirmarCita(e) {
    e.preventDefault();
    setErrorPaso('');

    if (!pacienteSeleccionado) {
      setErrorPaso('Selecciona un paciente para la cita.');
      return;
    }
    if (!medicoSeleccionado) {
      setErrorPaso('Selecciona un médico.');
      return;
    }
    if (!fecha) {
      setErrorPaso('Selecciona una fecha válida.');
      return;
    }
    if (!slotSeleccionado) {
      setErrorPaso('Selecciona un horario disponible.');
      return;
    }

    setGuardando(true);
    try {
      const fechaHora = `${fecha}T${slotSeleccionado.hora_inicio}`;
      await apiFetch('/api/citas', {
        method: 'POST',
        body: {
          paciente_id: pacienteSeleccionado.id,
          medico_id: medicoSeleccionado.id,
          consultorio_id: slotSeleccionado.consultorio_id,
          fecha_hora: fechaHora,
          duracion_minutos: Number(duracion),
          motivo: motivo.trim() || undefined,
          notas: notas.trim() || undefined,
        },
      });

      mostrarToast?.('¡Cita agendada y confirmada con éxito!', 'exito');
      onCitaAgendada?.();
    } catch (err) {
      if (err.status === 409) {
        setErrorPaso(err.message + ' — Actualizando horarios disponibles...');
        consultarHuecos(medicoId, fecha, duracion);
      } else {
        setErrorPaso(err.message || 'Error al agendar la cita.');
      }
    } finally {
      setGuardando(false);
    }
  }

  // Nombre legible del consultorio de un slot
  function nombreConsultorio(consultorioId) {
    if (!medicoSeleccionado?.consultorios) return 'Consultorio Central';
    const c = medicoSeleccionado.consultorios.find(
      (item) => String(item.id) === String(consultorioId)
    );
    return c?.nombre || 'Consultorio';
  }

  const puedeConfirmar = Boolean(
    pacienteSeleccionado && medicoSeleccionado && fecha && slotSeleccionado && !guardando
  );

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div
        className="modal modal-agendar-admin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-agendar-titulo"
      >
        <div className="modal-header">
          <h2 id="modal-agendar-titulo">
            <FontAwesomeIcon icon={faCalendarPlus} aria-hidden="true" /> Nueva Cita (Administrador)
          </h2>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            disabled={guardando}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleConfirmarCita} className="modal-form-body reagendar-cuerpo">
          {errorPaso && (
            <div className="alerta-error" role="alert" style={{ marginBottom: '1rem' }}>
              {errorPaso}
            </div>
          )}

          {/* ── PASO 1: BÚSQUEDA DE PACIENTE ──────────────────────────────── */}
          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">1</span>
              <FontAwesomeIcon icon={faUser} aria-hidden="true" /> Paciente
            </h3>

            {cargandoPacientes ? (
              <p className="panel-vacio">Cargando catálogo de pacientes…</p>
            ) : pacienteSeleccionado ? (
              <div className="paciente-badge-seleccionado">
                <div className="paciente-badge-info">
                  <div className="paciente-badge-avatar">
                    {iniciales(pacienteSeleccionado.nombre)}
                  </div>
                  <div className="paciente-badge-detalles">
                    <span className="paciente-badge-nombre">{pacienteSeleccionado.nombre}</span>
                    <span className="paciente-badge-contacto">
                      {pacienteSeleccionado.email || 'Sin correo'} · Tel: {pacienteSeleccionado.telefono || 'Sin teléfono'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secundario btn-sm"
                  onClick={deseleccionarPaciente}
                  disabled={guardando}
                  title="Cambiar paciente"
                >
                  <FontAwesomeIcon icon={faXmark} /> Cambiar
                </button>
              </div>
            ) : (
              <div className="paciente-busqueda-contenedor">
                <div className="input-busqueda-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                    placeholder="Buscar paciente por nombre, correo o teléfono…"
                    value={busquedaPaciente}
                    onChange={(e) => {
                      setBusquedaPaciente(e.target.value);
                      setMostrarListaPacientes(true);
                    }}
                    onFocus={() => setMostrarListaPacientes(true)}
                    disabled={guardando}
                    autoComplete="off"
                  />
                  <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted, #94a3b8)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                {mostrarListaPacientes && busquedaPaciente.trim() !== '' && (
                  <div className="paciente-lista-resultados">
                    {pacientesFiltrados.length === 0 ? (
                      <div className="panel-vacio" style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                        No se encontró ningún paciente con &quot;{busquedaPaciente}&quot;
                      </div>
                    ) : (
                      pacientesFiltrados.map((p) => (
                        <div
                          key={p.id}
                          className="paciente-opcion-item"
                          onClick={() => seleccionarPaciente(p)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && seleccionarPaciente(p)}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.nombre}</div>
                            <small style={{ color: '#64748b' }}>
                              {p.email || 'Sin email'} · Tel: {p.telefono || '—'}
                            </small>
                          </div>
                          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                            ID #{p.id}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <p className="form-ayuda" style={{ marginTop: '0.4rem' }}>
                  Escribe al menos 2 letras para filtrar entre los {pacientes.length} pacientes registrados.
                </p>
              </div>
            )}
          </section>

          {/* ── PASO 2: MÉDICO Y FECHA ────────────────────────────────────── */}
          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">2</span>
              <FontAwesomeIcon icon={faUserDoctor} aria-hidden="true" /> Médico y Fecha
            </h3>

            {cargandoMedicos ? (
              <p className="panel-vacio">Cargando médicos…</p>
            ) : (
              <div className="agendar-campos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {/* Filtro opcional de especialidad */}
                <label className="form-campo">
                  <span className="form-label">
                    <FontAwesomeIcon icon={faStethoscope} /> Especialidad (filtro)
                  </span>
                  <select
                    className="input"
                    value={especialidadId}
                    onChange={(e) => cambiarEspecialidad(e.target.value)}
                    disabled={guardando}
                  >
                    <option value="">Todas las especialidades</option>
                    {especialidades.map((esp) => (
                      <option key={esp.id} value={esp.id}>
                        {esp.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Selección de médico */}
                <label className="form-campo">
                  <span className="form-label">Médico *</span>
                  <select
                    className="input"
                    value={medicoId}
                    onChange={(e) => cambiarMedico(e.target.value)}
                    disabled={guardando}
                    required
                  >
                    <option value="">Selecciona un médico…</option>
                    {medicosFiltrados.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.medico_mostrar || m.nombre || `Dr. #${m.id}`}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Fecha */}
                <label className="form-campo">
                  <span className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <FontAwesomeIcon icon={faCalendarDay} /> Fecha *
                    </span>
                    <span style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn-atajo-fecha"
                        onClick={() => setFecha(hoyStr)}
                        disabled={guardando}
                        title="Seleccionar hoy"
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        className="btn-atajo-fecha"
                        onClick={() => setFecha(fechaISO(new Date(Date.now() + MS_DIA)))}
                        disabled={guardando}
                        title="Seleccionar mañana"
                      >
                        Mañana
                      </button>
                    </span>
                  </span>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%' }}
                    min={hoyStr}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    disabled={guardando}
                    required
                  />
                </label>

                {/* Duración */}
                <label className="form-campo">
                  <span className="form-label" style={{ display: 'flex', alignItems: 'center', minHeight: '1.5rem' }}>
                    <span>
                      <FontAwesomeIcon icon={faClock} /> Duración
                    </span>
                  </span>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={duracion}
                    onChange={(e) => setDuracion(Number(e.target.value))}
                    disabled={guardando}
                  >
                    {DURACIONES.map((d) => (
                      <option key={d} value={d}>
                        {d} minutos
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {medicoSeleccionado && medicoSeleccionado.consultorios?.length > 0 && (
              <p className="agendar-info" style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />{' '}
                Consultorio asignado: {medicoSeleccionado.consultorios.map((c) => c.nombre).join(', ')}
              </p>
            )}
          </section>

          {/* ── PASO 3: HORARIOS DISPONIBLES ──────────────────────────────── */}
          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">3</span>
              <FontAwesomeIcon icon={faClock} aria-hidden="true" /> Horarios disponibles
            </h3>

            {!medicoId ? (
              <p className="panel-vacio">Elige un médico y una fecha para consultar la disponibilidad.</p>
            ) : cargandoHuecos ? (
              <p className="panel-vacio">Buscando horarios disponibles…</p>
            ) : !huecosConsultados ? (
              <p className="panel-vacio">Elige una fecha válida.</p>
            ) : huecos.length === 0 ? (
              <p className="panel-vacio">
                No hay horarios disponibles para el {formatearFechaBonita(fecha)}. Intenta seleccionando otro día o médico.
              </p>
            ) : (
              <div className="reagendar-slots">
                {huecos.map((h, i) => {
                  const clave = `${h.hora_inicio}-${h.consultorio_id}-${i}`;
                  const activo =
                    slotSeleccionado &&
                    slotSeleccionado.hora_inicio === h.hora_inicio &&
                    String(slotSeleccionado.consultorio_id) === String(h.consultorio_id);

                  return (
                    <button
                      key={clave}
                      type="button"
                      className={`reagendar-slot${activo ? ' activo' : ''}`}
                      onClick={() => {
                        setSlotSeleccionado(h);
                        setErrorPaso('');
                      }}
                      disabled={guardando}
                    >
                      <span className="reagendar-slot-hora">
                        {horaCorta(h.hora_inicio)} – {horaCorta(h.hora_fin || sumarMinutos(h.hora_inicio, duracion))}
                      </span>
                      <span className="reagendar-slot-lugar">
                        <FontAwesomeIcon icon={faLocationDot} /> {nombreConsultorio(h.consultorio_id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── PASO 4: RESUMEN Y MOTIVO ──────────────────────────────────── */}
          <section className="reagendar-seccion">
            <h3 className="reagendar-seccion-titulo">
              <span className="agendar-paso-numero">4</span>
              <FontAwesomeIcon icon={faNotesMedical} aria-hidden="true" /> Motivo y Resumen
            </h3>

            <div className="reagendar-actual" style={{ marginBottom: '0.85rem' }}>
              <span className="reagendar-actual-etiqueta">Resumen de la cita</span>

              <span className="reagendar-actual-linea">
                <FontAwesomeIcon icon={faUser} />
                <strong>Paciente:</strong>{' '}
                {pacienteSeleccionado ? pacienteSeleccionado.nombre : 'No seleccionado'}
              </span>

              <span className="reagendar-actual-linea">
                <FontAwesomeIcon icon={faUserDoctor} />
                <strong>Médico:</strong>{' '}
                {medicoSeleccionado ? (medicoSeleccionado.medico_mostrar || medicoSeleccionado.nombre) : 'No seleccionado'}
              </span>

              <span className="reagendar-actual-linea">
                <FontAwesomeIcon icon={faCalendarDay} />
                <strong>Fecha:</strong> {formatearFechaBonita(fecha)} · {formatearDuracion(duracion)}
              </span>

              <span className="reagendar-actual-linea">
                <FontAwesomeIcon icon={faClock} />
                <strong>Horario:</strong>{' '}
                {slotSeleccionado
                  ? `${horaCorta(slotSeleccionado.hora_inicio)} – ${horaCorta(slotSeleccionado.hora_fin || sumarMinutos(slotSeleccionado.hora_inicio, duracion))}`
                  : 'Pendiente de elegir en el Paso 3'}
              </span>

              {slotSeleccionado && (
                <span className="reagendar-actual-linea">
                  <FontAwesomeIcon icon={faLocationDot} />
                  <strong>Lugar:</strong> {nombreConsultorio(slotSeleccionado.consultorio_id)}
                </span>
              )}

              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>
                <FontAwesomeIcon icon={faCheck} /> La cita quedará confirmada automáticamente
              </div>
            </div>

            <label className="form-campo">
              <span className="form-label">Motivo de la consulta (opcional)</span>
              <input
                type="text"
                className="input"
                placeholder="Ej. Dolor torácico, seguimiento de laboratorio, llamada telefónica..."
                maxLength={200}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={guardando}
              />
            </label>

            <label className="form-campo" style={{ marginTop: '0.75rem' }}>
              <span className="form-label">
                <FontAwesomeIcon icon={faNotesMedical} /> Notas de la consulta / Evolución (opcional)
              </span>
              <textarea
                className="input"
                rows={3}
                placeholder="Escribe aquí observaciones médicas, antecedentes o notas clínicas..."
                maxLength={1000}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                disabled={guardando}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </label>
          </section>

          {/* ── ACCIONES DEL MODAL ────────────────────────────────────────── */}
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
              type="submit"
              className="btn btn-primario"
              disabled={!puedeConfirmar}
            >
              {guardando ? (
                <>
                  <span className="spinner spinner-sm" /> Guardando cita…
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} /> Confirmar Cita
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
