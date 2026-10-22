'use strict';

class ObtenerResumenMedico {
  constructor(dashboardRepository) {
    this.repo = dashboardRepository;
  }

  async execute(usuarioId) {
    const [
      totales,
      proximasCitas,
      agendaHoy,
      citasSemana,
    ] = await Promise.all([
      this.repo.obtenerTotalesMedico(usuarioId),
      this.repo.obtenerProximasCitasMedico(usuarioId),
      this.repo.obtenerAgendaHoyMedico(usuarioId),
      this.repo.obtenerCitasSemanaMedico(usuarioId),
    ]);

    return {
      totales,
      proximaCita: proximasCitas[0] ?? null,
      proximasCitas,
      agendaHoy,
      citasSemana,
    };
  }
}

module.exports = ObtenerResumenMedico;
