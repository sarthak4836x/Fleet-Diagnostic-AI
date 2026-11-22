// RP1210 / J1939 read-only diagnostics routes. Mounted at /api/rp1210 in server.ts, behind the
// app-level apiAuthGate (session required) plus the developer_console permission.
// These routes never write to an ECM and never transmit bus messages.
import { Router } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { listVendors, readVendorIni } from "./ini";
import { loadRp1210 } from "./api";

const CONNECT_TIMEOUT_MS = 20000;

// Resolve this module's directory safely in BOTH runtimes:
//  - the bundled CommonJS function (Vercel / `npm start`) where __dirname exists, and
//  - native ESM dev (`tsx server.ts`) where only import.meta.url exists.
// Computed lazily (only the /connect route needs it) so nothing runs — and nothing throws — at
// import time. In the CJS bundle esbuild rewrites import.meta.url to "", but __dirname is defined
// there so that branch is never taken.
function moduleDir(): string {
  return typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
}

export function createRp1210Router(guards: import("express").RequestHandler[] = []): Router {
  const router = Router();
  router.use(...guards);

  router.get("/adapters", (_req, res) => {
    try {
      const vendors = listVendors().map((v) => readVendorIni(v));
      res.json({ vendors });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/versions", async (req, res) => {
    const vendor = String(req.query.vendor ?? "");
    if (!listVendors().includes(vendor)) return res.status(400).json({ error: "Unknown vendor." });
    try {
      res.json({ vendor, ...(await loadRp1210(vendor)).readVersion() });
    } catch (e) {
      res.status(500).json({ error: `Load/ReadVersion failed: ${(e as Error).message}` });
    }
  });

  router.post("/connect", (req, res) => {
    const CHILD = path.join(moduleDir(), "connectChild.ts");
    const { vendor, deviceId, protocol } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof vendor !== "string" || !listVendors().includes(vendor)) {
      return res.status(400).json({ ok: false, message: "Unknown vendor." });
    }
    const info = readVendorIni(vendor);
    const dev = Number(deviceId);
    if (!Number.isInteger(dev) || !info.deviceInfos.some((d) => d.deviceId === dev)) {
      return res.status(400).json({ ok: false, message: "Unknown deviceId for vendor." });
    }
    if (typeof protocol !== "string" || !info.protocolInfos.some((p) => p.protocolString === protocol)) {
      return res.status(400).json({ ok: false, message: "Unknown protocol for vendor." });
    }
    const child = spawn(process.execPath, [...process.execArgv, CHILD, vendor, String(dev), protocol], { windowsHide: true });
    let out = "";
    let err = "";
    let done = false;
    const finish = (status: number, body: object) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      res.status(status).json(body);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(504, { ok: false, message: "Connect attempt timed out." });
    }, CONNECT_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => finish(500, { ok: false, message: e.message }));
    child.on("close", (code) => {
      const line = out.split(/\r?\n/).find((l) => l.trim().startsWith("{"));
      if (code === 0 && line) {
        try {
          return finish(200, JSON.parse(line));
        } catch {
          /* fall through */
        }
      }
      const reason = err.split(/\r?\n/).find((l) => l.trim()) ?? "";
      finish(200, {
        ok: false,
        message: `Adapter driver failed (child exit ${code}); no RP1210 error code returned. ${reason.trim()}`.trim(),
      });
    });
  });

  return router;
}
