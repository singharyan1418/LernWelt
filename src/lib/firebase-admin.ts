import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = fs.existsSync(firebaseConfigPath)
  ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'))
  : {};

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export const adminAuth = getAuth();
