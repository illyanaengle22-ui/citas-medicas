import { useState, useEffect, useCallback } from 'react';
import { faCalendarDays, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import { apiFetch } from '../../services/api';
import { DIAS_SEMANA, horaCorta, formatearFecha } from '../../components/citasHelpers';

function nombreDia(valor) {
  return DIAS_SEMANA.find((d) => d.valor === Number(valor))?.etiqueta ?? '—';
}

const columnas = [
  { clave: 'consultorio_nombre', titulo: 'Consultorio' },
  {
    clave: 'dia_semana',
    titulo: 'Día',
    render: (fila) => nombreDia(fila.dia_semana),
  },
  {
    clave: 'hora_inicio',
    titulo: 'Horario',
    render: (fila) => `${horaCorta(fila.hora_inicio)} – ${horaCorta(fila.hora_fin)}`,
  },
  {
    clave: 'activo',
    titulo: 'Estado',
    render: (fila) => (
      <span className={`badge ${fila.activo ? 'badge-exito' : 'badge-inactivo'}`}>
        {fila.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
];

export default function MisHorarios() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ver, setVer] = useState(null);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiFetch('/api/horarios');
      setDatos(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      setToast({ mensaje: err.message, tipo: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const acciones = (fila) => [
    { icono: faEye, titulo: 'Ver', clase: 'btn-ver', onClick: () => setVer(fila) },
  ];

  return (
    <div className="medico-horarios">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" /> Mis Horarios
        </h2>
        <div className="filtros-controles">
          <span className="info-complementaria">
            Tu disponibilidad la administra el personal de la clínica.
          </span>
        </div>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="No tienes horarios asignados"
        buscar={false}
      />

      {ver && (
        <FormModal
          titulo="Detalle del horario"
          campos={[]}
          valoresIniciales={{}}
          onSubmit={() => {}}
          onCerrar={() => setVer(null)}
          soloLectura
          renderVerUsuario={() => (
            <dl className="ver-usuario-lista">
              <div className="ver-usuario-fila">
                <dt>Consultorio</dt>
                <dd>{ver.consultorio_nombre ?? `#${ver.consultorio_id}`}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Día</dt>
                <dd>{nombreDia(ver.dia_semana)}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Horario</dt>
                <dd>{horaCorta(ver.hora_inicio)} – {horaCorta(ver.hora_fin)}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Estado</dt>
                <dd>
                  <span className={`badge ${ver.activo ? 'badge-exito' : 'badge-inactivo'}`}>
                    {ver.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Registrado</dt>
                <dd>{formatearFecha(ver.created_at)}</dd>
              </div>
            </dl>
          )}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.tipo}`}>{toast.mensaje}</div>
      )}
    </div>
  );
}
