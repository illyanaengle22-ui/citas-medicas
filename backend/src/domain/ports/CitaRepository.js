'use strict';

class CitaRepository {
  async crear(cita) {
    throw new Error('Método no implementado');
  }

  async obtenerPorId(id) {
    throw new Error('Método no implementado');
  }

  // RN-009: el uuid_publico es el identificador expuesto en API y Telegram
  async obtenerPorUuid(uuid_publico) {
    throw new Error('Método no implementado');
  }

  // Visibilidad por rol (RN-053 / matriz de permisos): admin ve todas,
  // médico y paciente solo las suyas según los filtros que se pasen
  async listar({ paciente_id = null, medico_id = null, estado = null, fecha_desde = null, fecha_hasta = null, page = 1, limit = 10 } = {}) {
    throw new Error('Método no implementado');
  }

  // RN-080: la transición se valida en domain antes de llegar aquí;
  // el trigger trg_citas_historial registra el cambio en historial_estados_cita (RN-090)
  async cambiarEstado(id, estado_id) {
    throw new Error('Método no implementado');
  }

  // Usado por reagendar (RN-083 / RN-084): mueve fecha_hora o duración
  async actualizar(id, cambios) {
    throw new Error('Método no implementado');
  }

  // RN-075: pre-check de traslape para responder "El horario ya fue ocupado"
  // en vez de un error técnico (la BD lo garantiza con EXCLUDE USING gist, RN-074)
  async buscarTraslape({ medico_id, fecha_hora, fecha_fin, excluirId = null }) {
    throw new Error('Método no implementado');
  }

  // RN-090: historial de estados, de solo inserción (RN-092)
  async listarHistorial(cita_id) {
    throw new Error('Método no implementado');
  }

  // Pacientes distintos de un médico (vista "Mis pacientes")
  async pacientesDelMedico(medico_id) {
    throw new Error('Método no implementado');
  }
}

module.exports = CitaRepository;
