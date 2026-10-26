import { useState, useEffect, useCallback } from 'react';
import {
  faCheck, faBan, faUserSlash, faRotateRight, faClipboardList, faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, construirQuery } from '../../services/api';
import {
  ESTADOS_CITA, claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
  esVigente,
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
    ['Notas', cita.notas || <span key="n" className="celda-vacia">—</span>],
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
  const [filtros, setFiltros] = useState({ estado: '', fecha_desde: '', fecha_hasta: '' });
  const [detalle, setDetalle] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [enConfirmacion, setEnConfirmacion] = useState(false);
  const [reagendando, setReagendando] = useState(null);
  const [propuestas, setPropuestas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const query = construirQuery({
        estado: filtros.estado,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
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
      setHistorial(null);
    } catch (err) {
      mostrarToast(err.message, 'error');
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
          body: { estado: 'completada' },
        });
        mostrarToast('Cita marcada como completada');
      } else if (accion === 'no_asistio') {
        await apiFetch(`/api/citas/${fila.id}/estado`, {
          method: 'PUT',
          body: { estado: 'no_asistio' },
        });
        mostrarToast('Cita marcada como no asistió');
      }
      setConfirmacion(null);
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setEnConfirmacion(false);
    }
  }

  // ── Reagendar (RN-083: propone los 3 horarios libres más cercanos) ─────────
  async function abrirReagendar(fila) {
    try {
      const data = await apiFetch(`/api/citas/${fila.id}/propuestas`);
      setPropuestas(Array.isArray(data) ? data : []);
      setReagendando({ fila, fecha: '', usarOtra: false });
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
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
    if (vigente) {
      lista.push({ icono: faRotateRight, titulo: 'Reagendar', clase: 'btn-editar', onClick: () => abrirReagendar(fila) });
      lista.push({ icono: faBan, titulo: 'Cancelar', clase: 'btn-rechazar', onClick: () => pedirConfirmacion(fila, 'cancelar') });
    }
    if (fila.estado === 'confirmada' || fila.estado === 'reagendada') {
      lista.push({ icono: faCheck, titulo: 'Completada', clase: 'btn-aprobar', onClick: () => pedirConfirmacion(fila, 'completada') });
      lista.push({ icono: faUserSlash, titulo: 'No asistió', clase: 'btn-eliminar', onClick: () => pedirConfirmacion(fila, 'no_asistio') });
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
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No hay citas registradas"
        buscar={false}
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
          onCerrar={() => { setDetalle(null); setHistorial(null); }}
          soloLectura
          renderVerUsuario={() => (
            <div>
              <CitaDetalle cita={detalle} />
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
        <FormModal
          titulo={`Reagendar cita de ${reagendando.fila.paciente_nombre ?? ''}`}
          campos={[
            ...(propuestas.length > 0 ? [{
              nombre: 'propuesta',
              etiqueta: 'Horarios disponibles (RN-083)',
              tipo: 'select',
              requerido: !reagendando.usarOtra,
              opciones: [
                ...propuestas.map((p, i) => ({
                  valor: String(i),
                  etiqueta: `${formatearFechaHora(p.fecha_hora)} (${p.hora_inicio?.slice(0, 5)})`,
                })),
                { valor: 'otra', etiqueta: 'Elegir otra fecha y hora…' },
              ],
            }] : []),
            ...(reagendando.usarOtra ? [{
              nombre: 'fecha_hora',
              etiqueta: 'Nueva fecha y hora',
              tipo: 'datetime-local',
              requerido: true,
              ayuda: 'Debe caer dentro de un horario activo del médico [RN-072]',
            }] : []),
          ]}
          valoresIniciales={reagendando.usarOtra ? { fecha_hora: reagendando.fecha ?? '' } : { propuesta: '0' }}
          onSubmit={async (valores) => {
            if (valores.propuesta === 'otra') {
              setReagendando((prev) => ({ ...prev, usarOtra: true, fecha: prev.fecha ?? '' }));
              return;
            }
            const indice = Number(valores.propuesta);
            const propuesta = propuestas[indice];
            if (!propuesta) {
              mostrarToast('Selecciona un horario válido', 'error');
              return;
            }
            setGuardando(true);
            try {
              await apiFetch(`/api/citas/${reagendando.fila.id}`, {
                method: 'PUT',
                body: { fecha_hora: propuesta.fecha_hora },
              });
              mostrarToast('Cita reagendada correctamente');
              setReagendando(null);
              setPropuestas([]);
              cargarDatos();
            } catch (err) {
              mostrarToast(err.message, 'error');
            } finally {
              setGuardando(false);
            }
          }}
          onCerrar={() => { setReagendando(null); setPropuestas([]); }}
          guardando={guardando}
          errores={{}}
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
