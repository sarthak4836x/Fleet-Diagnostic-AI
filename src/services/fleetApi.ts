// All fleet data goes through the session-protected server API. The browser has no direct
// connection to any database, so a signed-out visitor can't read or change anything.
import { DiagnosticResult, Fleet, FleetVehicle } from '../types';

/** A refusal from the server. The message is written for the person using the app. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null; // Non-JSON body; apiError falls back to a generic message.
  }
}

/** Sent by the server with every refusal of the whole fleet session (suspended, unknown or no fleet). */
export const FLEET_REFUSED_CODE = 'FLEET_REFUSED';

/** The server's message when this response refuses the fleet session; null for anything else, including an ordinary 403. */
export function fleetRefusalMessage(status: number, data: any): string | null {
  return status === 403 && data?.code === FLEET_REFUSED_CODE && typeof data.error === 'string' ? data.error : null;
}

let fleetRefusalListener: ((message: string) => void) | null = null;

/** The app registers here to replace the dashboard with the refused view. Returns an unsubscribe function. */
export function onFleetRefused(listener: (message: string) => void): () => void {
  fleetRefusalListener = listener;
  return () => {
    if (fleetRefusalListener === listener) fleetRefusalListener = null;
  };
}

// Bumped on every sign-in and sign-out, so a refusal answering an earlier session's request is ignored
let fleetSession = 0;

export function beginFleetSession(): void {
  fleetSession += 1;
}

/** Capture this before a request and hand it to reportIfFleetRefused with the response. */
export function currentFleetSession(): number {
  return fleetSession;
}

/** Reports a fleet refusal to the app, unless the session changed since `session`. True when it was reported. */
function noteFleetRefusal(status: number, data: any, session: number): boolean {
  const message = fleetRefusalMessage(status, data);
  if (message === null || session !== fleetSession) return false;
  fleetRefusalListener?.(message);
  return true;
}

/** For callers that use fetch directly; `session` comes from currentFleetSession() before the fetch. Leaves the body unread. */
export async function reportIfFleetRefused(res: Response, session: number): Promise<boolean> {
  if (res.status !== 403) return false;
  return noteFleetRefusal(res.status, await readJson(res.clone()), session);
}

function apiError(res: Response, data: any, session: number): ApiError {
  noteFleetRefusal(res.status, data, session);
  return new ApiError(data?.message || data?.error || `The server could not complete this request (${res.status}).`, res.status);
}

async function post(url: string, body: unknown): Promise<void> {
  const session = fleetSession;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw apiError(res, await readJson(res), session);
}

export async function fetchFleet(): Promise<FleetVehicle[]> {
  const session = fleetSession;
  const res = await fetch('/api/fleet', { credentials: 'same-origin' });
  if (!res.ok) throw apiError(res, await readJson(res), session);
  const data = await res.json();
  return Array.isArray(data?.presets) ? data.presets : [];
}

export type FleetLoadFailure = { message?: string; canRetry: boolean; needsSignOut: boolean };

/**
 * No message means the server was never reached. A refused session is offered Sign out; every
 * other failure is offered Retry, so the person is never left without a way forward.
 */
export function describeFleetLoadFailure(err: unknown): FleetLoadFailure {
  if (!(err instanceof ApiError)) return { canRetry: true, needsSignOut: false };
  const needsSignOut = err.status === 401 || err.status === 403;
  return { message: err.message, canRetry: !needsSignOut, needsSignOut };
}

/** True when data survives a restart. Vercel without Upstash reports "memory". */
export async function isStoragePersistent(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    return res.ok && data.accountStore !== 'memory';
  } catch {
    return false;
  }
}

export function saveVehicle(vehicle: FleetVehicle): Promise<void> {
  return post('/api/vehicles', vehicle);
}

// Repeat scans of an unchanged vehicle shouldn't fill the history with identical records.
const lastDiagnostic = new Map<string, string>();

/** Vehicle IDs are only unique within a fleet, so this is forgotten whenever the fleet or user changes. */
export function clearDiagnosticHistory(): void {
  lastDiagnostic.clear();
}

export async function saveDiagnostic(vehicleId: string, result: DiagnosticResult): Promise<void> {
  const fingerprint = JSON.stringify([result.status, result.health_score, result.primary_diagnosis]);
  if (lastDiagnostic.get(vehicleId) === fingerprint) return;
  lastDiagnostic.set(vehicleId, fingerprint);

  await post('/api/backup/record', {
    type: 'diagnostic',
    data: {
      id: `diag-${vehicleId}-${Date.now()}`,
      vehicle_id: vehicleId,
      status: result.status,
      health_score: result.health_score,
      primary_diagnosis: result.primary_diagnosis,
      failure_probability_next_24h: result.failure_probability_next_24h,
      timestamp: new Date().toISOString(),
    },
  });
}

export function saveWorkOrder(
  workOrderNumber: string,
  vehicleId: string,
  grandTotalInr: number,
  status = 'OPEN'
): Promise<void> {
  return post('/api/backup/record', {
    type: 'work_order',
    data: {
      id: workOrderNumber,
      vehicle_id: vehicleId,
      status,
      grand_total_inr: grandTotalInr,
      createdAt: new Date().toISOString(),
    },
  });
}

export type FleetSummary = Fleet & { vehicleCount: number; userCount: number };

async function fleetRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const session = fleetSession;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw apiError(res, data, session);
  return data as T;
}

export async function listFleets(): Promise<FleetSummary[]> {
  const data = await fleetRequest<{ fleets?: FleetSummary[] }>('/api/fleets', 'GET');
  return Array.isArray(data?.fleets) ? data.fleets : [];
}

export async function createFleetWithOwner(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
}): Promise<{ fleet: Fleet; temporaryPassword: string }> {
  const data = await fleetRequest<{ fleet: Fleet; temporaryPassword: string }>('/api/fleets', 'POST', input);
  return { fleet: data.fleet, temporaryPassword: data.temporaryPassword };
}

export async function updateFleetStatus(id: string, status: Fleet['status']): Promise<Fleet> {
  const data = await fleetRequest<{ fleet: Fleet }>(`/api/fleets/${encodeURIComponent(id)}`, 'PATCH', { status });
  return data.fleet;
}

export async function switchActiveFleet(fleetId: string): Promise<void> {
  await fleetRequest('/api/fleets/active', 'POST', { fleetId });
}
