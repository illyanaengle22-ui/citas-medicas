'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

let instance = null;

function resolverHost() {
  const host = process.env.DB_HOST;
  if (host !== 'windows') return host || 'localhost';
  try {
    const { execSync } = require('child_process');
    const route = execSync("ip route | grep default | awk '{print $3}'").toString().trim();
    if (route) {
      console.log('[DB] Host Windows resuelto (ip route):', route);
      return route;
    }
  } catch (err) {
    console.warn('[DB] ip route falló:', err.message);
  }
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+([\d.]+)/);
    if (match) {
      console.log('[DB] Host Windows resuelto (resolv.conf):', match[1]);
      return match[1];
    }
  } catch (err) {
    console.warn('[DB] resolv.conf falló:', err.message);
  }
  return 'localhost';
}

class Database {
  constructor() {
    if (instance) return instance;
    this.pool = new Pool({
      host:     resolverHost(),
      port:     parseInt(process.env.DB_PORT, 10) || 5432,
      user:     process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'nomina5M',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    this.pool.on('error', (err) => console.error('[DB] Error:', err.message));
    instance = this;
  }

  async query(text, params) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${Date.now() - start}ms → ${text.replace(/\s+/g, ' ').trim()}`);
    }
    return res;
  }

  async getClient() { return this.pool.connect(); }
  async ping() {
    const { rows } = await this.query('SELECT NOW() AS now');
    return rows[0].now;
  }
  async close() { await this.pool.end(); instance = null; }
}

module.exports = new Database();

if (require.main === module && process.argv.includes('--test')) {
  (async () => {
    const db = module.exports;
    try {
      console.log('[TEST] Conectando a PostgreSQL...');
      const now = await db.ping();
      console.log('[TEST] ✅ Conexión OK. Hora:', now);
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('[TEST] ❌ Falló:', err.message);
      process.exit(1);
    }
  })();
}
