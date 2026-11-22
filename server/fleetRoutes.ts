/**
 * Developer-only fleet management: list, create (with its first owner), suspend/reactivate,
 * and switch which fleet the developer is viewing.
 */
import type { Express, RequestHandler, Request, Response } from "express";
import {
  AccountError,
  countUsersByFleet,
  createAccount,
  isEmailTaken,
  isValidAccountEmail,
  setActiveFleet,
  type AuthedRequest,
  type SecurityLogger,
} from "./auth";
import { getFleetVehicles } from "./fleetAccess";
import { DEMO_FLEET_ID, createFleet, getFleet, getFleets, setFleetStatus } from "./fleetStore";

function handle(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res) => {
    fn(req, res).catch((err) => {
      if (err instanceof AccountError) return void res.status(err.status).json({ error: err.message });
      console.error("[fleets] handler error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Fleet service error. Please try again." });
    });
  };
}

export function registerFleetRoutes(app: Express, opts: { guards: RequestHandler[]; rateLimiter: RequestHandler; log: SecurityLogger }) {
  const { guards, rateLimiter, log } = opts;

  app.get(
    "/api/fleets",
    ...guards,
    handle(async (_req, res) => {
      const fleets = await getFleets();
      const users = await countUsersByFleet(fleets.map((f) => f.id));
      res.json({
        fleets: await Promise.all(
          fleets.map(async (f) => ({ ...f, vehicleCount: (await getFleetVehicles(f.id)).length, userCount: users[f.id] ?? 0 }))
        ),
      });
    })
  );

  app.post(
    "/api/fleets",
    rateLimiter,
    ...guards,
    handle(async (req, res) => {
      const { name, ownerName, ownerEmail } = req.body ?? {};
      const fleetName = typeof name === "string" ? name.trim() : "";
      if (fleetName.length < 2 || fleetName.length > 80) throw new AccountError("Fleet name must be 2 to 80 characters.", 400);
      // Check the owner before creating the fleet so a bad owner never leaves an empty fleet behind.
      if (typeof ownerName !== "string" || !ownerName.trim() || ownerName.length > 80) throw new AccountError("A valid name is required.", 400);
      if (!isValidAccountEmail(ownerEmail)) throw new AccountError("A valid email is required.", 400);
      if (await isEmailTaken(ownerEmail)) throw new AccountError("An account with this email already exists.", 409);

      const fleet = await createFleet(fleetName);
      const { user, temporaryPassword } = await createAccount({ name: ownerName, email: ownerEmail, role: "fleet_director", fleetId: fleet.id });
      log("FLEET_MANAGEMENT", "INFO", req, `Fleet '${fleet.name}' (${fleet.id}) created with owner ${user.email}`);
      res.status(201).json({ fleet, owner: user, temporaryPassword });
    })
  );

  // Registered before any /api/fleets/:id route; it is a POST and the :id route is a PATCH, so they never overlap.
  app.post(
    "/api/fleets/active",
    ...guards,
    handle(async (req, res) => {
      const fleetId = req.body?.fleetId;
      if (typeof fleetId !== "string" || !(await getFleet(fleetId))) return void res.status(404).json({ error: "Fleet not found." });
      const user = (req as AuthedRequest).user!;
      res.json({ user: await setActiveFleet(user.id, fleetId) });
    })
  );

  app.patch(
    "/api/fleets/:id",
    rateLimiter,
    ...guards,
    handle(async (req, res) => {
      const status = req.body?.status;
      if (status !== "active" && status !== "suspended") throw new AccountError("Status must be 'active' or 'suspended'.", 400);
      if (req.params.id === DEMO_FLEET_ID) throw new AccountError("The Demo fleet cannot be changed.", 400);
      const fleet = await setFleetStatus(req.params.id, status);
      if (!fleet) throw new AccountError("Fleet not found.", 404);
      log("FLEET_MANAGEMENT", "INFO", req, `Fleet ${fleet.id} set to ${status}`);
      res.json({ fleet });
    })
  );
}
