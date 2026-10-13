import { faUsers, faUserMd, faCalendar, faClock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { mockStats, mockUsuariosPendientes, mockUltimasCitas } from '../services/mockStats';

const tarjetas = [
  { icono: faUsers, etiqueta: 'Usuarios totales', valor: mockStats.usuariosTotales },
  { icono: faClock, etiqueta: 'Pendientes de aprobación', valor: mockStats.usuariosPendientes },
  { icono: faUserMd, etiqueta: 'Médicos', valor: mockStats.medicos },
  { icono: faCalendar, etiqueta: 'Citas de hoy', valor: mockStats.citasHoy },
];

const estadoClase = {
  confirmada: 'badge-exito',
  completada: 'badge-exito',
  pendiente: 'badge-pendiente',
  cancelada: 'badge-error',
};

const estadoTexto = {
  confirmada: 'Confirmada',
  completada: 'Completada',
  pendiente: 'Pendiente',
  cancelada: 'Cancelada',
};

function iniciales(nombre) {
  return nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function DashboardHome() {
  return (
    <div className="dashboard-home">
      <h1 className="dashboard-titulo">Dashboard</h1>

      <div className="tarjetas-stats">
        {tarjetas.map((t, i) => (
          <div key={i} className="tarjeta-stat">
            <div className="tarjeta-stat-icono">
              <FontAwesomeIcon icon={t.icono} />
            </div>
            <div className="tarjeta-stat-info">
              <span className="tarjeta-stat-valor">{t.valor}</span>
              <span className="tarjeta-stat-etiqueta">{t.etiqueta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="paneles">
        <div className="panel">
          <div className="panel-header">
            <FontAwesomeIcon icon={faClock} className="panel-icono" />
            <h2>Usuarios pendientes de aprobación</h2>
          </div>
          <div className="panel-lista">
            {mockUsuariosPendientes.map(u => (
              <div key={u.id} className="panel-fila">
                <div className="avatar">{iniciales(u.nombre)}</div>
                <div className="panel-fila-info">
                  <span className="panel-fila-principal">{u.nombre}</span>
                  <span className="panel-fila-secundario">{u.email} · {u.rol}</span>
                </div>
                <div className="panel-fila-acciones">
                  <button className="btn btn-exito btn-sm">Aprobar</button>
                  <button className="btn btn-error btn-sm">Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <FontAwesomeIcon icon={faCalendar} className="panel-icono" />
            <h2>Últimas citas</h2>
          </div>
          <div className="panel-lista">
            {mockUltimasCitas.map(c => (
              <div key={c.id} className="panel-fila">
                <div className="avatar">{iniciales(c.paciente)}</div>
                <div className="panel-fila-info">
                  <span className="panel-fila-principal">{c.paciente} → {c.medico}</span>
                  <span className="panel-fila-secundario">{c.fecha}</span>
                </div>
                <span className={`badge ${estadoClase[c.estado]}`}>{estadoTexto[c.estado]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
