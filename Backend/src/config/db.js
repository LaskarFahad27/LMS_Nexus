import pg from 'pg';
import { env } from './loadEnv.js';

const { Pool } = pg;

function resolveHost(host) {
  // Shared Postgres often has no pg_hba rule for IPv6 ::1 (what "localhost" becomes).
  if (!host || host === 'localhost' || host === '::1') return '127.0.0.1';
  return host;
}

export function getDbConfig(database) {
  const ssl =
    env('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : undefined;

  if (env('DATABASE_URL', '')) {
    return {
      connectionString: env('DATABASE_URL', ''),
      ssl: env('DB_SSL', 'false') === 'false' ? undefined : { rejectUnauthorized: false },
    };
  }

  return {
    host: resolveHost(env('DB_HOST', '127.0.0.1')),
    port: Number(env('DB_PORT', '5432')),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', ''),
    database: database || env('DB_NAME', 'lms_nexus'),
    ssl,
  };
}

export const pool = new Pool(getDbConfig());

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
