import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardAdmin from '../components/dashboard/DashboardAdmin';
import DashboardMedico from './medico/DashboardMedico';
import DashboardPaciente from './paciente/DashboardPaciente';

// Punto de entrada del dashboard en la raíz de cada panel.
// Muestra las estadísticas propias del rol autenticado.
export default function DashboardHome() {
  const { user } = useAuth();

  switch (Number(user?.rol_id)) {
    case 1:
      return <DashboardAdmin />;
    case 2:
      return <DashboardMedico />;
    case 3:
      return <DashboardPaciente />;
    default:
      return <Navigate to="/login" replace />;
  }
}
