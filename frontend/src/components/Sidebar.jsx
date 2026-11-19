import { NavLink } from 'react-router-dom';
import {
  faBuilding,
  faCalendar,
  faCalendarAlt,
  faCalendarCheck,
  faCalendarPlus,
  faClock,
  faHistory,
  faHome,
  faStethoscope,
  faTimes,
  faUserCircle,
  faUserInjured,
  faUserMd,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../context/AuthContext';

// Cada item debe tener una ruta real registrada en App.jsx.
// `fin: true` evita que "/admin" marque activo también en "/admin/usuarios".
const menuAdmin = [
  { to: '/admin', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/admin/usuarios', icono: faUsers, texto: 'Usuarios' },
  { to: '/admin/medicos', icono: faUserMd, texto: 'Médicos' },
  { to: '/admin/citas', icono: faCalendar, texto: 'Citas' },
  { to: '/admin/calendario', icono: faCalendarAlt, texto: 'Calendario' },
  { to: '/admin/horarios', icono: faClock, texto: 'Horarios' },
  { to: '/admin/consultorios', icono: faBuilding, texto: 'Consultorios' },
  { to: '/admin/especialidades', icono: faStethoscope, texto: 'Especialidades' },
  { to: '/perfil', icono: faUserCircle, texto: 'Mi Perfil' },
];

const menuMedico = [
  { to: '/medico', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/medico/agenda', icono: faCalendarAlt, texto: 'Mi Agenda' },
  { to: '/medico/pacientes', icono: faUserInjured, texto: 'Mis Pacientes' },
  { to: '/medico/horarios', icono: faClock, texto: 'Mis Horarios' },
  { to: '/perfil', icono: faUserCircle, texto: 'Mi Perfil' },
];

const menuPaciente = [
  { to: '/paciente', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/paciente/agendar', icono: faCalendarPlus, texto: 'Agendar Cita' },
  { to: '/paciente/citas', icono: faCalendarCheck, texto: 'Mis Citas' },
  { to: '/paciente/historial', icono: faHistory, texto: 'Mi Historial' },
  { to: '/perfil', icono: faUserCircle, texto: 'Mi Perfil' },
];

function obtenerMenu(rolId) {
  switch (Number(rolId)) {
    case 1:
      return menuAdmin;
    case 2:
      return menuMedico;
    case 3:
      return menuPaciente;
    default:
      return [];
  }
}

export default function Sidebar({ abierto, onCerrar }) {
  const { user } = useAuth();
  const items = obtenerMenu(user?.rol_id);

  if (items.length === 0) return null;

  const handleClickItem = () => {
    if (typeof onCerrar === 'function') {
      onCerrar();
    }
  };

  return (
    <aside className={`sidebar ${abierto ? 'abierto' : ''}`}>
      <div className="sidebar-cabecera-movil">
        <div className="topbar-logo">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#5E9BBA" />
            <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="topbar-nombre">MediCitas</span>
        </div>
        <button
          type="button"
          className="btn-cerrar-sidebar"
          onClick={onCerrar}
          aria-label="Cerrar menú lateral"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fin}
            className={({ isActive }) => `sidebar-item${isActive ? ' activo' : ''}`}
            onClick={handleClickItem}
          >
            <FontAwesomeIcon icon={item.icono} className="sidebar-icono" />
            <span>{item.texto}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
