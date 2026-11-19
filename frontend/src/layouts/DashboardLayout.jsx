import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const location = useLocation();

  // Cerrar el menú lateral en móviles al navegar a otra ruta
  useEffect(() => {
    setSidebarAbierto(false);
  }, [location.pathname]);

  // Cerrar con Escape si está abierto
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarAbierto) {
        setSidebarAbierto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarAbierto]);

  return (
    <div className="dashboard-layout">
      <Sidebar
        abierto={sidebarAbierto}
        onCerrar={() => setSidebarAbierto(false)}
      />
      {sidebarAbierto && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarAbierto(false)}
          aria-hidden="true"
        />
      )}
      <div className="dashboard-contenido">
        <Topbar
          sidebarAbierto={sidebarAbierto}
          onToggleSidebar={() => setSidebarAbierto((prev) => !prev)}
        />
        <main className="dashboard-main">
          <div className="dashboard-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
