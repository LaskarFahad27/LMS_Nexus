import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { env, logDbTarget } from '../config/loadEnv.js';
import { getDbConfig } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDatabase() {
  logDbTarget();

  const dbName = env('DB_NAME', 'lms_nexus');
  const dbUser = env('DB_USER', 'postgres');
  const canCreateDb =
    env('SKIP_DB_CREATE', '') !== 'true' &&
    !env('DATABASE_URL', '') &&
    dbUser === 'postgres';

  if (canCreateDb) {
    const adminPool = new pg.Pool(getDbConfig('postgres'));
    try {
      const exists = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (exists.rowCount === 0) {
        await adminPool.query(`CREATE DATABASE ${dbName}`);
        console.log(`Database "${dbName}" created.`);
      } else {
        console.log(`Database "${dbName}" already exists.`);
      }
    } catch (err) {
      console.warn('Skipping CREATE DATABASE (normal on shared hosting):', err.message);
    } finally {
      await adminPool.end();
    }
  } else {
    console.log(`Using existing database "${dbName}" (shared hosting / SKIP_DB_CREATE).`);
  }

  const pool = new pg.Pool(getDbConfig(dbName));

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Schema applied successfully.');
  } finally {
    await pool.end();
  }
}

initDatabase().catch((err) => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});
