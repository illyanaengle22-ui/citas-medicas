// TODO: Reemplazar con datos reales cuando existan los endpoints de estadísticas
export const mockStats = {
  usuariosTotales: 156,
  usuariosPendientes: 8,
  medicos: 24,
  citasHoy: 12,
};

export const mockUsuariosPendientes = [
  { id: 1, nombre: 'María García', email: 'maria@email.com', rol: 'Paciente', fecha: '2026-10-10' },
  { id: 2, nombre: 'Carlos López', email: 'carlos@email.com', rol: 'Médico', fecha: '2026-10-09' },
  { id: 3, nombre: 'Ana Martínez', email: 'ana@email.com', rol: 'Paciente', fecha: '2026-10-08' },
];

export const mockUltimasCitas = [
  { id: 1, paciente: 'Juan Pérez', medico: 'Dr. Ramírez', fecha: '2026-10-12 09:00', estado: 'confirmada' },
  { id: 2, paciente: 'Laura Sánchez', medico: 'Dra. Torres', fecha: '2026-10-12 10:30', estado: 'pendiente' },
  { id: 3, paciente: 'Pedro Gómez', medico: 'Dr. Morales', fecha: '2026-10-11 16:00', estado: 'completada' },
  { id: 4, paciente: 'Sofía Ruiz', medico: 'Dra. Vargas', fecha: '2026-10-11 11:00', estado: 'cancelada' },
];
