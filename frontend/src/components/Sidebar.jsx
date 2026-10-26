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
];

const menuMedico = [
  { to: '/medico', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/medico/agenda', icono: faCalendarAlt, texto: 'Mi Agenda' },
  { to: '/medico/pacientes', icono: faUserInjured, texto: 'Mis Pacientes' },
  { to: '/medico/horarios', icono: faClock, texto: 'Mis Horarios' },
];

const menuPaciente = [
  { to: '/paciente', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/paciente/agendar', icono: faCalendarPlus, texto: 'Agendar Cita' },
  { to: '/paciente/citas', icono: faCalendarCheck, texto: 'Mis Citas' },
  { to: '/paciente/historial', icono: faHistory, texto: 'Mi Historial' },
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

export default function Sidebar() {
  const { user } = useAuth();
  const items = obtenerMenu(user?.rol_id);

  if (items.length === 0) return null;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fin}
            className={({ isActive }) => `sidebar-item${isActive ? ' activo' : ''}`}
          >
            <FontAwesomeIcon icon={item.icono} className="sidebar-icono" />
            <span>{item.texto}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
