'use strict';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function contarDias(fechaInicio, fechaFin) {
  const inicio = Date.parse(`${fechaInicio}T00:00:00Z`);
  const fin = Date.parse(`${fechaFin}T00:00:00Z`);
  return Math.round((fin - inicio) / MS_POR_DIA) + 1;
}

class ObtenerResumenAdmin {
  constructor(dashboardRepository) {
    this.repo = dashboardRepository;
  }

  async execute({ fechaInicio, fechaFin } = {}) {
    // Hasta 31 días se agrupa por día (Hoy, 7d, Este mes, 30d).
    // Con más de 31 días (rangos personalizados largos) se agrupa por mes.
    const dias = contarDias(fechaInicio, fechaFin);
    const agrupacion = dias > 31 ? 'mes' : 'dia';

    const [
      totales,
      usuariosPorRol,
      usuariosPorEstado,
      registrosPorMes,
      medicosPorEspecialidad,
      medicosPorConsultorio,
      citasPorEstado,
      citasPorDia,
      porcentajes,
      duracionPromedio,
    ] = await Promise.all([
      this.repo.obtenerTotales(fechaInicio, fechaFin),
      this.repo.obtenerUsuariosPorRol(),
      this.repo.obtenerUsuariosPorEstado(),
      this.repo.obtenerRegistrosPorMes(fechaInicio, fechaFin, agrupacion),
      this.repo.obtenerMedicosPorEspecialidad(),
      this.repo.obtenerMedicosPorConsultorio(),
      this.repo.obtenerCitasPorEstado(fechaInicio, fechaFin),
      this.repo.obtenerCitasPorDia(fechaInicio, fechaFin),
      this.repo.obtenerPorcentajes(fechaInicio, fechaFin),
      this.repo.obtenerDuracionPromedio(fechaInicio, fechaFin),
    ]);

    return {
      rango: {
        fechaInicio,
        fechaFin,
        dias,
        agrupacionRegistros: agrupacion,
      },
      totales,
      usuariosPorRol,
      usuariosPorEstado,
      registrosPorMes,
      medicosPorEspecialidad,
      medicosPorConsultorio,
      citasPorEstado,
      citasPorDia,
      porcentajes,
      duracionPromedioCitas: duracionPromedio.duracionPromedioCitas,
      duracionPromedioTexto: duracionPromedio.duracionPromedioTexto,
    };
  }
}

module.exports = ObtenerResumenAdmin;
