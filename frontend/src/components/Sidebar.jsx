import { NavLink } from 'react-router-dom';
import {
  faHome,
  faUsers,
  faUserMd,
  faCalendar,
  faBuilding,
  faStethoscope,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const items = [
  { to: '/admin', icono: faHome, texto: 'Dashboard', fin: true },
  { to: '/admin/usuarios', icono: faUsers, texto: 'Usuarios' },
  { to: '/admin/medicos', icono: faUserMd, texto: 'Médicos' },
  { to: '/admin/citas', icono: faCalendar, texto: 'Citas' },
  { to: '/admin/consultorios', icono: faBuilding, texto: 'Consultorios' },
  { to: '/admin/especialidades', icono: faStethoscope, texto: 'Especialidades', proximamente: false },
];

export default function Sidebar() {
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
            {item.proximamente !== false && <span className="sidebar-badge">Próximamente</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
