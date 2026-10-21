'use strict';
const db = require('./src/infrastructure/db');
(async () => {
  try {
    const r = await db.query(
      `SELECT id, email, estado_id, deleted_at,
              (SELECT clave FROM estados_cuenta WHERE id = u.estado_id) AS estado_clave
       FROM usuarios u WHERE email = 'testdel_debug@test.com' ORDER BY id`
    );
    console.log('ROWS:', JSON.stringify(r.rows, null, 2));
    await db.close();
  } catch(e) { console.error('ERROR:', e.message); process.exit(1); }
})();
