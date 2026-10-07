'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../../infrastructure/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_pruebas';

async function registrar(req, res) {
  const { nombre, usuario, password, rol } = req.body;

  if (!nombre || !usuario || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios (nombre, usuario, password)' });
  }

  try {
    const existe = await db.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El usuario ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO usuarios (nombre, usuario, password, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, usuario, rol, creado_en`,
      [nombre, usuario, passwordHash, rol || 'paciente']
    );

    return res.status(201).json({ ok: true, mensaje: 'Usuario registrado correctamente', usuario: result.rows[0] });
  } catch (error) {
    console.error('[Auth] Error en registro:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al conectar o registrar en la base de datos', error: error.message });
  }
}

async function login(req, res) {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Faltan usuario o contraseña' });
  }

  try {
    const result = await db.query(
      'SELECT id, nombre, usuario, password, rol FROM usuarios WHERE usuario = $1',
      [usuario]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      ok: true,
      mensaje: 'Login y conexión a la base de datos exitosos',
      token,
      usuario: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol }
    });
  } catch (error) {
    console.error('[Auth] Error en login:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al conectar a la base de datos', error: error.message });
  }
}

module.exports = { registrar, login };