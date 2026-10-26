import { useCallback, useEffect, useMemo, useState } from 'react';
import { faCalendarAlt, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CalendarioCitas from '../../components/CalendarioCitas';
import FormModal from '../../components/FormModal';
import { apiFetch } from '../../services/api';
import { obtenerTodasLasCitas } from '../../services/citas';
import '../agenda.css';
import {
  claseEstado, etiquetaEstado, formatearFechaHora, formatearDuracion,
} from '../../components/citasHelpers';

function DetalleCita({ cita }) {
  if (!cita) return null;
  const filas = [
    ['Paciente', cita.paciente_nombre ?? `#${cita.paciente_id}`],
    ['Médico', cita.medico_nombre ?? `#${cita.medico_id}`],
    ['Consultorio', cita.consultorio_nombre ?? `#${cita.consultorio_id}`],
    ['Fecha y hora', formatearFechaHora(cita.fecha_hora)],
    ['Duración', formatearDuracion(cita.duracion_minutos)],
    ['Estado', <span key="estado" className={claseEstado(cita.estado)}>{etiquetaEstado(cita.estado)}</span>],
    ['Motivo', cita.motivo || <span key="motivo" className="celda-vacia">—</span>],
    ['Notas', cita.notas || <span key="notas" className="celda-vacia">—</span>],
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

export default function AdminCalendario() {
  const [citas, setCitas] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    const [resultadoCitas, resultadoMedicos] = await Promise.allSettled([
      obtenerTodasLasCitas(),
      apiFetch('/api/medicos?todos=true'),
    ]);

    if (resultadoCitas.status === 'rejected') {
      setError(resultadoCitas.reason?.message || 'No se pudieron cargar las citas');
      setCargando(false);
      return;
    }

    setCitas(resultadoCitas.value);

    if (resultadoMedicos.status === 'fulfilled') {
      const lista = resultadoMedicos.value;
      setMedicos(Array.isArray(lista) ? lista : (lista?.data ?? []));
    } else {
      setMedicos([]);
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const opcionesMedicos = useMemo(() => {
    const mapa = new Map();
    medicos.forEach((medico) => {
      mapa.set(String(medico.id), medico.medico_mostrar ?? medico.nombre ?? `Médico #${medico.id}`);
    });
    citas.forEach((cita) => {
      const id = String(cita.medico_id);
      if (!mapa.has(id)) {
        mapa.set(id, cita.medico_nombre ?? `Médico #${cita.medico_id}`);
      }
    });
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [citas, medicos]);

  const citasFiltradas = useMemo(
    () => (medicoId ? citas.filter((cita) => String(cita.medico_id) === medicoId) : citas),
    [citas, medicoId]
  );

  return (
    <div className="admin-calendario">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faCalendarAlt} aria-hidden="true" /> Calendario de citas
        </h2>

        <div className="filtros-controles">
          <select
            className="input"
            value={medicoId}
            onChange={(event) => setMedicoId(event.target.value)}
            aria-label="Filtrar por médico"
          >
            <option value="">Todos los médicos</option>
            {opcionesMedicos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secundario btn-sm"
            onClick={cargarDatos}
            disabled={cargando}
          >
            <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" /> Actualizar
          </button>
        </div>
      </div>

      {!cargando && !error && (
        <p className="calendario-resumen">
          Mostrando {citasFiltradas.length} de {citas.length} cita{citas.length === 1 ? '' : 's'}
          {medicoId ? ' para el médico seleccionado' : ' de todos los médicos'}.
        </p>
      )}

      {cargando ? (
        <div className="crud-cargando">
          <div className="spinner" />
          <span>Cargando calendario...</span>
        </div>
      ) : error ? (
        <div className="alerta-error" role="alert">{error}</div>
      ) : (
        <CalendarioCitas citas={citasFiltradas} onEventClick={setDetalle} />
      )}

      {detalle && (
        <FormModal
          titulo="Detalle de la cita"
          campos={[]}
          valoresIniciales={{}}
          onSubmit={() => {}}
          onCerrar={() => setDetalle(null)}
          soloLectura
          renderVerUsuario={() => <DetalleCita cita={detalle} />}
        />
      )}
    </div>
  );
}
