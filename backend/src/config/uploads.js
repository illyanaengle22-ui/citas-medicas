'use strict';

const path = require('path');
const fs = require('fs');

// Determina la raíz del proyecto backend sin depender del directorio de trabajo actual (cwd)
// En dev (src/): sube 2 niveles desde config/ (src/config -> backend)
// En bundle (dist/): sube 1 nivel desde dist/ (dist -> app)
function obtenerBaseDir() {
  if (fs.existsSync(path.resolve(__dirname, '..', 'package.json'))) {
    return path.resolve(__dirname, '..');
  }
  if (fs.existsSync(path.resolve(__dirname, '..', '..', 'package.json'))) {
    return path.resolve(__dirname, '..', '..');
  }
  return process.cwd();
}

const BASE_DIR = obtenerBaseDir();

function obtenerUploadsDir() {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir && path.isAbsolute(envDir)) {
    return envDir;
  }
  return path.resolve(BASE_DIR, envDir || 'uploads');
}

const UPLOADS_DIR = obtenerUploadsDir();
const DIR_PERFILES = path.join(UPLOADS_DIR, 'perfiles');
const DIR_MEDICOS  = path.join(UPLOADS_DIR, 'medicos');

function asegurarDirectoriosUploads() {
  for (const dir of [UPLOADS_DIR, DIR_PERFILES, DIR_MEDICOS]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = {
  UPLOADS_DIR,
  DIR_PERFILES,
  DIR_MEDICOS,
  asegurarDirectoriosUploads,
};
