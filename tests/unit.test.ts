import { describe, it, expect, vi, afterEach } from 'vitest';
import { validatePasswordStrength, hashSecret, verifySecret } from '../server/auth';
import { validatePythonIpcMode, validateVehiclePayload, runSecurityPenetrationTests } from '../server';
import {
  decodeDtcBytePair,
  encodeDtcToHex,
  extractHexTokens,
  decodeRawTelematicsPayload,
  generateSimulatedObdHex,
} from '../src/services/obdDecoder';
import { buildTelemetryAlerts } from '../src/hooks/useTelemetryAlerts';
import {
  assignableRoles,
  availableConsoleTab,
  canAddStaff,
  chooseSelectedVehicle,
  canUseSimulator,
  isResultCurrent,
  vehicleIdError,
  statusAfterCodeChange,
  diagnosisAfterCodesCleared,
  vehicleStatusTone,
} from '../src/services/fleetView';
import type { AuthUser, DiagnosticResult, FleetVehicle } from '../src/types';
import {
  beginFleetSession,
  clearDiagnosticHistory,
  createFleetWithOwner,
  currentFleetSession,
  describeFleetLoadFailure,
  fetchFleet,
  fleetRefusalMessage,
  onFleetRefused,
  reportIfFleetRefused,
  saveDiagnostic,
  saveVehicle,
} from '../src/services/fleetApi';
import { createOperatorAccount, fetchCurrentSession } from '../src/data/authCredentials';

describe('password rules', () => {
  it('rejects short, letter-only and number-only passwords', () => {
    expect(validatePasswordStrength('abc12')).toMatch(/8 characters/);
    expect(validatePasswordStrength('abcdefghij')).toMatch(/letters and numbers/);
    expect(validatePasswordStrength('1234567890')).toMatch(/letters and numbers/);
    expect(validatePasswordStrength('x'.repeat(129) + '1')).toMatch(/at most 128/);
    expect(validatePasswordStrength(undefined)).toMatch(/required/);
  });
  it('accepts a normal password', () => {
    expect(validatePasswordStrength('Fresh12345')).toBeNull();
  });
});

describe('scrypt hashing', () => {
  it('verifies the right secret and rejects the wrong one', () => {
    const h = hashSecret('Correct#Horse9');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(verifySecret('Correct#Horse9', h)).toBe(true);
    expect(verifySecret('correct#horse9', h)).toBe(false);
  });
  it('uses a fresh salt every time', () => {
    expect(hashSecret('same')).not.toBe(hashSecret('same'));
  });
  it('never throws on garbage hashes', () => {
    expect(verifySecret('x', '')).toBe(false);
    expect(verifySecret('x', 'scrypt$$')).toBe(false);
    expect(verifySecret('x', 'md5$a$b')).toBe(false);
  });
});

describe('python IPC mode whitelist', () => {
  it('allows only the known modes', () => {
    for (const m of ['diagnose', 'fuel', 'predictive', 'query', 'info']) expect(validatePythonIpcMode(m)).toBe(true);
  });
  it('blocks injection attempts', () => {
    for (const m of ['diagnose; rm -rf /', '../engine', 'DIAGNOSE', '', 'x', 'a'.repeat(40), '$(whoami)'])
      expect(validatePythonIpcMode(m)).toBe(false);
    expect(validatePythonIpcMode(undefined as any)).toBe(false);
  });
});

