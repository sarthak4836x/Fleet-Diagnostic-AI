// Builds the app in Vercel's Build Output API v3 format:
//   .vercel/output/static/            -> the Vite frontend (dist/)
//   .vercel/output/functions/api.func -> the Express API bundled into one CommonJS file
//   .vercel/output/config.json        -> routing (static files, /api/* -> function, SPA fallback)
// Run after `vite build` (see the "build:vercel" npm script).
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const root = process.cwd();
const out = path.join(root, ".vercel", "output");
const funcDir = path.join(out, "functions", "api.func");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(funcDir, { recursive: true });

// 1. Static frontend
fs.cpSync(path.join(root, "dist"), path.join(out, "static"), { recursive: true });

// 2. API function (all dependencies bundled so the function is self-contained)
await build({
  entryPoints: [path.join(root, "server", "vercelHandler.ts")],
  outfile: path.join(funcDir, "index.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false,
  // Vite is only used by the local dev server and is imported lazily; never on Vercel.
  external: ["vite"],
  logLevel: "warning",
});

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.cjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: 30,
    },
    null,
    2
  )
);

// 3. Routing
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Security headers for every response (the API adds its own as well)
        {
          src: "^/(.*)$",
          headers: {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "SAMEORIGIN",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Permissions-Policy": "accelerometer=(), camera=(), microphone=(), payment=()",
          },
          continue: true,
        },
        // Browsers must always re-check the service worker, or phones would stay on an old version
        { src: "^/sw\\.js$", headers: { "cache-control": "public, max-age=0, must-revalidate" }, continue: true },
        // Long-lived caching for fingerprinted assets
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        // Serve real files from /static first
        { handle: "filesystem" },
        // Every API call goes to the Express function
        { src: "^/api/(.*)$", dest: "/api?__path=$1" },
        // Single-page app fallback
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);

console.log("[build-vercel] Wrote .vercel/output (static + api function)");
