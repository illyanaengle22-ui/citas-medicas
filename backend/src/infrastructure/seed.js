'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  try {
    const email = 'admin@clinica.com';
    const password = 'admin123';
    const nombre = 'Administrador';

    const { rows } = await db.query(
      'SELECT id FROM usuarios WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (rows.length > 0) {
      console.log('[SEED] Usuario admin ya existe');
      await db.close();
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, estado_id)
       VALUES ($1, $2, $3, 1, 2)`,
      [nombre, email, passwordHash]
    );

    console.log('[SEED] Usuario admin creado:');
    console.log('  Email:    admin@clinica.com');
    console.log('  Password: admin123');
    await db.close();
  } catch (err) {
    console.error('[SEED] Error:', err.message);
    process.exit(1);
  }
}

seed();
