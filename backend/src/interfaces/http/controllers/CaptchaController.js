'use strict';

const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');

const CAPTCHA_EXPIRATION_MS = 2 * 60 * 1000; // 2 minutos

const captchas = new Map();

setInterval(() => {
  const ahora = Date.now();
  for (const [id, data] of captchas.entries()) {
    if (data.expiraEn < ahora) {
      captchas.delete(id);
    }
  }
}, 60 * 1000).unref();

function generarCaptcha(req, res) {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });

  const captchaId = crypto.randomUUID();
  captchas.set(captchaId, {
    texto: captcha.text.toLowerCase(),
    expiraEn: Date.now() + CAPTCHA_EXPIRATION_MS
  });

  res.json({
    ok: true,
    mensaje: 'Captcha generado',
    data: {
      captchaId,
      svg: captcha.data
    }
  });
}

function validarCaptcha(captchaId, texto) {
  if (!captchaId || !texto) {
    return { valido: false, mensaje: 'captchaId y texto son requeridos' };
  }

  const data = captchas.get(captchaId);
  if (!data) {
    return { valido: false, mensaje: 'Captcha no encontrado o expirado' };
  }

  captchas.delete(captchaId);

  if (data.expiraEn < Date.now()) {
    return { valido: false, mensaje: 'Captcha expirado' };
  }

  if (data.texto !== texto.toLowerCase()) {
    return { valido: false, mensaje: 'Texto del captcha incorrecto' };
  }

  return { valido: true };
}

module.exports = { generarCaptcha, validarCaptcha };
