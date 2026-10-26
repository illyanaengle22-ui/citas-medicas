import { useState, useEffect, useCallback } from 'react';
import {
  faCheck, faBan, faUserSlash, faClipboardList, faCalendarCheck, faCalendarAlt, faList,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CalendarioCitas from '../../components/CalendarioCitas';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch } from '../../services/api';
import { obtenerTodasLasCitas } from '../../services/citas';
import '../agenda.css';
import {
  ESTADOS_CITA, claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
  esVigente, puedeMarcarCompletada,
} from '../../components/citasHelpers';

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
  { clave: 'consultorio_nombre', titulo: 'Consultorio' },
  {
    clave: 'motivo',
    titulo: 'Motivo',
    render: (fila) => fila.motivo
      ? <span className="celda-truncada" title={fila.motivo}>{fila.motivo}</span>
      : <span className="celda-vacia">—</span>,
  },
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
    ['Consultorio', cita.consultorio_nombre ?? `#${cita.consultorio_id}`],
    ['Fecha y hora', formatearFechaHora(cita.fecha_hora)],
    ['Duración', formatearDuracion(cita.duracion_minutos)],
    ['Estado', <span key="e" className={claseEstado(cita.estado)}>{etiquetaEstado(cita.estado)}</span>],
    ['Motivo', cita.motivo || <span key="m" className="celda-vacia">—</span>],
    ['Notas', cita.notas || <span key="n" className="celda-vacia">—</span>],
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

export default function MiAgenda() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('calendario');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [enConfirmacion, setEnConfirmacion] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const citas = await obtenerTodasLasCitas({
        estado: filtroEstado,
        fecha_desde: filtroDesde,
        fecha_hasta: filtroHasta,
      });
      setDatos(citas);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function mostrarToast(mensaje, tipo = 'exito') {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3000);
  }

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

  function pedirConfirmacion(fila, accion) {
    setConfirmacion({ fila, accion });
  }

  // RN-082: el médico solo marca asistencia (completada / no_asistio).
  async function ejecutarAccion() {
    if (!confirmacion) return;
    const { fila, accion } = confirmacion;
    setEnConfirmacion(true);
    try {
      if (accion === 'completada') {
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
      } else if (accion === 'cancelar') {
        await apiFetch(`/api/citas/${fila.id}/estado`, {
          method: 'PUT',
          body: { estado: 'cancelada' },
        });
        mostrarToast('Cita cancelada; el horario quedó libre');
      }
      setConfirmacion(null);
      cargarDatos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setEnConfirmacion(false);
    }
  }

  const acciones = (fila) => {
    const lista = [
      { icono: faClipboardList, titulo: 'Ver detalle e historial', clase: 'btn-ver', onClick: () => abrirHistorial(fila) },
    ];
    if (fila.estado === 'confirmada' || fila.estado === 'reagendada') {
      const puedeCompletar = puedeMarcarCompletada(fila.fecha_hora);
      lista.push({
        icono: faCheck,
        titulo: puedeCompletar ? 'Completada' : 'Aún no es la hora de la cita',
        clase: 'btn-aprobar',
        disabled: !puedeCompletar,
        onClick: () => pedirConfirmacion(fila, 'completada'),
      });
      lista.push({ icono: faUserSlash, titulo: 'No asistió', clase: 'btn-eliminar', onClick: () => pedirConfirmacion(fila, 'no_asistio') });
    }
    if (esVigente(fila.estado)) {
      lista.push({ icono: faBan, titulo: 'Cancelar', clase: 'btn-rechazar', onClick: () => pedirConfirmacion(fila, 'cancelar') });
    }
    return lista;
  };

  const textosAccion = {
    completada: ['Marcar como completada', 'completada', 'primario'],
    no_asistio: ['Marcar como no asistió', 'no asistió', 'peligro'],
    cancelar: ['Cancelar cita', 'cancelar', 'peligro'],
  };
  const [tituloAccion, textoConfirmar, tipoAccion] = textosAccion[confirmacion?.accion] ?? ['', '', 'primario'];

  const hayFiltros = filtroEstado || filtroDesde || filtroHasta;

  return (
    <div className="medico-agenda">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" /> Mi Agenda
        </h2>

        <div className="filtros-controles">
          <div className="vista-toggle" role="group" aria-label="Vista de la agenda">
            <button
              type="button"
              className={`vista-toggle-btn${vista === 'calendario' ? ' activo' : ''}`}
              onClick={() => setVista('calendario')}
              aria-pressed={vista === 'calendario'}
            >
              <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" /> Calendario
            </button>
            <button
              type="button"
              className={`vista-toggle-btn${vista === 'lista' ? ' activo' : ''}`}
              onClick={() => setVista('lista')}
              aria-pressed={vista === 'lista'}
            >
              <FontAwesomeIcon icon={faList} aria-hidden="true" /> Lista
            </button>
          </div>
          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            {opcionesEstado.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            title="Desde"
          />
          <input
            type="date"
            className="input"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            title="Hasta"
          />
          {hayFiltros && (
            <button
              type="button"
              className="btn btn-secundario btn-sm"
              onClick={() => { setFiltroEstado(''); setFiltroDesde(''); setFiltroHasta(''); }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="crud-cargando">
          <div className="spinner" />
          <span>Cargando citas...</span>
        </div>
      ) : vista === 'calendario' ? (
        <CalendarioCitas citas={datos} onEventClick={abrirDetalle} />
      ) : (
        <CrudTable
          columnas={columnas}
          datos={datos}
          cargando={false}
          acciones={acciones}
          mensajeVacio="No tienes citas registradas"
          buscar={false}
        />
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

      {confirmacion && (
        <ConfirmDialog
          titulo={tituloAccion}
          mensaje={`¿${textoConfirmar} la cita de ${confirmacion.fila.paciente_nombre ?? 'este paciente'}?`}
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
