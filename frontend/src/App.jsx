import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './paginas/Login';
import Register from './paginas/Register';
import Landing from './paginas/Landing';

// Code-splitting: cada módulo se descarga bajo demanda. Esto aísla recharts
// (dashboards) y las páginas de gestión en chunks propios en lugar de un
// único bundle monolítico.
const DashboardHome = lazy(() => import('./paginas/DashboardHome'));
const AdminEspecialidades = lazy(() => import('./paginas/admin/AdminEspecialidades'));
const AdminUsuarios = lazy(() => import('./paginas/admin/AdminUsuarios'));
const AdminConsultorios = lazy(() => import('./paginas/admin/AdminConsultorios'));
const AdminMedicos = lazy(() => import('./paginas/admin/AdminMedicos'));
const AdminHorarios = lazy(() => import('./paginas/admin/AdminHorarios'));
const AdminCitas = lazy(() => import('./paginas/admin/AdminCitas'));
const AdminCalendario = lazy(() => import('./paginas/admin/AdminCalendario'));
const DashboardMedico = lazy(() => import('./paginas/medico/DashboardMedico'));
const MiAgenda = lazy(() => import('./paginas/medico/MiAgenda'));
const MisHorarios = lazy(() => import('./paginas/medico/MisHorarios'));
const MisPacientes = lazy(() => import('./paginas/medico/MisPacientes'));
const DashboardPaciente = lazy(() => import('./paginas/paciente/DashboardPaciente'));
const AgendarCita = lazy(() => import('./paginas/paciente/AgendarCita'));
const MisCitas = lazy(() => import('./paginas/paciente/MisCitas'));
const MiHistorial = lazy(() => import('./paginas/paciente/MiHistorial'));

function CargandoRuta() {
  return (
    <div className="crud-cargando">
      <div className="spinner" />
      <span>Cargando...</span>
    </div>
  );
}

function RedireccionRaiz() {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  switch (user.rol_id) {
    case 1: return <Navigate to="/admin" replace />;
    case 2: return <Navigate to="/medico" replace />;
    case 3: return <Navigate to="/paciente" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<CargandoRuta />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<RedireccionRaiz />} />
            <Route path="/admin" element={
              <RutaProtegida roles={[1]}>
                <DashboardLayout />
              </RutaProtegida>
            }>
              <Route index element={<DashboardHome />} />
              <Route path="especialidades" element={<AdminEspecialidades />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="consultorios" element={<AdminConsultorios />} />
              <Route path="medicos" element={<AdminMedicos />} />
              <Route path="horarios" element={<AdminHorarios />} />
              <Route path="citas" element={<AdminCitas />} />
              <Route path="calendario" element={<AdminCalendario />} />
            </Route>
            <Route path="/medico" element={
              <RutaProtegida roles={[2]}>
                <DashboardLayout />
              </RutaProtegida>
            }>
              <Route index element={<DashboardMedico />} />
              <Route path="agenda" element={<MiAgenda />} />
              <Route path="horarios" element={<MisHorarios />} />
              <Route path="pacientes" element={<MisPacientes />} />
            </Route>
            <Route path="/paciente" element={
              <RutaProtegida roles={[3]}>
                <DashboardLayout />
              </RutaProtegida>
            }>
              <Route index element={<DashboardPaciente />} />
              <Route path="agendar" element={<AgendarCita />} />
              <Route path="citas" element={<MisCitas />} />
              <Route path="historial" element={<MiHistorial />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
