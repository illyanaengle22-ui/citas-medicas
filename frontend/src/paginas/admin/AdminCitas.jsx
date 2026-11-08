import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  faCheck, faBan, faUserSlash, faRotateRight, faClipboardList, faChevronLeft, faChevronRight,
  faPlus, faPenToSquare, faSave,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReagendarCitaModal from '../../components/ReagendarCitaModal';
import ModalAgendarAdmin from '../../components/ModalAgendarAdmin';
import { apiFetch, construirQuery } from '../../services/api';
import {
  ESTADOS_CITA, claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
  esVigente, yaPaso,
} from '../../components/citasHelpers';

const FILA_POR_PAGINA = 10;

const columnas = [
  {
    clave: 'fecha_hora',
    titulo: 'Fecha y hora',
    render: (fila) => (
      <div>
        <div>{formatearFechaHora(fila.fecha_hora)}</div>
        <small className="celda-vacia">{formatearDuracion(fila.duracion_minutos)}</small>
      </div>
    ),
  },
  { clave: 'paciente_nombre', titulo: 'Paciente' },
  { clave: 'medico_nombre', titulo: 'Médico' },
  { clave: 'consultorio_nombre', titulo: 'Consultorio' },
  {
    clave: 'estado',
    titulo: 'Estado',
    render: (fila) => (
      <span className={claseEstado(fila.estado)}>{etiquetaEstado(fila.estado)}</span>
    ),
  },
];

const opcionesEstado = [
  { valor: '', etiqueta: 'Todos los estados' },
  ...ESTADOS_CITA.map((e) => ({ valor: e.clave, etiqueta: e.etiqueta })),
];

