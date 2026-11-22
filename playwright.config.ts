import { defineConfig, devices } from '@playwright/test';

// A fixed, uncommon port (never 3000, so a running dev server is left alone). Kept deterministic
// because this file is re-evaluated by worker processes. The server listens on loopback only.
const port = Number(process.env.E2E_PORT) || 3187;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx e2e/server.ts',
    url: `${baseURL}/api/auth/me`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Lets e2e/server.ts delete its temp data folder on Linux (Windows always kills the process).
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      PORT: String(port),
      FLEETDIAG_HOST: '127.0.0.1',
      // Stops the Vite HMR websocket (port 24678) clashing with a running dev server.
      DISABLE_HMR: 'true',
      SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      OTP_DEMO_MODE: 'true',
      GEMINI_API_KEY: '', // never call the real AI from the smoke test
      // Same fixed passwords as vitest.config.ts, so the test does not depend on a local .env
      FLEETDIAG_PASSWORD_DEVELOPER: 'Test-developer-1',
      FLEETDIAG_PASSWORD_FLEET_DIRECTOR: 'Test-director-1',
      FLEETDIAG_PASSWORD_FLEET_MANAGER: 'Test-manager-1',
      FLEETDIAG_PASSWORD_TECHNICIAN: 'Test-technician-1',
      FLEETDIAG_PASSWORD_DISPATCHER: 'Test-dispatcher-1',
    },
  },
});
