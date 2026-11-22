// Launcher for the browser smoke test: gives the real server a throwaway data folder, then starts it.
// The folder is made here (once, in the server process), not in playwright.config.ts, which is
// re-evaluated by every worker.
import fs from 'fs';
import os from 'os';
import path from 'path';

// Never reach a real store: kvStore picks Upstash Redis whenever these are set (from the shell or
// .env) and memory on Vercel, both before it looks at FLEETDIAG_DATA_DIR. dotenv does not override
// variables that are already set, so empty values here also mask any in .env.
for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL']) {
  process.env[name] = '';
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetdiag-e2e-'));
process.env.FLEETDIAG_DATA_DIR = dataDir;

function removeDataDir() {
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // best effort: the OS temp folder is cleaned eventually anyway
  }
}
process.on('exit', removeDataDir);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => process.exit(0));
}

// Check the store before the server loads, so a wrong store is never seeded or written to.
// The server imports this same module instance.
const { kv } = await import('../server/kvStore.ts');
if (kv.kind !== 'file') {
  throw new Error(`[e2e] refusing to run: account store is "${kv.kind}", expected the throwaway file store`);
}
console.log(`[e2e] file store in ${dataDir}`);
await import('../server.ts');