function CitaDetalle({ cita }) {
  if (!cita) return null;
  const filas = [
    ['Paciente', cita.paciente_nombre ?? `#${cita.paciente_id}`],
    ['Médico', cita.medico_nombre ?? `#${cita.medico_id}`],
    ['Consultorio', cita.consultorio_nombre ?? `#${cita.consultorio_id}`],
    ['Fecha y hora', formatearFechaHora(cita.fecha_hora)],
    ['Duración', formatearDuracion(cita.duracion_minutos)],
    ['Estado', <span key="e" className={claseEstado(cita.estado)}>{etiquetaEstado(cita.estado)}</span>],
    ['Motivo', cita.motivo || <span key="m" className="celda-vacia">—</span>],
    ['UUID', <code key="u" className="celda-truncada" title={cita.uuid_publico}>{cita.uuid_publico}</code>],
  ];
  return (
    <dl className="ver-usuario-lista">
      {filas.map(([etiqueta, valor]) => (
        <div className="ver-usuario-fila" key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminCitas() {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState({
    estado: '',
    fecha_desde: '',
    fecha_hasta: '',
    orden: 'smart',
  });
  const [detalle, setDetalle] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [enConfirmacion, setEnConfirmacion] = useState(false);
  const [reagendando, setReagendando] = useState(null);
  const [toast, setToast] = useState(null);

  // ── Edición de notas clínicas por el Admin ──────────────────────────────
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [textoNotas, setTextoNotas] = useState('');
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  // ── Nueva Cita (Admin Wizard) ───────────────────────────────────────────
  const [modalNuevaCita, setModalNuevaCita] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const query = construirQuery({
        estado: filtros.estado,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
        orden: filtros.orden,
        page: pagina,
        limit: FILA_POR_PAGINA,
      });
      const data = await apiFetch(`/api/citas${query}`);
      setDatos(data?.citas ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  function cambiarFiltro(clave, valor) {
    setFiltros((prev) => ({ ...prev, [clave]: valor }));
    setPagina(1);
  }

  // ── Detalle + historial ────────────────────────────────────────────────────
  async function abrirDetalle(fila) {
    try {
      const cita = await apiFetch(`/api/citas/${fila.id}`);
      setDetalle(cita);
      setTextoNotas(cita.notas || '');
      setEditandoNotas(false);
      setHistorial(null);
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  // Guardar notas de la consulta como Administrador
  async function guardarNotas() {
    if (!detalle) return;
    setGuardandoNotas(true);
    try {
      await apiFetch(`/api/citas/${detalle.id}`, {
        method: 'PUT',
        body: { notas: textoNotas },
      });
      setDetalle((prev) => ({ ...prev, notas: textoNotas }));
      setDatos((prev) => prev.map((c) => (c.id === detalle.id ? { ...c, notas: textoNotas } : c)));
      setEditandoNotas(false);
      mostrarToast('Notas actualizadas con éxito');
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setGuardandoNotas(false);
    }
  }

  async function abrirHistorial(fila) {
    setCargandoHistorial(true);
    try {
      await abrirDetalle(fila);
      const h = await apiFetch(`/api/citas/${fila.id}/historial`);
      setHistorial(Array.isArray(h) ? h : (h?.data ?? []));
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargandoHistorial(false);
    }
  }

  // ── Acciones de estado ─────────────────────────────────────────────────────
  function pedirConfirmacion(fila, accion) {
    setConfirmacion({ fila, accion });
  }

  async function ejecutarAccion() {
    if (!confirmacion) return;
    const { fila, accion } = confirmacion;
    setEnConfirmacion(true);
    try {
      if (accion === 'confirmar') {
        await apiFetch(`/api/citas/${fila.id}/confirmar`, { method: 'PUT' });
        mostrarToast('Cita confirmada correctamente');
      } else if (accion === 'cancelar') {
        await apiFetch(`/api/citas/${fila.id}/estado`, {
          method: 'PUT',
          body: { estado: 'cancelada', ignorarPlazo: true },
        });
        mostrarToast('Cita cancelada; el horario quedó libre');
      } else if (accion === 'completada') {
        await apiFetch(`/api/citas/${fila.id}/estado`, {
          method: 'PUT',
          body: { estado: 'completada', ignorarPlazo: true },
        });
        mostrarToast('Cita marcada como completada con éxito');
      } else if (accion === 'no_asistio') {
        await apiFetch(`/api/citas/${fila.id}/estado`, {
          method: 'PUT',
          body: { estado: 'no_asistio', ignorarPlazo: true },
        });
        mostrarToast('Cita marcada como no asistió con éxito');
      }
      setConfirmacion(null);
      if (detalle && detalle.id === fila.id) {
        setDetalle(null);
        setHistorial(null);
      }
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setEnConfirmacion(false);
    }
  }

  // ── Reagendar (RN-083: propone los 3 horarios libres más cercanos) ─────────
  function abrirReagendar(fila) {
    setReagendando(fila);
  }

  // ── Acciones por fila ─────────────────────────────────────────────────────
  const acciones = (fila) => {
    const vigente = esVigente(fila.estado);
    const lista = [
      { icono: faClipboardList, titulo: 'Ver detalle e historial', clase: 'btn-ver', onClick: () => abrirHistorial(fila) },
    ];
    if (vigente && fila.estado !== 'confirmada') {
      lista.push({ icono: faCheck, titulo: 'Confirmar', clase: 'btn-aprobar', onClick: () => pedirConfirmacion(fila, 'confirmar') });
    }
    if (vigente && !yaPaso(fila.fecha_hora)) {
      lista.push({ icono: faRotateRight, titulo: 'Reagendar', clase: 'btn-editar', onClick: () => abrirReagendar(fila) });
    }
    // Admin tiene poder absoluto: puede cancelar CUALQUIER cita no cancelada sin restricciones de tiempo
    if (fila.estado !== 'cancelada') {
      lista.push({
        icono: faBan,
        titulo: 'Cancelar cita',
        clase: 'btn-rechazar',
        onClick: () => pedirConfirmacion(fila, 'cancelar'),
      });
    }
    // Admin puede cambiar el estado manualmente (Completada / No Asistió) en cualquier cita no cancelada (pasada o futura)
    if (fila.estado !== 'cancelada') {
      if (fila.estado !== 'completada') {
        lista.push({
          icono: faCheck,
          titulo: fila.estado === 'no_asistio' ? 'Cambiar a completada (corregir)' : 'Marcar completada',
          clase: 'btn-aprobar',
          onClick: () => pedirConfirmacion(fila, 'completada'),
        });
      }
      if (fila.estado !== 'no_asistio') {
        lista.push({
          icono: faUserSlash,
          titulo: fila.estado === 'completada' ? 'Cambiar a no asistió (corregir)' : 'Marcar no asistió',
          clase: 'btn-eliminar',
          onClick: () => pedirConfirmacion(fila, 'no_asistio'),
        });
      }
    }
    return lista;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(total / FILA_POR_PAGINA));
  const textosAccion = {
    confirmar: ['Confirmar cita', 'confirmar', 'primario'],
    cancelar: ['Cancelar cita', 'cancelar', 'peligro'],
    completada: ['Marcar como completada', 'completada', 'primario'],
    no_asistio: ['Marcar como no asistió', 'no_asistió', 'peligro'],
  };
  const [tituloAccion, textoConfirmar, tipoAccion] = textosAccion[confirmacion?.accion] ?? ['', '', 'primario'];

  return (
    <div className="admin-citas">
      <div className="filtros-barra">
        <h2>Citas</h2>

        <div className="filtros-controles">
          <select
            className="input"
            value={filtros.estado}
            onChange={(e) => cambiarFiltro('estado', e.target.value)}
          >
            {opcionesEstado.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={filtros.fecha_desde}
            onChange={(e) => cambiarFiltro('fecha_desde', e.target.value)}
            title="Fecha desde"
          />
          <input
            type="date"
            className="input"
            value={filtros.fecha_hasta}
            onChange={(e) => cambiarFiltro('fecha_hasta', e.target.value)}
            title="Fecha hasta"
          />
          <select
            className="input"
            value={filtros.orden}
            onChange={(e) => cambiarFiltro('orden', e.target.value)}
            title="Orden de las citas"
          >
            <option value="smart">Hoy y próximas primero</option>
            <option value="asc">Más antiguas primero</option>
            <option value="desc">Más recientes primero</option>
          </select>

          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setModalNuevaCita(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Nueva Cita</span>
          </button>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay citas registradas"
        buscar={false}
        ordenFecha={filtros.orden === 'asc' ? 'vieja' : 'reciente'}
        onOrdenFechaChange={(nuevoOrden) => {
          cambiarFiltro('orden', nuevoOrden === 'vieja' ? 'asc' : 'desc');
        }}
      />

      {total > FILA_POR_PAGINA && (
        <div className="paginacion">
          <button
            type="button"
            className="btn btn-secundario btn-sm"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            <FontAwesomeIcon icon={faChevronLeft} /> Anterior
          </button>
          <span>Página {pagina} de {totalPaginas} ({total} citas)</span>
          <button
            type="button"
            className="btn btn-secundario btn-sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
            Siguiente <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}

      {detalle && (
        <FormModal
          titulo="Detalle de la cita"
          campos={[]}
          valoresIniciales={{}}
          onSubmit={() => {}}
          onCerrar={() => {
            setDetalle(null);
            setHistorial(null);
            setEditandoNotas(false);
          }}
          soloLectura
          renderVerUsuario={() => (
            <div>
              <CitaDetalle cita={detalle} />

              {/* Sección de Notas Médicas / Evolución con Textarea y edición para Admin */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label htmlFor="admin-cita-notas" style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                    Notas de la consulta / Evolución
                  </label>
                  {!editandoNotas ? (
                    <button
                      type="button"
                      className="btn btn-secundario btn-sm"
                      onClick={() => setEditandoNotas(true)}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} /> Editar Notas
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secundario btn-sm"
                        onClick={() => {
                          setTextoNotas(detalle.notas || '');
                          setEditandoNotas(false);
                        }}
                        disabled={guardandoNotas}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primario btn-sm"
                        onClick={guardarNotas}
                        disabled={guardandoNotas}
                      >
                        <FontAwesomeIcon icon={faSave} /> {guardandoNotas ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  id="admin-cita-notas"
                  className="input"
                  rows={4}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    backgroundColor: editandoNotas ? '#ffffff' : '#f1f5f9',
                    cursor: editandoNotas ? 'text' : 'not-allowed',
                    color: '#334155',
                    fontFamily: 'inherit',
                  }}
                  placeholder={editandoNotas ? 'Escribe aquí observaciones médicas, diagnóstico o evolución del paciente...' : 'Sin notas registradas.'}
                  value={textoNotas}
                  onChange={(e) => setTextoNotas(e.target.value)}
                  disabled={!editandoNotas}
                />
              </div>

              {detalle.estado !== 'cancelada' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Cambiar estado:</span>
                  {detalle.estado !== 'completada' && (
                    <button
                      type="button"
                      className="btn btn-primario btn-sm"
                      onClick={() => pedirConfirmacion(detalle, 'completada')}
                    >
                      <FontAwesomeIcon icon={faCheck} /> {detalle.estado === 'no_asistio' ? 'Cambiar a completada' : 'Marcar completada'}
                    </button>
                  )}
                  {detalle.estado !== 'no_asistio' && (
                    <button
                      type="button"
                      className="btn btn-peligro btn-sm"
                      onClick={() => pedirConfirmacion(detalle, 'no_asistio')}
                    >
                      <FontAwesomeIcon icon={faUserSlash} /> {detalle.estado === 'completada' ? 'Cambiar a no asistió' : 'Marcar no asistió'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-rechazar btn-sm"
                    onClick={() => pedirConfirmacion(detalle, 'cancelar')}
                  >
                    <FontAwesomeIcon icon={faBan} /> Cancelar cita
                  </button>
                </div>
              )}
              <h3 className="dash-graficas-titulo">Historial de estados</h3>
              {cargandoHistorial ? (
                <p className="panel-vacio">Cargando historial…</p>
              ) : historial && historial.length > 0 ? (
                <ul className="panel-lista">
                  {historial.map((h) => (
                    <li className="panel-fila" key={h.id}>
                      <div className="panel-fila-info">
                        <span className="panel-fila-principal">
                          {h.estado_anterior_clave
                            ? `${etiquetaEstado(h.estado_anterior_clave)} → ${etiquetaEstado(h.estado_nuevo_clave)}`
                            : etiquetaEstado(h.estado_nuevo_clave)}
                        </span>
                        <span className="panel-fila-secundario">
                          {formatearFechaHora(h.created_at)} · origen: {h.origen}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-vacio">Sin cambios de estado registrados.</p>
              )}
            </div>
          )}
        />
      )}

      {reagendando && (
        <ReagendarCitaModal
          cita={reagendando}
          titulo={`Reagendar cita de ${reagendando.paciente_nombre ?? ''}`.trim()}
          mostrarPaciente
          onCerrar={() => setReagendando(null)}
          onReagendada={() => { setReagendando(null); cargarDatos(); }}
          mostrarToast={mostrarToast}
        />
      )}

      {modalNuevaCita && (
        <ModalAgendarAdmin
          onCerrar={() => setModalNuevaCita(false)}
          onCitaAgendada={() => {
            setModalNuevaCita(false);
            cargarDatos();
          }}
          mostrarToast={mostrarToast}
        />
      )}

      {confirmacion && (
        <ConfirmDialog
          titulo={tituloAccion}
          mensaje={`¿${textoConfirmar} la cita de ${confirmacion.fila.paciente_nombre ?? 'este paciente'} con ${confirmacion.fila.medico_nombre ?? 'el médico'}?`}
          textoConfirmar={textoConfirmar}
          enConfirmacion={enConfirmacion}
          onConfirmar={ejecutarAccion}
          onCancelar={() => setConfirmacion(null)}
          tipo={tipoAccion}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
