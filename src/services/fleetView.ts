import type { AuthUser, DiagnosticResult, FleetVehicle, UserRole } from '../types';

export type FleetLoadState = 'loading' | 'ready' | 'empty' | 'error';

/** Keep the current vehicle if the fleet still has it, else the first one, else none. */
export function chooseSelectedVehicle(vehicles: FleetVehicle[], currentId: string): string | null {
  if (vehicles.some((v) => v.vehicle_id === currentId)) return currentId;
  return vehicles[0]?.vehicle_id ?? null;
}

/** The telemetry simulator makes up data, so only a developer inside a demo fleet may run it. */
export function canUseSimulator(isLeadDeveloper: boolean, user: AuthUser | null): boolean {
  return isLeadDeveloper && user?.isDemoFleet === true;
}

/** The override and fault tabs write made-up data, so without the simulator the console falls back to its OBD tab. */
export function availableConsoleTab<T extends string>(tab: T, canSimulate: boolean): T | 'obd_scanner' {
  return !canSimulate && (tab === 'telemetry_override' || tab === 'dtc_injector') ? 'obd_scanner' : tab;
}

/** The same rule the server applies to a vehicle ID, with a message a person can act on. */
export function vehicleIdError(id: string): string | null {
  if (!id) return 'Please enter a unique Vehicle Unit ID (e.g. FLEET-108 or TATA-4825).';
  if (id.length > 64) return 'Vehicle ID must be 64 characters or fewer.';
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return 'Vehicle ID can only use letters, numbers, hyphens and underscores, with no spaces.';
  return null;
}

export type RoleOption = { value: UserRole; label: string };

const STAFF_ROLES: RoleOption[] = [
  { value: 'technician', label: 'Diagnostic Technician' },
  { value: 'dispatcher', label: 'Fleet Dispatcher' },
  { value: 'fleet_manager', label: 'Fleet Operations Manager' },
];

/** Matches the server: only a developer or a Fleet Owner may add a Fleet Owner. */
export function assignableRoles(creatorRole: UserRole): RoleOption[] {
  const canAddOwner = creatorRole === 'developer' || creatorRole === 'fleet_director';
  return canAddOwner ? [...STAFF_ROLES, { value: 'fleet_director', label: 'Fleet Owner' }] : STAFF_ROLES;
}

/** A developer has no fleet of their own and adds people from the Fleets screen instead. */
export function canAddStaff(user: AuthUser | null): boolean {
  return Boolean(user && user.role !== 'developer' && user.permissions?.includes('approve_access_requests'));
}

/** Older versions kept added vehicles in the browser. Remove them so they never leak between users. */
export function removeLegacyVehicleCache(): void {
  try {
    localStorage.removeItem('fleetdiag_custom_vehicles');
  } catch {
    // storage may be blocked; nothing to clean up then
  }
}

/**
 * An analysis result may be shown or cached only if the session has not changed since the request
 * started and it is for the vehicle that is selected right now.
 */
export function isResultCurrent(
  startEpoch: number,
  currentEpoch: number,
  resultVehicleId: string | undefined,
  selectedVehicleId: string,
): boolean {
  return startEpoch === currentEpoch && Boolean(resultVehicleId) && resultVehicleId === selectedVehicleId;
}

/**
 * A vehicle's status after its fault codes were changed by hand. Adding codes to a healthy vehicle
 * marks it WARNING. Clearing them marks it HEALTHY only in a demo fleet: for a real fleet, clearing
 * codes is not a scan, so the status stays as the last scan left it.
 */
export function statusAfterCodeChange(
  current: FleetVehicle['status'],
  hasCodes: boolean,
  isDemoFleet: boolean,
): FleetVehicle['status'] {
  if (hasCodes) return current === 'HEALTHY' ? 'WARNING' : current;
  return isDemoFleet ? 'HEALTHY' : current;
}

/**
 * The diagnosis to show once every fault code has been cleared by hand. A demo fleet gets the
 * ready-made "codes cleared" result; a real fleet gets none, so nothing claims a scan that never ran.
 */
export function diagnosisAfterCodesCleared(isDemoFleet: boolean, timestamp: string): DiagnosticResult | null {
  if (!isDemoFleet) return null;
  return {
    health_score: 98,
    status: 'HEALTHY',
    primary_diagnosis: 'All Diagnostic Trouble Codes Cleared — Nominal Operation',
    failure_probability_next_24h: 0,
    required_parts: [],
    action_plan: [
      'All diagnostic trouble codes cleared successfully from memory.',
      'ECU MIL indicator reset.',
      'Cleared for routine route dispatch.',
    ],
    estimated_cost_inr: 0,
    _engine: 'ECU Cleared Protocol',
    timestamp,
  };
}

export type StatusTone = 'critical' | 'warning' | 'ok';

/** Colour family for a vehicle status pill. Older data says CRITICAL, scans say CRITICAL_STOP; both are critical. */
export function vehicleStatusTone(status: FleetVehicle['status']): StatusTone {
  if (status === 'CRITICAL' || status === 'CRITICAL_STOP') return 'critical';
  if (status === 'WARNING') return 'warning';
  return 'ok';
}
