import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './paginas/Login';
import Register from './paginas/Register';
import DashboardHome from './paginas/DashboardHome';
import AdminEspecialidades from './paginas/admin/AdminEspecialidades';
import AdminUsuarios from './paginas/admin/AdminUsuarios';
import AdminConsultorios from './paginas/admin/AdminConsultorios';
import AdminMedicos from './paginas/admin/AdminMedicos';
import DashboardMedico from './paginas/medico/DashboardMedico';
import DashboardPaciente from './paginas/paciente/DashboardPaciente';

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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RedireccionRaiz />} />
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
          </Route>
          <Route path="/medico" element={
            <RutaProtegida roles={[2]}>
              <DashboardLayout />
            </RutaProtegida>
          }>
            <Route index element={<DashboardMedico />} />
          </Route>
          <Route path="/paciente" element={
            <RutaProtegida roles={[3]}>
              <DashboardLayout />
            </RutaProtegida>
          }>
            <Route index element={<DashboardPaciente />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
