'use strict';

class ObtenerResumenPaciente {
  constructor(dashboardRepository) {
    this.repo = dashboardRepository;
  }

  async execute(usuarioId) {
    const [
      totales,
      proximasCitas,
      doctorPrincipal,
      historialCitas,
    ] = await Promise.all([
      this.repo.obtenerTotalesPaciente(usuarioId),
      this.repo.obtenerProximasCitasPaciente(usuarioId),
      this.repo.obtenerMedicoPrincipalPaciente(usuarioId),
      this.repo.obtenerHistorialCitasPaciente(usuarioId),
    ]);

    return {
      citasProgramadas: totales.citasProgramadas,
      citasCompletadas: totales.citasCompletadas,
      doctorPrincipal,
      proximaCita: proximasCitas[0] ?? null,
      proximasCitas,
      historialCitas,
      // Se conserva `totales` para clientes que ya consumían este contrato.
      totales,
    };
  }
}

module.exports = ObtenerResumenPaciente;
