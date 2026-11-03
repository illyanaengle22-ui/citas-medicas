'use strict';

// RN-028: los secretos no deben tener valores por defecto en el código.
// Si falta JWT_SECRET, el proceso debe fallar al arrancar en vez de firmar
// tokens con una clave conocida públicamente.
function requerido(nombre) {
  const valor = process.env[nombre];
  if (!valor || !String(valor).trim()) {
    throw new Error(`[Config] Falta la variable de entorno obligatoria ${nombre}`);
  }
  return valor;
}

const JWT_SECRET = requerido('JWT_SECRET');

module.exports = { JWT_SECRET };
