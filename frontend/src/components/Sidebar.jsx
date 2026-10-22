import { NavLink } from 'react-router-dom';
import {
  faBuilding,
  faCalendar,
  faCalendarAlt,
  faCalendarCheck,
  faCalendarPlus,
  faClock,
  faHome,
  faStethoscope,
  faUser,
  faUserInjured,
  faUserMd,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../context/AuthContext';

const menuAdmin = [
  { to: '/admin', icono: faHome, texto: 'Dashboard', fin: true, proximamente: false },
  { to: '/admin/usuarios', icono: faUsers, texto: 'Usuarios', proximamente: false },
  { to: '/admin/medicos', icono: faUserMd, texto: 'Médicos', proximamente: false },
  { to: '/admin/citas', icono: faCalendar, texto: 'Citas' },
  { to: '/admin/consultorios', icono: faBuilding, texto: 'Consultorios', proximamente: false },
  { to: '/admin/especialidades', icono: faStethoscope, texto: 'Especialidades', proximamente: false },
];

const menuMedico = [
  { to: '/medico', icono: faHome, texto: 'Dashboard', fin: true, proximamente: false },
  { to: '/medico/agenda', icono: faCalendarAlt, texto: 'Mi Agenda', proximamente: false },
  { to: '/medico/pacientes', icono: faUserInjured, texto: 'Mis Pacientes', proximamente: false },
  { to: '/medico/horarios', icono: faClock, texto: 'Mis Horarios', proximamente: false },
];

const menuPaciente = [
  { to: '/paciente', icono: faHome, texto: 'Dashboard', fin: true, proximamente: false },
  { to: '/paciente/citas', icono: faCalendarCheck, texto: 'Mis Citas', proximamente: false },
  { to: '/paciente/agendar', icono: faCalendarPlus, texto: 'Agendar Cita', proximamente: false },
  { to: '/paciente/perfil', icono: faUser, texto: 'Mi Perfil', proximamente: false },
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
            {item.proximamente !== false && (
              <span className="sidebar-badge" title="Próximamente">Próx.</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
