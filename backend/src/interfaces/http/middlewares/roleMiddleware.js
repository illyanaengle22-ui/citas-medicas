'use strict';

function roleMiddleware(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ ok: false, mensaje: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol_id)) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para acceder a este recurso' });
    }

    next();
  };
}

module.exports = roleMiddleware;
