import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig } from 'vitest/config';

// A fresh temp dir per run, so the backup replica (written under os.tmpdir()) never carries over between runs.
const runTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetdiag-test-'));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests run the server the way Vercel does: in-memory account store, no listen(), no Python,
    // backups in the OS temp dir, and X-Forwarded-For honoured (so each test can use its own IP).
    env: {
      TEMP: runTmp,
      TMP: runTmp,
      TMPDIR: runTmp,
      VERCEL: '1',
      NODE_ENV: 'test',
      GEMINI_API_KEY: '', // never call the real AI from tests
      SESSION_SECRET: 'test-secret-test-secret-test-secret-0123456789',
      OTP_DEMO_MODE: 'true',
      // Fixed passwords so the tests don't depend on a local .env
      FLEETDIAG_PASSWORD_DEVELOPER: 'Test-developer-1',
      FLEETDIAG_PASSWORD_FLEET_DIRECTOR: 'Test-director-1',
      FLEETDIAG_PASSWORD_FLEET_MANAGER: 'Test-manager-1',
      FLEETDIAG_PASSWORD_TECHNICIAN: 'Test-technician-1',
      FLEETDIAG_PASSWORD_DISPATCHER: 'Test-dispatcher-1',
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
