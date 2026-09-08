import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(root, 'dist-craftx');
const src = path.join(root, '..', 'deploy', 'craftx-lms.htaccess');

if (!fs.existsSync(destDir)) {
  console.warn('dist-craftx not found; skip .htaccess copy');
  process.exit(0);
}

fs.copyFileSync(src, path.join(destDir, '.htaccess'));
console.log('Copied CraftX .htaccess into Frontend/dist-craftx');
