/**
 * Fleet access rules shared by sign-in, sessions and the vehicle checks.
 * It does not import auth.ts, so there is no import cycle with it.
 */
import type { Request, RequestHandler, Response } from "express";
import type { Fleet, UserRole } from "../src/types";
import type { AuthedRequest } from "./auth";
import { DEMO_FLEET_ID, getFleet, getStoredVehicles } from "./fleetStore";

export const SUSPENDED_MESSAGE = "This fleet has been suspended.";
const NO_FLEET_MESSAGE = "This account is not linked to a fleet. Contact your administrator.";
/** Marks a refusal of the whole fleet session, so the app can tell it from an ordinary permission 403. */
export const FLEET_REFUSED_CODE = "FLEET_REFUSED";

export function sendFleetRefusal(res: Response, message: string) {
  return res.status(403).json({ error: message, code: FLEET_REFUSED_CODE });
}

/** Takes a stored user. A developer works in the active fleet (Demo by default); everyone else in their own. */
export function resolveFleetId(u: { role: UserRole; fleetId?: string; activeFleetId?: string }): string | null {
  if (u.role === "developer") return u.activeFleetId ?? DEMO_FLEET_ID;
  return u.fleetId ?? null;
}

/**
 * A refusal message, or null when the account may use the app. Developers are never refused.
 * `fleet` is the account's resolved fleet (see resolveFleetId), already read, or null when there is none.
 */
export function fleetRefusal(u: { role: UserRole }, fleet: Fleet | null): string | null {
  if (u.role === "developer") return null;
  if (!fleet) return NO_FLEET_MESSAGE;
  if (fleet.status === "suspended") return SUSPENDED_MESSAGE;
  return null;
}

/** fleetRefusal for callers that have not read the fleet yet. */
export async function fleetAccessError(u: { role: UserRole; fleetId?: string; activeFleetId?: string }): Promise<string | null> {
  if (u.role === "developer") return null;
  const id = resolveFleetId(u);
  return fleetRefusal(u, id ? await getFleet(id) : null);
}

/**
 * Vehicles are shared by everyone in a fleet through the store, and the screens read these fields directly.
 * One incomplete record would break the app for every user, so it never gets saved.
 */
export function isCompleteVehicle(v: any): boolean {
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  return (
    text(v?.vehicle_id) &&
    text(v?.unit_name) &&
    text(v?.make_model) &&
    text(v?.location) &&
    Number.isFinite(v?.engine_hours) &&
    Number.isFinite(v?.coordinates?.lat) &&
    Number.isFinite(v?.coordinates?.lng) &&
    typeof v?.telemetry === "object" &&
    v.telemetry !== null
  );
}

/** One response for "not in your fleet" and "does not exist", so a customer cannot tell the two apart. */
export function sendVehicleNotFound(res: Response) {
  return res.status(404).json({ error: "Vehicle not found." });
}

export function sendStoreUnavailable(res: Response) {
  return res.status(503).json({ error: "Fleet records are temporarily unavailable. Please try again." });
}

let demoVehicleSource: () => any[] = () => [];

/** The Demo fleet's built-in sample vehicles live in server.ts; this reads the current array on every call. */
export function registerDemoVehicles(source: () => any[]): void {
  demoVehicleSource = source;
}

/**
 * Demo: the in-memory sample vehicles merged with stored ones (memory alone if the store fails).
 * Other fleets: stored vehicles only, and a store error propagates so it is never mistaken for an empty fleet.
 */
export async function getFleetVehicles(fleetId: string): Promise<any[]> {
  if (fleetId !== DEMO_FLEET_ID) {
    return (await getStoredVehicles(fleetId)).map((v) => ({ ...v, fleet_id: fleetId }));
  }
  const merged = new Map(demoVehicleSource().map((v) => [v.vehicle_id, v]));
  try {
    for (const saved of (await getStoredVehicles(fleetId)).slice().reverse()) {
      const vehicle = { ...merged.get(saved.vehicle_id), ...saved };
      if (isCompleteVehicle(vehicle)) merged.set(saved.vehicle_id, vehicle);
    }
  } catch (err) {
    console.error("[fleet] Could not read saved vehicles:", err);
  }
  return Array.from(merged.values()).map((v) => ({ ...v, fleet_id: fleetId }));
}

export async function findFleetVehicle(fleetId: string, vehicleId: string): Promise<any | null> {
  return (await getFleetVehicles(fleetId)).find((v) => v.vehicle_id === vehicleId) ?? null;
}

/** Uses the fleet already resolved onto the session; a missing or unknown fleet is refused. */
export const requireFleet: RequestHandler = async (req, res, next) => {
  try {
    const id = (req as AuthedRequest).user?.fleetId;
    // requireAuth has usually read this fleet already; reuse it rather than reading again.
    const known = (req as AuthedRequest).fleet;
    const fleet = known && known.id === id ? known : id ? await getFleet(id) : null;
    if (!fleet) {
      // A developer is never refused as a customer is, so the app must not show them the refused view
      if ((req as AuthedRequest).user?.role === "developer") return void res.status(403).json({ error: NO_FLEET_MESSAGE });
      return void sendFleetRefusal(res, NO_FLEET_MESSAGE);
    }
    (req as AuthedRequest).fleet = fleet;
    next();
  } catch (err) {
    console.error("[fleet] Could not read the fleet:", err);
    sendStoreUnavailable(res);
  }
};

/** Must follow requireFleet. 400 without an ID, the shared 404 outside the fleet. */
export function requireFleetVehicle(pick: (req: Request) => unknown): RequestHandler {
  return async (req, res, next) => {
    const id = pick(req);
    if (typeof id !== "string" || !id) return void res.status(400).json({ error: "vehicle_id is required." });
    try {
      const vehicle = await findFleetVehicle((req as AuthedRequest).fleet!.id, id);
      if (!vehicle) return void sendVehicleNotFound(res);
      (req as AuthedRequest).fleetVehicle = vehicle;
      next();
    } catch (err) {
      console.error("[fleet] Could not read vehicles:", err);
      sendStoreUnavailable(res);
    }
  };
}
