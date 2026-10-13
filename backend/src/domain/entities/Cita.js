'use strict';

const EstadoCita = require('../value-objects/EstadoCita');

class Cita {
  constructor({
    id,
    uuid_publico,
    paciente_id,
    medico_id,
    consultorio_id,
    fecha_hora,
    duracion_minutos = 30,
    fecha_fin,
    estado_id = 1,
    motivo,
    notas,
    created_at,
    updated_at
  }) {
    this.id = id;
    this.uuid_publico = uuid_publico;
    this.paciente_id = paciente_id;
    this.medico_id = medico_id;
    this.consultorio_id = consultorio_id;
    this.fecha_hora = fecha_hora;
    this.duracion_minutos = duracion_minutos;
    this.fecha_fin = fecha_fin;
    this.estado_id = estado_id;
    this.motivo = motivo;
    this.notas = notas;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  static fromRow(row) {
    return new Cita(row);
  }

  get estado() {
    return new EstadoCita(this.estado_id);
  }

  // RN-076: pendiente, confirmada o reagendada bloquean el horario
  esVigente() {
    return this.estado.esVigente();
  }

  // RN-071: duración entre 10 y 240 minutos
  duracionValida() {
    const duracion = Number(this.duracion_minutos);
    return Number.isInteger(duracion) && duracion >= 10 && duracion <= 240;
  }

  // RN-073: no se agendan citas en el pasado 🔶
  esFutura() {
    return new Date(this.fecha_hora).getTime() > Date.now();
  }

  // Espejo del trigger trg_citas_fecha_fin: fecha_fin = fecha_hora + duración
  calcularFechaFin() {
    const inicio = new Date(this.fecha_hora);
    return new Date(inicio.getTime() + Number(this.duracion_minutos) * 60000);
  }

  rango() {
    const fin = this.fecha_fin ? new Date(this.fecha_fin) : this.calcularFechaFin();
    return { inicio: new Date(this.fecha_hora), fin };
  }

  // RN-074 / RN-078: dos citas vigentes del mismo médico o paciente no se traslapan
  seSolapa(otra) {
    if (!(otra instanceof Cita)) return false;
    if (this.medico_id !== otra.medico_id) return false;
    if (!this.esVigente() || !otra.esVigente()) return false;
    const uno = this.rango();
    const dos = otra.rango();
    return uno.inicio < dos.fin && dos.inicio < uno.fin;
  }

  // RN-080: solo las transiciones permitidas (delega al value object)
  puedeTransicionarA(nuevo) {
    return this.estado.puedeTransicionarA(nuevo);
  }

  // RN-086: plazo mínimo de anticipación para cancelar o reagendar 🔶
  fueraDePlazoCancelacion(minimoHoras = 2) {
    const milisegundos = minimoHoras * 60 * 60 * 1000;
    return new Date(this.fecha_hora).getTime() - Date.now() < milisegundos;
  }
}

module.exports = Cita;
