import { useAuth } from '../context/AuthContext';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const roles = { 1: 'Admin', 2: 'Médico', 3: 'Paciente' };

export default function Topbar() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#5E9BBA" />
          <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="topbar-nombre">MediCitas</span>
      </div>

      <div className="topbar-derecha">
        <span className="insignia-rol">{roles[user?.rol_id] || 'Usuario'}</span>
        <span className="topbar-usuario">{user?.nombre || 'Usuario'}</span>
        <button className="btn-cerrar-sesion" onClick={handleLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
