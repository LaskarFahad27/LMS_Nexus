import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(backendRoot, '.env');

function applyParsed(parsed) {
  if (!parsed) return;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || String(process.env[key]).trim() === '') {
      process.env[key] = value;
    }
  }
}

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  applyParsed(result.parsed);
} else {
  console.warn(`No .env file found at ${envPath}`);
  dotenv.config();
}

export function env(name, fallback) {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return value;
}

export function logDbTarget() {
  const host = env('DB_HOST', '127.0.0.1');
  const user = env('DB_USER', 'postgres');
  const database = env('DB_NAME', 'lms_nexus');
  const ssl = env('DB_SSL', 'false');
  const hasPassword = Boolean(env('DB_PASSWORD', ''));
  console.log(
    `DB config: host=${host} user=${user} database=${database} ssl=${ssl} password=${hasPassword ? 'set' : 'MISSING'} env=${envPath}`
  );
}

export { backendRoot, envPath };
