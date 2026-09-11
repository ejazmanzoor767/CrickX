import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'package.json', 'package-lock.json', 'firebase.json', 'render.yaml',
  'apps/web/next.config.js', 'apps/web/.env.example', 'apps/api/.env.example',
  'contracts/CRXContestPool.sol', 'contracts/scripts/deploy.cjs',
  '.github/workflows/firebase-hosting.yml'
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) { console.error('Missing deployment files:', missing.join(', ')); process.exit(1); }
console.log('CrickX deployment package looks structurally ready.');
console.log('Populate secrets in Render/GitHub; never commit .env files.');
