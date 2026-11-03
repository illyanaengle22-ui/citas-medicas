'use strict';

// RN-107: los endpoints que consume n8n se autentican con un secreto
// compartido en la cabecera x-webhook-secret, no con JWT de usuario.
// Compartido por el webhook de respuesta y los endpoints de Telegram.
function secretValido(req) {
  const esperado = process.env.N8N_WEBHOOK_SECRET;
  // RN-028: sin secreto configurado se rechaza la petición. Nunca se debe
  // aceptar un webhook solo porque falta la variable de entorno.
  if (!esperado) return false;
  return req.headers['x-webhook-secret'] === esperado;
}

module.exports = { secretValido };
