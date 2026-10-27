'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Destino: backend/uploads/perfiles (el mismo que sirve server.js en /uploads).
const DIR_PERFILES = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'perfiles');
if (!fs.existsSync(DIR_PERFILES)) {
  fs.mkdirSync(DIR_PERFILES, { recursive: true });
}

// La extensión se deriva del MIME real, no del nombre que manda el cliente.
const EXT_POR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DIR_PERFILES),
  filename: (_req, file, cb) => {
    const ext = EXT_POR_MIME[file.mimetype] || '.img';
    cb(null, `perfil-${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (EXT_POR_MIME[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
});

/**
 * Envuelve upload.single() para responder 400 con un mensaje claro en lugar
 * de dejar que los errores de multer lleguen al manejador global (500).
 */
function single(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, mensaje: 'La imagen no puede superar los 5 MB' });
        }
        return res.status(400).json({ ok: false, mensaje: 'Error al subir la imagen' });
      }

      return res.status(400).json({ ok: false, mensaje: err.message || 'Archivo no válido' });
    });
  };
}

module.exports = { upload, single };