describe('vehicle payload validation', () => {
  it('accepts a good vehicle', () => {
    expect(validateVehiclePayload({ vehicle_id: 'TATA-1', status: 'NORMAL', health_score: 90 }).ok).toBe(true);
  });
  it.each([
    ['missing id', {}],
    ['path traversal id', { vehicle_id: '../../root' }],
    ['script in id', { vehicle_id: '<script>' }],
    ['id too long', { vehicle_id: 'a'.repeat(65) }],
    ['ghost field', { vehicle_id: 'A', adminOverride: true }],
    ['second ghost field', { vehicle_id: 'A', bypassSecurity: 1 }],
    ['negative health', { vehicle_id: 'A', health_score: -50 }],
    ['health overflow', { vehicle_id: 'A', health_score: 99999 }],
    ['health not a number', { vehicle_id: 'A', health_score: 'ten' }],
    ['bad status', { vehicle_id: 'A', status: 'SUPER_ADMIN_BYPASS' }],
  ])('rejects %s', (_name, payload) => {
    expect(validateVehiclePayload(payload).ok).toBe(false);
  });
});

describe('built-in penetration test suite', () => {
  it('every vector is defended, and PEN-006 runs the real validator', async () => {
    const results = await runSecurityPenetrationTests();
    expect(results).toHaveLength(6);
    for (const r of results) expect(r.result, r.testId).toBe('DEFENDED');
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe('OBD-II decoder', () => {
  it('decodes and re-encodes DTCs', () => {
    expect(decodeDtcBytePair(0x01, 0x71)).toBe('P0171');
    expect(decodeDtcBytePair(0xc1, 0x00)).toBe('U0100');
    expect(decodeDtcBytePair(0, 0)).toBeNull();
    expect(encodeDtcToHex('P0171')).toBe('01 71');
    expect(encodeDtcToHex('U0100')).toBe('C1 00');
    expect(encodeDtcToHex('nonsense')).toBeNull();
    for (const code of ['P0192', 'P2202', 'C0300', 'B1234', 'U0121']) {
      const [a, b] = encodeDtcToHex(code)!.split(' ').map((h) => parseInt(h, 16));
      expect(decodeDtcBytePair(a, b)).toBe(code);
    }
  });
  it('extracts hex tokens and ignores labels', () => {
    expect(extractHexTokens('Mode 01 PID 0C response: 41 0C 1A F8')).toEqual(['41', '0C', '1A', 'F8']);
    expect(extractHexTokens('')).toEqual([]);
  });
  it('decodes engine RPM from a Mode 01 PID 0C frame', () => {
    const out = decodeRawTelematicsPayload('41 0C 1A F8'); // (0x1A*256 + 0xF8)/4 = 1726
    expect(out.telemetry_metrics.engine_rpm).toBe(1726);
  });
  it('round-trips simulated telemetry', () => {
    const hex = generateSimulatedObdHex({ engine_rpm: 1450, speed_kmh: 52, coolant_temp_c: 104, engine_load_pct: 86, active_dtc_codes: ['P2202'] });
    const out = decodeRawTelematicsPayload(hex);
    expect(out.telemetry_metrics.engine_rpm).toBeGreaterThan(1400);
    expect(out.telemetry_metrics.engine_rpm).toBeLessThan(1500);
    expect(out.telemetry_metrics.coolant_temp_celsius).toBe(104);
    expect(out.diagnostic_trouble_codes).toContain('P2202');
  });
});

describe('fleet view helpers', () => {
  it('picks a valid vehicle or none', () => {
    const v = [{ vehicle_id: 'A' }, { vehicle_id: 'B' }] as FleetVehicle[];
    expect(chooseSelectedVehicle(v, 'B')).toBe('B');
    expect(chooseSelectedVehicle(v, 'GONE')).toBe('A');
    expect(chooseSelectedVehicle([], 'A')).toBeNull();
  });
  it('allows the simulator only for a developer in a demo fleet', () => {
    expect(canUseSimulator(true, { isDemoFleet: true } as AuthUser)).toBe(true);
    expect(canUseSimulator(true, { isDemoFleet: false } as AuthUser)).toBe(false);
    expect(canUseSimulator(false, { isDemoFleet: true } as AuthUser)).toBe(false);
    expect(canUseSimulator(true, null)).toBe(false);
  });
});

describe('fault codes changed by hand', () => {
  it('marks a healthy vehicle WARNING when codes are added, in any fleet', () => {
    expect(statusAfterCodeChange('HEALTHY', true, false)).toBe('WARNING');
    expect(statusAfterCodeChange('HEALTHY', true, true)).toBe('WARNING');
    expect(statusAfterCodeChange('CRITICAL_STOP', true, false)).toBe('CRITICAL_STOP');
  });
  it('marks a vehicle HEALTHY on clearing codes only in a demo fleet', () => {
    expect(statusAfterCodeChange('WARNING', false, true)).toBe('HEALTHY');
    expect(statusAfterCodeChange('WARNING', false, false)).toBe('WARNING');
    expect(statusAfterCodeChange('CRITICAL_STOP', false, false)).toBe('CRITICAL_STOP');
    expect(statusAfterCodeChange(undefined, false, false)).toBeUndefined();
  });
  it('shows a ready-made cleared result only in a demo fleet', () => {
    expect(diagnosisAfterCodesCleared(false, '2026-01-01T00:00:00.000Z')).toBeNull();
    const demo = diagnosisAfterCodesCleared(true, '2026-01-01T00:00:00.000Z');
    expect(demo?.status).toBe('HEALTHY');
    expect(demo?.health_score).toBe(98);
    expect(demo?.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('vehicle status pill', () => {
  it('treats CRITICAL and CRITICAL_STOP as critical', () => {
    expect(vehicleStatusTone('CRITICAL')).toBe('critical');
    expect(vehicleStatusTone('CRITICAL_STOP')).toBe('critical');
    expect(vehicleStatusTone('WARNING')).toBe('warning');
    expect(vehicleStatusTone('HEALTHY')).toBe('ok');
    expect(vehicleStatusTone('NORMAL')).toBe('ok');
    expect(vehicleStatusTone(undefined)).toBe('ok');
  });
});

describe('stale analysis results', () => {
  it('accepts a result only for the same session and the selected vehicle', () => {
    expect(isResultCurrent(3, 3, 'A', 'A')).toBe(true);
    expect(isResultCurrent(3, 4, 'A', 'A')).toBe(false);
    expect(isResultCurrent(3, 3, 'A', 'B')).toBe(false);
    expect(isResultCurrent(3, 3, undefined, '')).toBe(false);
  });
});

describe('fleet api errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces the server error text when creating a fleet fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'An account with this email already exists.' }), { status: 409 }))
    );
    await expect(
      createFleetWithOwner({ name: 'Acme', ownerName: 'Ann', ownerEmail: 'ann@example.com' })
    ).rejects.toThrow('An account with this email already exists.');
  });

  const respondWith = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it('carries a refusal from the fleet load, and only offers what can help', async () => {
    respondWith(403, { error: 'This fleet has been suspended.' });
    const refused = await fetchFleet().catch(describeFleetLoadFailure);
    expect(refused).toEqual({ message: 'This fleet has been suspended.', canRetry: false, needsSignOut: true });

    respondWith(401, { error: 'Authentication required. Please sign in.' });
    expect(await fetchFleet().catch(describeFleetLoadFailure)).toMatchObject({ canRetry: false, needsSignOut: true });

    respondWith(503, { error: 'Fleet records are temporarily unavailable. Please try again.' });
    expect(await fetchFleet().catch(describeFleetLoadFailure)).toEqual({
      message: 'Fleet records are temporarily unavailable. Please try again.',
      canRetry: true,
      needsSignOut: false,
    });
  });

  it('recognises a fleet refusal only by its marker', async () => {
    const suspended = { error: 'This fleet has been suspended.', code: 'FLEET_REFUSED' };
    expect(fleetRefusalMessage(403, suspended)).toBe('This fleet has been suspended.');
    expect(fleetRefusalMessage(403, { error: 'You do not have permission to perform this action.' })).toBeNull();
    expect(fleetRefusalMessage(401, { error: 'Authentication required. Please sign in.' })).toBeNull();
    expect(fleetRefusalMessage(403, null)).toBeNull();

    const heard: string[] = [];
    const stop = onFleetRefused((message) => heard.push(message));
    try {
      const session = currentFleetSession();
      expect(await reportIfFleetRefused(new Response(JSON.stringify(suspended), { status: 403 }), session)).toBe(true);
      const plain = new Response(JSON.stringify({ error: 'You do not have permission to perform this action.' }), { status: 403 });
      expect(await reportIfFleetRefused(plain, session)).toBe(false);
      expect(await plain.json()).toMatchObject({ error: 'You do not have permission to perform this action.' }); // body still readable
      expect(await reportIfFleetRefused(new Response('{}', { status: 200 }), session)).toBe(false);

      respondWith(403, suspended);
      await expect(saveVehicle({ vehicle_id: 'A' } as FleetVehicle)).rejects.toThrow('This fleet has been suspended.');
      respondWith(403, { error: 'You do not have permission to perform this action.' });
      await expect(saveVehicle({ vehicle_id: 'A' } as FleetVehicle)).rejects.toThrow();
    } finally {
      stop();
    }
    expect(heard).toEqual(['This fleet has been suspended.', 'This fleet has been suspended.']);
  });

  it('ignores a fleet refusal that belongs to a previous session', async () => {
    const suspended = { error: 'This fleet has been suspended.', code: 'FLEET_REFUSED' };
    const heard: string[] = [];
    const stop = onFleetRefused((message) => heard.push(message));
    try {
      let answer!: (r: Response) => void;
      vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
      const stale = saveVehicle({ vehicle_id: 'A' } as FleetVehicle).catch(() => undefined);
      beginFleetSession();
      answer(new Response(JSON.stringify(suspended), { status: 403 }));
      await stale;
      expect(heard).toEqual([]);

      const staleSession = currentFleetSession();
      beginFleetSession();
      expect(await reportIfFleetRefused(new Response(JSON.stringify(suspended), { status: 403 }), staleSession)).toBe(false);
      expect(heard).toEqual([]);

      respondWith(403, suspended);
      await expect(saveVehicle({ vehicle_id: 'A' } as FleetVehicle)).rejects.toThrow('This fleet has been suspended.');
      expect(heard).toEqual(['This fleet has been suspended.']);
    } finally {
      stop();
    }
  });

  it('passes on why a restored session was signed out', async () => {
    respondWith(200, { user: null, reason: 'This fleet has been suspended.' });
    expect(await fetchCurrentSession()).toEqual({ user: null, reason: 'This fleet has been suspended.' });
    respondWith(200, { user: null });
    expect(await fetchCurrentSession()).toEqual({ user: null });
  });

  it('always offers a way forward when any other refusal stops the fleet load', async () => {
    for (const status of [400, 404]) {
      respondWith(status, { error: 'Something went wrong.' });
      const failure = await fetchFleet().then(() => null, describeFleetLoadFailure);
      expect(failure?.canRetry || failure?.needsSignOut).toBe(true);
      expect(failure).toEqual({ message: 'Something went wrong.', canRetry: true, needsSignOut: false });
    }
  });

  it('treats an unreachable server as a connection problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await fetchFleet().catch(describeFleetLoadFailure)).toEqual({ canRetry: true, needsSignOut: false });
  });

  it('prefers the detailed message when saving a vehicle is refused', async () => {
    const vehicle = { vehicle_id: 'A B' } as FleetVehicle;
    respondWith(400, { error: 'Validation Error', message: 'vehicle_id must be 1-64 characters' });
    await expect(saveVehicle(vehicle)).rejects.toThrow('vehicle_id must be 1-64 characters');
    respondWith(400, { error: 'This fleet has reached its limit of 200 vehicles.' });
    await expect(saveVehicle(vehicle)).rejects.toThrow('This fleet has reached its limit of 200 vehicles.');
  });

  it('survives a response that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(fetchFleet()).rejects.toThrow('The server could not complete this request (502).');
  });

  it('remembers a saved diagnostic only until the fleet or user changes', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = { status: 'OK', health_score: 90, primary_diagnosis: 'Fine' } as unknown as DiagnosticResult;
    await saveDiagnostic('SAME-ID', result);
    await saveDiagnostic('SAME-ID', result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearDiagnosticHistory();
    await saveDiagnostic('SAME-ID', result);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends the chosen fleet when a developer adds a user, and none otherwise', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ temporaryPassword: 'Temp-1' }), { status: 201 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await createOperatorAccount({ name: 'A', email: 'a@example.com', role: 'technician', fleetId: 'flt_1' });
    await createOperatorAccount({ name: 'B', email: 'b@example.com', role: 'technician' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).fleetId).toBe('flt_1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).not.toHaveProperty('fleetId');
  });
});

describe('demo-only content', () => {
  it('shows the sample notifications only in a demo fleet, and real alerts everywhere', () => {
    const telemetry = { coolant_temp_c: 110 } as FleetVehicle['telemetry'];
    const ids = (demo: boolean) => buildTelemetryAlerts(telemetry, demo).map((a) => a.id);
    expect(ids(true)).toEqual(expect.arrayContaining(['sys_registration', 'sys_breakdown', 'coolant_critical']));
    expect(ids(false)).toContain('coolant_critical');
    expect(ids(false)).not.toContain('sys_registration');
    expect(ids(false)).not.toContain('sys_breakdown');
  });

  it('opens the console on a tab that exists', () => {
    expect(availableConsoleTab('telemetry_override', false)).toBe('obd_scanner');
    expect(availableConsoleTab('dtc_injector', false)).toBe('obd_scanner');
    expect(availableConsoleTab('security_shield', false)).toBe('security_shield');
    expect(availableConsoleTab('dtc_injector', true)).toBe('dtc_injector');
  });
});

describe('vehicle id rule', () => {
  it('accepts what the server accepts', () => {
    for (const id of ['TATA-4825', 'fleet_108', 'A', 'X'.repeat(64)]) {
      expect(vehicleIdError(id)).toBeNull();
      expect(validateVehiclePayload({ vehicle_id: id }).ok).toBe(true);
    }
  });

  it('refuses what the server refuses, with a clear message', () => {
    expect(vehicleIdError('')).toMatch(/enter a unique/);
    expect(vehicleIdError('X'.repeat(65))).toMatch(/64 characters/);
    for (const id of ['TATA 4825', 'A/B', 'A.B', 'टाटा']) {
      expect(vehicleIdError(id)).toMatch(/letters, numbers, hyphens and underscores/);
      expect(validateVehiclePayload({ vehicle_id: id }).ok).toBe(false);
    }
  });
});

describe('who can add staff', () => {
  const user = (role: AuthUser['role'], permissions: string[]) => ({ role, permissions }) as AuthUser;

  it('offers Fleet Owner only to a developer or a Fleet Owner', () => {
    const values = (role: AuthUser['role']) => assignableRoles(role).map((r) => r.value);
    expect(values('developer')).toContain('fleet_director');
    expect(values('fleet_director')).toContain('fleet_director');
    expect(values('fleet_manager')).not.toContain('fleet_director');
    expect(values('developer')).not.toContain('developer');
  });

  it('is for accounts in a fleet with the approval permission', () => {
    expect(canAddStaff(user('fleet_director', ['approve_access_requests']))).toBe(true);
    expect(canAddStaff(user('fleet_manager', ['approve_access_requests']))).toBe(true);
    expect(canAddStaff(user('technician', []))).toBe(false);
    expect(canAddStaff(user('developer', ['approve_access_requests']))).toBe(false);
    expect(canAddStaff(null)).toBe(false);
  });
});
