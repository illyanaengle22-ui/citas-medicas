'use strict';

// Validación compartida de ID según el tipo de columna (RN-111)
// smallint: 1 a 32767 | integer: 1 a 2147483647
function validarId(id, tipoColumna = 'smallint') {
  const num = Number(id);
  const max = tipoColumna === 'smallint' ? 32767 : 2147483647;
  if (!Number.isSafeInteger(num) || num <= 0 || num > max) return null;
  return num;
}

module.exports = validarId;
