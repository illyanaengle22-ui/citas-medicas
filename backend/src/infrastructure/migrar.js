'use strict';

// Aplica las migraciones SQL de backend/migrations en orden.
//
// Uso:
//   npm run db:migrate              # aplica las pendientes
//   npm run db:migrate -- --baseline  # marca las existentes como aplicadas
//                                      (para una base que ya estaba migrada
//                                       antes de existir schema_migrations)
//
// Cada archivo se ejecuta dentro de una transacción junto con el registro en
// schema_migrations, así que una migración fallida no queda a medias ni se
// marca como aplicada. Los `BEGIN;`/`COMMIT;` propios de los archivos se
// eliminan para no anidar transacciones.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db');

const DIR_MIGRACIONES = path.join(__dirname, '..', '..', 'migrations');

function quitarTransacciones(sql) {
  return sql
    .replace(/^[ \t]*BEGIN;[ \t]*$/gm, '')
    .replace(/^[ \t]*COMMIT;[ \t]*$/gm, '');
}

async function main() {
  const baseline = process.argv.includes('--baseline');

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const archivos = fs.readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (archivos.length === 0) {
    console.log('No hay migraciones en', DIR_MIGRACIONES);
    return;
  }

  const { rows } = await db.query('SELECT version FROM schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.version));

  // Protección para bases creadas antes de que existiera schema_migrations:
  // si ya hay tablas de la app pero no hay registros, no re-aplicamos 001.
  const { rows: tablas } = await db.query(
    `SELECT to_regclass('public.usuarios') AS usuarios`
  );
  if (!baseline && tablas[0]?.usuarios && aplicadas.size === 0) {
    console.error('⚠️  La base ya tiene la tabla "usuarios" pero no tiene registros en schema_migrations.');
    console.error('   Si esta base ya fue migrada, ejecuta una vez:');
    console.error('     npm run db:migrate -- --baseline');
    console.error('   Si es una base nueva, elimínala/crea otra y vuelve a intentar.');
    process.exit(2);
  }

  if (baseline) {
    let marcadas = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      await db.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
        [archivo]
      );
      marcadas += 1;
    }
    console.log(`✅ Baseline: ${marcadas} migración(es) marcada(s) como aplicadas.`);
    return;
  }

  let nuevas = 0;
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`· ${archivo} (ya aplicada)`);
      continue;
    }

    const sql = quitarTransacciones(
      fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8')
    );

    console.log(`→ aplicando ${archivo}…`);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      nuevas += 1;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignorar */ }
      throw new Error(`Falló ${archivo}: ${error.message}`);
    } finally {
      client.release();
    }
  }

  console.log(nuevas > 0
    ? `✅ ${nuevas} migración(es) aplicada(s).`
    : '✅ La base de datos ya está al día.');
}

main()
  .catch((error) => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await db.close(); } catch (_) { /* ignorar */ }
  });
