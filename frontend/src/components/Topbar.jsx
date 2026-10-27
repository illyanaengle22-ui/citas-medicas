import { useAuth } from '../context/AuthContext';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { NavLink } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const roles = { 1: 'Admin', 2: 'Médico', 3: 'Paciente' };

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Topbar() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Leer foto_url del localStorage (se guarda tras actualizar perfil)
  const fotoUrl = user?.foto_url ? `${API_URL}${user.foto_url}` : null;

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

        {/* Mini avatar con link a perfil */}
        <NavLink to="/perfil" className="topbar-avatar" title="Mi Perfil">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Perfil" className="topbar-avatar-img" />
          ) : (
            <span className="topbar-avatar-iniciales">
              {iniciales(user?.nombre || '')}
            </span>
          )}
        </NavLink>

        <button className="btn-cerrar-sesion" onClick={handleLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
