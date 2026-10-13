import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-contenido">
        <Topbar />
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
