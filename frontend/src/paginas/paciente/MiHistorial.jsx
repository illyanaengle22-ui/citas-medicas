import { useState, useEffect, useCallback } from 'react';
import { faNotesMedical, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import { apiFetch, construirQuery } from '../../services/api';
import {
  ESTADOS_FINALES, claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
} from '../../components/citasHelpers';

const columnas = [
  {
    clave: 'fecha_hora',
    titulo: 'Fecha',
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
    titulo: 'Resultado',
    render: (fila) => (
      <span className={claseEstado(fila.estado)}>{etiquetaEstado(fila.estado)}</span>
    ),
  },
];

// RN-115: el historial muestra solo citas finalizadas (cancelada, completada,
// no_asistio). El filtro por estado final es el comportamiento por defecto.
const opcionesEstado = [
  { valor: '', etiqueta: 'Todos los resultados' },
  ...ESTADOS_FINALES.map((clave) => ({
    valor: clave,
    etiqueta: etiquetaEstado(clave),
  })),
];

function CitaDetalle({ cita }) {
  if (!cita) return null;
  const filas = [
    ['Médico', cita.medico_nombre ?? `#${cita.medico_id}`],
    ['Consultorio', cita.consultorio_nombre ?? `#${cita.consultorio_id}`],
    ['Fecha y hora', formatearFechaHora(cita.fecha_hora)],
    ['Duración', formatearDuracion(cita.duracion_minutos)],
    ['Resultado', <span key="e" className={claseEstado(cita.estado)}>{etiquetaEstado(cita.estado)}</span>],
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

export default function MiHistorial() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const query = construirQuery({ estado: filtroEstado, limit: 100 });
      const data = await apiFetch(`/api/citas${query}`);
      setDatos(data?.citas ?? []);
    } catch (err) {
      setToast({ mensaje: err.message, tipo: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  async function abrirDetalle(fila) {
    try {
      const cita = await apiFetch(`/api/citas/${fila.id}`);
      setDetalle(cita);
    } catch (err) {
      setToast({ mensaje: err.message, tipo: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  }

  const acciones = (fila) => [
    { icono: faEye, titulo: 'Ver', clase: 'btn-ver', onClick: () => abrirDetalle(fila) },
  ];

  return (
    <div className="paciente-historial">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faNotesMedical} aria-hidden="true" /> Mi Historial
        </h2>

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
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No tienes citas en tu historial"
        buscar={false}
      />

      {detalle && (
        <FormModal
          titulo="Detalle de la consulta"
          campos={[]}
          valoresIniciales={{}}
          onSubmit={() => {}}
          onCerrar={() => setDetalle(null)}
          soloLectura
          renderVerUsuario={() => <CitaDetalle cita={detalle} />}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
