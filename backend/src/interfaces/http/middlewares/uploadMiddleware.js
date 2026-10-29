'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// UPLOADS_DIR permite usar una ruta absoluta en producción (bundle/PM2).
// En desarrollo cae a backend/uploads.
const UPLOADS_ROOT = process.env.UPLOADS_DIR ||
  path.join(__dirname, '..', '..', '..', '..', 'uploads');

const DIR_PERFILES = path.join(UPLOADS_ROOT, 'perfiles');
const DIR_MEDICOS  = path.join(UPLOADS_ROOT, 'medicos');

for (const dir of [DIR_PERFILES, DIR_MEDICOS]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// La extensión se deriva del MIME real, no del nombre que manda el cliente.
const EXT_POR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function crearStorage(destino, prefijo) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destino),
    filename: (_req, file, cb) => {
      const ext = EXT_POR_MIME[file.mimetype] || '.img';
      cb(null, `${prefijo}-${randomUUID()}${ext}`);
    },
  });
}

function fileFilter(_req, file, cb) {
  if (EXT_POR_MIME[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF'), false);
  }
}

function crearUpload(storage) {
  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  });
}

const uploadPerfil = crearUpload(crearStorage(DIR_PERFILES, 'perfil'));
const uploadMedico = crearUpload(crearStorage(DIR_MEDICOS, 'medico'));

/**
 * Envuelve upload.single() para responder 400 con un mensaje claro en lugar
 * de dejar que los errores de multer lleguen al manejador global (500).
 */
function crearSingle(upload, field) {
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

const single = (field) => crearSingle(uploadPerfil, field);
const singleMedico = (field) => crearSingle(uploadMedico, field);

module.exports = { upload: uploadPerfil, single, singleMedico };
