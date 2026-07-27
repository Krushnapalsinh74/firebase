import fs from 'fs';
import path from 'path';

const lockPath = path.resolve('artifacts', 'api-server', 'dist', 'package-lock.json');
const envPath = path.resolve('artifacts', 'api-server', 'dist', '.env');

fs.rmSync(lockPath, { force: true });
fs.writeFileSync(envPath, 'FIRESTORE_DATABASE_ID=kp73');

console.log('Predeploy steps for api-server completed.');
