'use strict';

const rolesValidos = { 1: 'admin', 2: 'medico', 3: 'paciente' };

function roleMiddleware(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ ok: false, mensaje: 'No autenticado' });
    }

    // RN-113: autorización por clave ('admin', 'medico', 'paciente')
    const claveRol = rolesValidos[req.usuario.rol_id];

    if (!rolesPermitidos.includes(claveRol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para acceder a este recurso' });
    }

    next();
  };
}

module.exports = roleMiddleware;
