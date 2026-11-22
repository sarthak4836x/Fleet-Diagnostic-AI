/**
 * Durable fleet records: custom vehicles, work orders and diagnostic history, kept per fleet.
 *
 * Kept in the same store as accounts (Upstash Redis on Vercel, JSON files locally), because
 * serverless memory and /tmp don't survive between requests. Browsers never reach this data
 * directly; it's only available through the session-protected API.
 */
import crypto from "crypto";
import { kv } from "./kvStore";
import type { Fleet } from "../src/types";

const OLD_RECORDS_KEY = "fleetdiag_records_v1"; // gitleaks:allow (a storage key name, not a secret)
const recordsKey = (fleetId: string) => `fleetdiag_fleet_records_v1:${fleetId}`;
// One record per fleet (v2) plus a set of their IDs, so a change to one fleet never overwrites another.
// v1 (one array of every fleet) is read once by migrateFleets and never written or deleted.
const FLEETS_V1_KEY = "fleetdiag_fleets_v1";
const FLEETS_READY_KEY = "fleetdiag_fleets_v2_ready";
const FLEET_IDS_KEY = "fleetdiag_fleet_ids_v2";
const fleetKey = (id: string) => `fleetdiag_fleet_v2:${id}`;
const MAX_VEHICLES = 200;
const MAX_HISTORY = 200;
export const MAX_RECORD_BYTES = 20_000;
export const DEMO_FLEET_ID = "flt_demo";

interface FleetRecords {
  vehicles: any[];
  workOrders: any[];
  diagnostics: any[];
}

const DEMO_FLEET: Fleet = {
  id: DEMO_FLEET_ID,
  name: "Demo Fleet",
  status: "active",
  isDemo: true,
  createdAt: new Date(0).toISOString(),
};

async function load(fleetId: string): Promise<FleetRecords> {
  const stored = await kv.get<Partial<FleetRecords>>(recordsKey(fleetId));
  return { vehicles: stored?.vehicles ?? [], workOrders: stored?.workOrders ?? [], diagnostics: stored?.diagnostics ?? [] };
}

/**
 * Moves the single-fleet records into the Demo fleet, then the fleet list into one record per
 * fleet (see migrateFleets). Skipped once the ready marker exists. The old keys are read but never changed.
 */
export async function migrateFleetData(): Promise<void> {
  await migrateIfNeeded();
}

/** True when this call ran the migration, false when the ready marker was already there. */
async function migrateIfNeeded(): Promise<boolean> {
  if ((await kv.get(FLEETS_READY_KEY)) !== null) return false;
  if ((await kv.get(recordsKey(DEMO_FLEET_ID))) === null) {
    const old = await kv.get<Partial<FleetRecords>>(OLD_RECORDS_KEY);
    if (old) {
      const stamp = (list?: any[]) => (list ?? []).map((item) => ({ ...item, fleet_id: DEMO_FLEET_ID }));
      await kv.set(recordsKey(DEMO_FLEET_ID), {
        vehicles: stamp(old.vehicles),
        workOrders: stamp(old.workOrders),
        diagnostics: stamp(old.diagnostics),
      });
    }
  }
  await migrateFleets();
  return true;
}

function isFleet(f: unknown): f is Fleet {
  const x = f as Fleet;
  return !!x && typeof x === "object" && typeof x.id === "string" && x.id.length > 0 && typeof x.name === "string";
}

/**
 * Copies the v1 fleet list (plus the Demo fleet, if it is missing) into one record per fleet.
 * Every write is set-if-absent or a set add, so a second run, a resumed run or two instances at
 * once all reach the same state and never overwrite a record changed since. The ready marker is
 * written last. v1 is read, never written; a v1 that is not a list of fleets throws, writing nothing.
 */
