'use strict';

// RN-062 / RN-074: la BD garantiza el traslape con EXCLUDE USING gist.
// Cuando ese constraint dispara (código PostgreSQL 23P01) traducimos el error
// técnico a un mensaje claro para el frontend, en vez de un 500 genérico.
class TraslapeError extends Error {
  constructor(mensaje = 'El horario ya fue ocupado por otra cita') {
    super(mensaje);
    this.name = 'TraslapeError';
    this.code = '23P01';
  }
}

module.exports = TraslapeError;
