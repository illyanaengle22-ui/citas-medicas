import { useAuth } from '../context/AuthContext';
import DashboardAdmin from '../components/dashboard/DashboardAdmin';

export default function DashboardHome() {
  const { user } = useAuth();

  if (Number(user?.rol_id) !== 1) {
    return null;
  }

  return <DashboardAdmin />;
}