async function migrateFleets(): Promise<void> {
  const stored = await kv.get<unknown>(FLEETS_V1_KEY);
  if (stored !== null && !(Array.isArray(stored) && stored.every(isFleet))) {
    // Carrying on would leave only the Demo fleet, and the marker would make that permanent.
    throw new Error(`[fleets] ${FLEETS_V1_KEY} does not hold a list of fleets; not migrating.`);
  }
  const old = (stored ?? []) as Fleet[];
  const fleets = old.some((f) => f.id === DEMO_FLEET_ID) ? old : [DEMO_FLEET, ...old];
  for (let i = 0; i < fleets.length; i += 20) {
    await Promise.all(fleets.slice(i, i + 20).map((f) => kv.setIfAbsent(fleetKey(f.id), f)));
  }
  for (let i = 0; i < fleets.length; i += 20) {
    await Promise.all(fleets.slice(i, i + 20).map((f) => kv.addToSet(FLEET_IDS_KEY, f.id)));
  }
  await kv.set(FLEETS_READY_KEY, { migratedAt: new Date().toISOString(), source: stored === null ? "none" : "v1", count: fleets.length });
}

/** How long after a failed re-check of v1 the next one may start. */
const RESYNC_RETRY_MS = 60 * 1000;
/** When the last re-check failed; 0 when none has failed since the last success (or none ran). */
let resyncFailedAt = 0;
let resyncRunning: Promise<void> | null = null;

/**
 * Once per cold start after migration: copies any fleet in v1 that v2 does not know yet. During a
 * rolling deploy or after a rollback, an instance on the old code may still add fleets to v1 only.
 * Missing IDs get set-if-absent plus the set add; an existing v2 record is never overwritten, so a
 * status change made in v2 stays. A failure (a wrong Redis type, a store call failing) is logged and
 * swallowed, so the request goes on: the fleets already in v2 are healthy and keep working. It is
 * tried again in the background (see retryResyncIfDue). Only the first-time migration fails closed.
 */
async function resyncFromV1(): Promise<void> {
  try {
    await copyMissingFromV1();
    resyncFailedAt = 0;
  } catch (err) {
    resyncFailedAt = Date.now();
    console.warn(
      `[fleets] Could not re-check ${FLEETS_V1_KEY}; fleets added there by an older deployment may be missing until a retry (at most once a minute) succeeds:`,
      err
    );
  }
}

/**
 * After a failed re-check: starts one more, in the background, once a minute has passed since the
 * last failure and none is running. Requests never wait for it, and it never fails one.
 */
function retryResyncIfDue(): void {
  if (!resyncFailedAt || resyncRunning || Date.now() - resyncFailedAt < RESYNC_RETRY_MS) return;
  resyncRunning = resyncFromV1().finally(() => {
    resyncRunning = null;
  });
}

async function copyMissingFromV1(): Promise<void> {
  const stored = await kv.get<unknown>(FLEETS_V1_KEY);
  if (stored === null) return;
  if (!(Array.isArray(stored) && stored.every(isFleet))) {
    console.warn(`[fleets] ${FLEETS_V1_KEY} does not hold a list of fleets; skipping the cold-start re-check.`);
    return;
  }
  const known = new Set(await kv.getSet(FLEET_IDS_KEY));
  const missing = (stored as Fleet[]).filter((f) => !known.has(f.id));
  for (let i = 0; i < missing.length; i += 20) {
    await Promise.all(
      missing.slice(i, i + 20).map(async (f) => {
        await kv.setIfAbsent(fleetKey(f.id), f);
        await kv.addToSet(FLEET_IDS_KEY, f.id);
      })
    );
  }
  if (missing.length) console.warn(`[fleets] Copied ${missing.length} fleet(s) from ${FLEETS_V1_KEY} that were missing.`);
}

let readyPromise: Promise<void> | null = null;

/**
 * Runs once per instance, on first use (never at import): the migration, or when that has already
 * happened, the v1 re-check. A failed migration is retried by the next request; a failed re-check
 * is retried in the background, at most once a minute (see retryResyncIfDue).
 */
