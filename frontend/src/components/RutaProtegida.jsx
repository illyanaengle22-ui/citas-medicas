import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ children, roles = [] }) {
  const { user, token } = useAuth();
  const location = useLocation();

  console.log('[RutaProtegida] verificando — token:', !!token, 'user:', !!user, 'roles:', roles, 'user.rol_id:', user?.rol_id);

  if (!token || !user) {
    console.log('[RutaProtegida] → redirige a /login (falta token o user)');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.includes(user.rol_id)) {
    console.log('[RutaProtegida] → redirige a /login (rol no permitido)');
    return <Navigate to="/login" replace />;
  }

  return children;
}
