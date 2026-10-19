'use strict';

// Validación compartida de ID según el tipo de columna (RN-111)
// smallint: 1 a 32767 | integer: 1 a 2147483647 | bigint: 1 a Number.MAX_SAFE_INTEGER
const MAXIMOS = {
  smallint: 32767,
  integer: 2147483647,
  // BIGINT llega a 9223372036854775807, pero JS no puede representarlo con
  // seguridad: se limita a Number.MAX_SAFE_INTEGER (9007199254740991).
  bigint: Number.MAX_SAFE_INTEGER,
};

function validarId(id, tipoColumna = 'smallint') {
  const max = MAXIMOS[tipoColumna] ?? MAXIMOS.smallint;
  const num = Number(id);
  if (!Number.isSafeInteger(num) || num <= 0 || num > max) return null;
  return num;
}

module.exports = validarId;
