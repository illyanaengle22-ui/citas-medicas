import { useState, useEffect, useCallback } from 'react';
import { faUsers, faEye, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import CrudTable from '../../components/CrudTable';
import FormModal from '../../components/FormModal';
import { apiFetch } from '../../services/api';
import { formatearFecha } from '../../components/citasHelpers';

const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'email', titulo: 'Correo electrónico' },
  {
    clave: 'ultima_cita',
    titulo: 'Última cita',
    render: (fila) => (fila.ultima_cita ? formatearFecha(fila.ultima_cita) : <span className="celda-vacia">—</span>),
  },
  {
    clave: 'total_citas',
    titulo: 'Citas atendidas',
    render: (fila) => fila.total_citas ?? 0,
  },
];

export default function MisPacientes() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ver, setVer] = useState(null);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiFetch('/api/citas/mis-pacientes');
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
    { icono: faCalendarCheck, titulo: 'Agenda', clase: 'btn-editar', onClick: () => navigate('/medico/agenda') },
  ];

  return (
    <div className="medico-pacientes">
      <div className="filtros-barra">
        <h2>
          <FontAwesomeIcon icon={faUsers} aria-hidden="true" /> Mis Pacientes
        </h2>
      </div>

      <CrudTable
        columnas={columnas}
        datos={datos}
        cargando={cargando}
        acciones={acciones}
        mensajeVacio="Aún no tienes pacientes atendidos"
      />

      {ver && (
        <FormModal
          titulo="Detalle del paciente"
          campos={[]}
          valoresIniciales={{}}
          onSubmit={() => {}}
          onCerrar={() => setVer(null)}
          soloLectura
          renderVerUsuario={() => (
            <dl className="ver-usuario-lista">
              <div className="ver-usuario-fila">
                <dt>Nombre</dt>
                <dd>{ver.nombre}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Correo</dt>
                <dd>{ver.email}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Última cita</dt>
                <dd>{ver.ultima_cita ? formatearFecha(ver.ultima_cita) : '—'}</dd>
              </div>
              <div className="ver-usuario-fila">
                <dt>Citas atendidas</dt>
                <dd>{ver.total_citas ?? 0}</dd>
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
