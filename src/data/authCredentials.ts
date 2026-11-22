import { AuthUser, UserRole } from '../types';

// SECURITY NOTE
// -------------
// This file is bundled into the browser, so it must NEVER contain passwords,
// security answers or any other secret. It only holds the public operator
// profile data the UI needs (names, roles, badges). All credential checks run
// on the server (see server/auth.ts) against salted scrypt hashes.

export interface RoleCredential {
  email: string;
  aliases: string[];
  role: UserRole;
  name: string;
  roleLabel: string;
  badgeNumber: string;
  avatarColor: string;
  shift: string;
  depot: string;
  permissions?: string[];
  description: string;
}

export const ROLE_CREDENTIALS: Record<UserRole, RoleCredential> = {
  developer: {
    email: 'developer@fleetdiag.local',
    aliases: ['sarthak', 'dev', 'developer', 'sarthakgohil', 'admin'],
    role: 'developer',
    name: 'Sarthak Gohil',
    roleLabel: 'Lead Developer & Systems Architect',
    badgeNumber: 'DEV-LEAD-01',
    avatarColor: 'bg-cyan-500 text-slate-950 font-bold',
    shift: 'Core Telematics & Firmware Engineering Bay',
    depot: 'Tata Connected Vehicle Platform HQ (Bangalore & Pune Engineering Bay)',
    permissions: [
      'manage_all_fleets',
      'change_code',
      'override_telemetry',
      'manage_dtcs',
      'approve_access_requests',
      'dispatch_work_orders',
      'system_calibration',
      'developer_console',
      'obd_simulation_lab',
      'load_emulator',
    ],
    description: 'Root ECU telemetry injection, code modification, firmware simulation & Developer Console',
  },
  fleet_director: {
    email: 'm.vance@fleetdiag-logistics.com',
    aliases: ['director', 'marcus', 'fleet_director', 'director@fleetdiag.com', 'm.vance'],
    role: 'fleet_director',
    name: 'Marcus Vance',
    roleLabel: 'Fleet Owner',
    badgeNumber: 'DIR-4091',
    avatarColor: 'bg-amber-500 text-slate-950 font-bold',
    shift: 'Operations & Fleet Command',
    depot: 'Interstate Freight Central Operations · Bay 1',
    permissions: [
      'manage_all_fleets',
      'fleet_director_access',
      'dispatch_work_orders',
      'approve_access_requests',
    ],
    description: 'Executive fleet command, unit dispatch, operator clearance approvals & asset analytics',
  },
  fleet_manager: {
    email: 'fleet.manager@fleetdiag-logistics.com',
    aliases: ['manager', 'fleet_manager', 'ops'],
    role: 'fleet_manager',
    name: 'David Hayes',
    roleLabel: 'Fleet Operations Manager',
    badgeNumber: 'FM-3012',
    avatarColor: 'bg-amber-600 text-slate-950 font-bold',
    shift: 'Regional Operations Hub',
    depot: 'Western Freight Corridor Hub',
    permissions: [
      'manage_all_fleets',
      'dispatch_work_orders',
      'approve_access_requests',
    ],
    description: 'Regional corridor management, driver scheduling & preventive maintenance tracking',
  },
  technician: {
    email: 'r.sharma@workshop-certified.com',
    aliases: ['tech', 'technician', 'rajesh', 'workshop', 'sharma'],
    role: 'technician',
    name: 'Rajesh Sharma',
    roleLabel: 'Master Diagnostic Technician',
    badgeNumber: 'TECH-8821',
    avatarColor: 'bg-cyan-500 text-slate-950 font-bold',
    shift: 'Bay 3 Workshop Lead',
    depot: 'Tata Motors & Cummins Diagnostics Hub',
    permissions: [
      'manage_dtcs',
      'dispatch_work_orders',
      'system_calibration',
      'obd_simulation_lab',
    ],
    description: 'Workshop floor fault diagnosis, live CAN-bus troubleshooting & DTC clears',
  },
  dispatcher: {
    email: 's.chen@corridor-dispatch.com',
    aliases: ['dispatch', 'dispatcher', 'sarah', 'chen', 'routes'],
    role: 'dispatcher',
    name: 'Sarah Chen',
    roleLabel: 'Route & Fleet Dispatcher',
    badgeNumber: 'DISP-1102',
    avatarColor: 'bg-emerald-500 text-slate-950 font-bold',
    shift: 'Interstate Night Corridor',
    depot: 'Highway Logistics Command',
    permissions: [
      'dispatch_work_orders',
    ],
    description: 'Real-time GPS corridor tracking, route telemetry, load tracking & speed monitoring',
  },
};


export type AuthResult =
  | { success: true; user: AuthUser; error?: undefined }
  | { success: false; error: string; user?: undefined };

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Verify credentials on the server. On success the server sets an HttpOnly session cookie. */
export async function authenticateUser(identifier: string, password: string): Promise<AuthResult> {
  if (!identifier.trim()) return { success: false, error: 'Enter your email or username.' };
  if (!password) return { success: false, error: 'Enter your password.' };
  try {
    const { ok, data } = await postJson('/api/auth/login', { identifier: identifier.trim(), password });
    if (ok && data.user) return { success: true, user: data.user as AuthUser };
    return { success: false, error: data.error || data.message || 'Sign-in failed. Please try again.' };
  } catch {
    return { success: false, error: 'Unable to reach the server. Check your connection and try again.' };
  }
}

/** Restore an existing session from the HttpOnly cookie (if any). `reason` says why the server refused it. */
export async function fetchCurrentSession(): Promise<{ user: AuthUser | null; reason?: string }> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return { user: null };
    const data = await res.json();
    if (data?.user) return { user: data.user as AuthUser };
    return typeof data?.reason === 'string' && data.reason ? { user: null, reason: data.reason } : { user: null };
  } catch {
    return { user: null };
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await postJson('/api/auth/logout');
  } catch {
    // ignore - local state is cleared regardless
  }
}

/** Create an operator account (requires approve_access_requests). Returns a one-time temporary password. */
export async function createOperatorAccount(input: {
  name: string;
  email: string;
  role: UserRole;
  depot?: string;
  /** Only a developer sends this; the server places everyone else's new user in their own fleet. */
  fleetId?: string;
}): Promise<{ success: boolean; error?: string; temporaryPassword?: string; user?: AuthUser }> {
  try {
    const { ok, data } = await postJson('/api/auth/accounts', input);
    if (ok) return { success: true, temporaryPassword: data.temporaryPassword, user: data.user };
    return { success: false, error: data.error || 'Could not create account.' };
  } catch {
    return { success: false, error: 'Unable to reach the server.' };
  }
}
