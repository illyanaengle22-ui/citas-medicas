'use strict';

function aMinutos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) {
    return valor.getHours() * 60 + valor.getMinutes();
  }
  const [h, m] = String(valor).split(':');
  return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
}

class Horario {
  constructor({ id, medico_id, consultorio_id, dia_semana, hora_inicio, hora_fin, activo = true, created_at, updated_at }) {
    this.id = id;
    this.medico_id = medico_id;
    this.consultorio_id = consultorio_id;
    this.dia_semana = dia_semana;
    this.hora_inicio = hora_inicio;
    this.hora_fin = hora_fin;
    this.activo = activo;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  static fromRow(row) {
    return new Horario(row);
  }

  // RN-060: día de la semana ISO 8601 (1 = lunes ... 7 = domingo)
  validar() {
    if (!Number.isInteger(Number(this.dia_semana)) || this.dia_semana < 1 || this.dia_semana > 7) {
      throw new Error('Día de la semana inválido, debe ser 1 (lunes) a 7 (domingo) [RN-060]');
    }
    const inicio = aMinutos(this.hora_inicio);
    const fin = aMinutos(this.hora_fin);
    if (inicio === null || fin === null) {
      throw new Error('hora_inicio y hora_fin son requeridas [RN-060]');
    }
    // RN-061: la hora de fin debe ser posterior a la de inicio
    if (fin <= inicio) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio [RN-061]');
    }
    return true;
  }

  esActivo() {
    return this.activo === true;
  }

  duracionMinutos() {
    return aMinutos(this.hora_fin) - aMinutos(this.hora_inicio);
  }

  // RN-062: mismo médico, mismo día y rangos que se traslapan
  seSolapa(otro) {
    if (!(otro instanceof Horario)) return false;
    if (this.medico_id !== otro.medico_id) return false;
    if (Number(this.dia_semana) !== Number(otro.dia_semana)) return false;
    const iniUno = aMinutos(this.hora_inicio);
    const finUno = aMinutos(this.hora_fin);
    const iniDos = aMinutos(otro.hora_inicio);
    const finDos = aMinutos(otro.hora_fin);
    return iniUno < finDos && iniDos < finUno;
  }

  // RN-072: la cita debe caer dentro del horario [inicio, fin)
  contieneHora(hora) {
    const minuto = aMinutos(hora);
    if (minuto === null) return false;
    return minuto >= aMinutos(this.hora_inicio) && minuto < aMinutos(this.hora_fin);
  }
}

module.exports = Horario;