function ready(): Promise<void> {
  if (readyPromise) {
    retryResyncIfDue();
  } else {
    readyPromise = (async () => {
      if (!(await migrateIfNeeded())) await resyncFromV1();
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Demo first, then oldest first (the order the v1 list kept), then by ID. */
function byListOrder(a: Fleet, b: Fleet): number {
  if (a.id === DEMO_FLEET_ID || b.id === DEMO_FLEET_ID) return a.id === DEMO_FLEET_ID ? -1 : 1;
  return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || a.id.localeCompare(b.id);
}

export async function getFleets(): Promise<Fleet[]> {
  await ready();
  const ids = await kv.getSet(FLEET_IDS_KEY);
  const fleets = (await Promise.all(ids.map((id) => getFleetRecord(id)))).filter((f): f is Fleet => !!f);
  if (!fleets.some((f) => f.id === DEMO_FLEET_ID)) fleets.push(DEMO_FLEET);
  return fleets.sort(byListOrder);
}

/** One read. The ID is checked against the record because the file store folds some characters together. */
async function getFleetRecord(id: string): Promise<Fleet | null> {
  if (typeof id !== "string" || !id) return null;
  const fleet = await kv.get<Fleet>(fleetKey(id));
  return fleet && fleet.id === id ? fleet : null;
}

/** The Demo fleet always exists: its built-in definition stands in if its record is ever missing. */
export async function getFleet(id: string): Promise<Fleet | null> {
  await ready();
  const fleet = await getFleetRecord(id);
  return fleet ?? (id === DEMO_FLEET_ID ? DEMO_FLEET : null);
}

/**
 * The record claims the ID (set-if-absent), then the ID joins the set. A crash in between leaves a
 * fleet that getFleet finds but the list does not show, never an owner pointing at nothing.
 */
export async function createFleet(name: string): Promise<Fleet> {
  await ready();
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = `flt_${crypto.randomBytes(3).toString("hex")}`;
    const fleet: Fleet = { id, name, status: "active", isDemo: false, createdAt: new Date().toISOString() };
    if (!(await kv.setIfAbsent(fleetKey(id), fleet))) continue;
    await kv.addToSet(FLEET_IDS_KEY, id);
    return fleet;
  }
  throw new Error("[fleets] Could not find a free fleet ID.");
}

/**
 * Writes only this fleet's record. The Demo fleet is never changed: the route refuses it first, and
 * this refuses it too (null, as for an unknown fleet).
 */
export async function setFleetStatus(id: string, status: Fleet["status"]): Promise<Fleet | null> {
  if (id === DEMO_FLEET_ID) return null;
  const fleet = await getFleet(id);
  if (!fleet) return null;
  const updated = { ...fleet, status };
  await kv.set(fleetKey(id), updated);
  return updated;
}

export function isRecordTooLarge(record: unknown): boolean {
  return JSON.stringify(record).length > MAX_RECORD_BYTES;
}

/** Newest first, replacing any record with the same key. */
function upsert(list: any[], record: any, key: string, max: number): any[] {
  return [record, ...list.filter((item) => item[key] !== record[key])].slice(0, max);
}

export async function getStoredVehicles(fleetId: string): Promise<any[]> {
  return (await load(fleetId)).vehicles;
}

export async function saveStoredVehicle(fleetId: string, vehicle: any): Promise<void> {
  const records = await load(fleetId);
  records.vehicles = upsert(records.vehicles, { ...vehicle, fleet_id: fleetId }, "vehicle_id", MAX_VEHICLES);
  await kv.set(recordsKey(fleetId), records);
}

export async function saveStoredWorkOrder(fleetId: string, workOrder: any): Promise<void> {
  const records = await load(fleetId);
  records.workOrders = upsert(records.workOrders, { ...workOrder, fleet_id: fleetId }, "id", MAX_HISTORY);
  await kv.set(recordsKey(fleetId), records);
}

export async function saveStoredDiagnostic(fleetId: string, diagnostic: any): Promise<void> {
  const records = await load(fleetId);
  records.diagnostics = upsert(records.diagnostics, { ...diagnostic, fleet_id: fleetId }, "id", MAX_HISTORY);
  await kv.set(recordsKey(fleetId), records);
}

export async function getStoredHistory(fleetId: string): Promise<Pick<FleetRecords, "workOrders" | "diagnostics">> {
  const { workOrders, diagnostics } = await load(fleetId);
  return { workOrders, diagnostics };
}
