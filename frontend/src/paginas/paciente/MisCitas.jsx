import { useState, useEffect, useCallback } from 'react';
import {
  faCheck, faBan, faRotateRight, faClipboardList, faCalendarPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiFetch, construirQuery } from '../../services/api';
import {
  ESTADOS_CITA, claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
  esVigente,
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
  { clave: 'medico_nombre', titulo: 'Médico' },
  { clave: 'consultorio_nombre', titulo: 'Consultorio' },
  {
    clave: 'motivo',
    titulo: 'Motivo',
    render: (fila) => (fila.motivo
      ? <span className="celda-truncada" title={fila.motivo}>{fila.motivo}</span>
      : <span className="celda-vacia">—</span>),
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
    ['Médico', cita.medico_nombre ?? `#${cita.medico_id}`],
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

export default function MisCitas() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [enConfirmacion, setEnConfirmacion] = useState(false);
  const [reagendando, setReagendando] = useState(null);
  const [propuestas, setPropuestas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const query = construirQuery({ estado: filtroEstado, limit: 100 });
      const data = await apiFetch(`/api/citas${query}`);
      setDatos(data?.citas ?? []);
    } catch (err) {
      mostrarToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

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

  async function abrirReagendar(fila) {
    try {
      const data = await apiFetch(`/api/citas/${fila.id}/propuestas`);
      setPropuestas(Array.isArray(data) ? data : []);
      setReagendando({ fila, usarOtra: false });
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  }

  const acciones = (fila) => {
    const lista = [
      { icono: faClipboardList, titulo: 'Ver detalle e historial', clase: 'btn-ver', onClick: () => abrirHistorial(fila) },
    ];
    if (esVigente(fila.estado)) {
      if (fila.estado !== 'confirmada') {
        lista.push({ icono: faCheck, titulo: 'Confirmar', clase: 'btn-aprobar', onClick: () => pedirConfirmacion(fila, 'confirmar') });
      }
      lista.push({ icono: faRotateRight, titulo: 'Reagendar', clase: 'btn-editar', onClick: () => abrirReagendar(fila) });
      lista.push({ icono: faBan, titulo: 'Cancelar', clase: 'btn-rechazar', onClick: () => pedirConfirmacion(fila, 'cancelar') });
    }
    return lista;
  };

  const textosAccion = {
    confirmar: ['Confirmar cita', 'confirmar', 'primario'],
    cancelar: ['Cancelar cita', 'cancelar', 'peligro'],
  };
  const [tituloAccion, textoConfirmar, tipoAccion] = textosAccion[confirmacion?.accion] ?? ['', '', 'primario'];

  return (
    <div className="paciente-citas">
      <div className="filtros-barra">
        <h2>Mis Citas</h2>

        <div className="filtros-controles">
          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            {opcionesEstado.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => navigate('/paciente/agendar')}
          >
            <FontAwesomeIcon icon={faCalendarPlus} aria-hidden="true" />
            {' '}Agendar nueva cita
          </button>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="Aún no tienes citas registradas"
        buscar={false}
      />

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
          titulo="Reagendar cita"
          campos={[
            ...(propuestas.length > 0 ? [{
              nombre: 'propuesta',
              etiqueta: 'Horarios disponibles (RN-083)',
              tipo: 'select',
              requerido: true,
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
          valoresIniciales={reagendando.usarOtra ? { fecha_hora: '' } : { propuesta: '0' }}
          onSubmit={async (valores) => {
            if (valores.propuesta === 'otra') {
              setReagendando((prev) => ({ ...prev, usarOtra: true }));
              return;
            }
            const propuesta = propuestas[Number(valores.propuesta)];
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
          mensaje={`¿${textoConfirmar} tu cita con ${confirmacion.fila.medico_nombre ?? 'el médico'}?`}
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
