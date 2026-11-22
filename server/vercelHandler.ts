/**
 * Vercel serverless entry point. Bundled by scripts/build-vercel.mjs into
 * .vercel/output/functions/api.func/index.cjs.
 *
 * All /api/* requests are routed to this one function. The routing layer passes the
 * original sub-path as `__path` so Express sees the same URL it would locally.
 */
import type { IncomingMessage, ServerResponse } from "http";
import app from "../server";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const sub = url.searchParams.get("__path");
    if (sub !== null) {
      url.searchParams.delete("__path");
      const qs = url.searchParams.toString();
      req.url = `/api/${sub.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
    }
  } catch {
    // leave req.url untouched
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
