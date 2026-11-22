import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../server';
import { kv } from '../server/kvStore';
import { getStoredHistory, getStoredVehicles, saveStoredVehicle } from '../server/fleetStore';
import { requireFleet } from '../server/fleetAccess';

let ipCounter = 100;
const nextIp = () => `10.2.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (agent: ReturnType<typeof request.agent>) => ({
  get: (url: string) => agent.get(url).set('X-Forwarded-For', nextIp()),
  post: (url: string, body: unknown = {}) => agent.post(url).set('X-Forwarded-For', nextIp()).send(body as object),
});

type Agent = ReturnType<typeof request.agent>;

async function loginAs(identifier: string, password: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await call(agent).post('/api/auth/login', { identifier, password });
  expect(res.status, `login ${identifier}`).toBe(200);
  return agent;
}

const VEHICLE = {
  vehicle_id: 'X',
  unit_name: 'Unit',
  make_model: 'Test Truck',
  location: 'NH-44',
  engine_hours: 100,
  coordinates: { lat: 18.5, lng: 73.8 },
  telemetry: {},
};

let dev: Agent;
let director: Agent;
let ownerA: Agent;
let ownerB: Agent;
let fleetA: any;
let fleetB: any;

async function newFleet(name: string, email: string) {
  const res = await call(dev).post('/api/fleets', { name, ownerName: 'Owner', ownerEmail: email });
  expect(res.status).toBe(201);
  return { fleet: res.body.fleet, owner: await loginAs(email, res.body.temporaryPassword) };
}

beforeAll(async () => {
  dev = await loginAs('sarthak', 'Test-developer-1');
  director = await loginAs('director', 'Test-director-1');
  ({ fleet: fleetA, owner: ownerA } = await newFleet('Fleet A', 'a@fleets.example'));
  ({ fleet: fleetB, owner: ownerB } = await newFleet('Fleet B', 'b@fleets.example'));
  expect((await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'A-1', unit_name: 'Unit A1' })).status).toBe(201);
  expect((await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'SHARED', unit_name: 'Unit A' })).status).toBe(201);
  expect((await call(ownerB).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'SHARED', unit_name: 'Unit B' })).status).toBe(201);
});

afterEach(() => vi.restoreAllMocks());

describe('fleet isolation on data routes', () => {
  it('lists only the signed-in fleet', async () => {
    const res = await call(ownerA).get('/api/fleet');
    expect(res.body.presets.map((v: any) => v.vehicle_id).sort()).toEqual(['A-1', 'SHARED']);
    expect(res.body.initialMock).toBeNull();
  });

  it('still gives the Demo fleet its sample vehicles and initial snapshot', async () => {
    const res = await call(director).get('/api/fleet');
    expect(res.body.presets.map((v: any) => v.vehicle_id)).toContain('TATA-PRIMA-5530');
    expect(res.body.initialMock).toBeTruthy();
  });

  it.each([
    ['/api/diagnose', { vehicle_id: 'A-1', telemetry: {} }],
    ['/api/fuel-efficiency', { vehicle_id: 'A-1', telemetry: {} }],
    ['/api/predictive-maintenance', { vehicle_id: 'A-1' }],
    ['/api/predictive', { vehicle_id: 'A-1' }],
    ['/api/technical-query', { question: 'Why?', snapshot: { vehicle_id: 'A-1', telemetry: {} } }],
    ['/api/backup/record', { type: 'diagnostic', data: { id: 'x', vehicle_id: 'A-1' } }],
  ])('%s treats another fleet like a vehicle that does not exist', async (url, body) => {
    const foreign = await call(ownerB).post(url, body);
    const missing = await call(ownerB).post(url, JSON.parse(JSON.stringify(body).replaceAll('A-1', 'NOPE')));
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect((await call(ownerA).post(url, body)).status).toBeLessThan(300);
  });

  it.each(['/api/diagnose', '/api/fuel-efficiency', '/api/predictive'])('%s needs a vehicle', async (url) => {
    expect((await call(ownerA).post(url, {})).status).toBe(400);
  });

  it('technical query needs a vehicle', async () => {
    expect((await call(ownerA).post('/api/technical-query', { question: 'Why?' })).status).toBe(400);
  });

  it('ignores a fleet_id from the browser, including on echo-back', async () => {
    const res = await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'A-2', fleet_id: fleetB.id });
    expect(res.status).toBe(201);
    expect(res.body.vehicle.fleet_id).toBe(fleetA.id);
    const list = (await call(ownerA).get('/api/fleet')).body.presets;
    const again = list.find((v: any) => v.vehicle_id === 'A-2');
    expect((await call(ownerA).post('/api/vehicles', again)).status).toBe(200);
  });

  it('does not let a fleet change its neighbour using a shared vehicle_id', async () => {
    await call(ownerA).post('/api/vehicles', { vehicle_id: 'SHARED', unit_name: 'Changed by A' });
    const b = (await call(ownerB).get('/api/fleet')).body.presets.find((v: any) => v.vehicle_id === 'SHARED');
    expect(b.unit_name).toBe('Unit B');
  });

  it('ignores a fleet_id on backup records and stores them in the session fleet', async () => {
    const res = await call(ownerA).post('/api/backup/record', { type: 'work_order', data: { id: 'WO-1', fleet_id: fleetB.id } });
    expect(res.status).toBe(200);
    expect((await getStoredHistory(fleetA.id)).workOrders.map((w: any) => [w.id, w.fleet_id])).toEqual([['WO-1', fleetA.id]]);
    expect((await getStoredHistory(fleetB.id)).workOrders).toEqual([]);
  });

  it('does not share cached AI results between fleets', async () => {
    const snap = { vehicle_id: 'SHARED', engine_hours: 10, telemetry: { coolant_temp_c: 91 } };
    for (const url of ['/api/diagnose', '/api/fuel-efficiency']) {
      await call(ownerA).post(url, snap);
      expect((await call(ownerB).post(url, snap)).body._cached, url).toBeFalsy();
    }
    await call(ownerA).post('/api/predictive', { vehicle_id: 'SHARED' });
    expect((await call(ownerB).post('/api/predictive', { vehicle_id: 'SHARED' })).body._cached).toBeFalsy();
  });

  it('enforces the 200-vehicle limit per fleet', async () => {
    const { fleet, owner } = await newFleet('Fleet C', 'c@fleets.example');
    for (let i = 0; i < 200; i++) await saveStoredVehicle(fleet.id, { ...VEHICLE, vehicle_id: `C-${i}` });
    const res = await call(owner).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'C-NEW' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This fleet has reached its limit of 200 vehicles.');
  });

  it('logs the cause when requireFleet cannot read the fleet', async () => {
    const failure = new Error('store down');
    vi.spyOn(kv, 'get').mockRejectedValue(failure);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireFleet({ user: { fleetId: 'flt_any' } } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith(expect.any(String), failure);
  });

  it('answers 503, not an empty fleet, when a customer store read fails', async () => {
    const realGet = kv.get.bind(kv);
    vi.spyOn(kv, 'get').mockImplementation(((key: string) =>
      key === `fleetdiag_fleet_records_v1:${fleetA.id}` ? Promise.reject(new Error('store down')) : realGet(key)) as typeof kv.get);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call(ownerA).get('/api/fleet')).status).toBe(503);
  });

  it('a failed read of the fleet record answers 500 or 503, never a 403 refusal', async () => {
    const realGet = kv.get.bind(kv);
    vi.spyOn(kv, 'get').mockImplementation(((key: string) =>
      key === `fleetdiag_fleet_v2:${fleetA.id}` ? Promise.reject(new Error('store down')) : realGet(key)) as typeof kv.get);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const url of ['/api/fleet', '/api/auth/me']) {
      const res = await call(ownerA).get(url);
      expect([500, 503], url).toContain(res.status);
      expect(res.body.code, url).toBeUndefined();
      expect(res.body.user, url).toBeUndefined(); // never treated as signed out
    }
  });

  it('makes backup status developer-only', async () => {
    expect((await call(ownerA).get('/api/backup/status')).status).toBe(403);
    expect((await call(dev).get('/api/backup/status')).status).toBe(200);
  });

  it('a developer sees only the active fleet', async () => {
    await call(dev).post('/api/fleets/active', { fleetId: fleetA.id });
    const ids = (await call(dev).get('/api/fleet')).body.presets.map((v: any) => v.vehicle_id);
    expect(ids).toContain('A-1');
    expect(ids).not.toContain('TATA-PRIMA-5530');
    await call(dev).post('/api/fleets/active', { fleetId: 'flt_demo' });
  });

  it('a restored snapshot does not put a customer vehicle into the Demo fleet', async () => {
    await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'RESTORE-ME' });
    const created = await call(dev).post('/api/backup/create', { reason: 'fleet test' });
    const restored = await call(dev).post('/api/backup/restore', { filename: created.body.snapshot.filename });
    expect(restored.body.success).toBe(true);
    const ids = (await call(director).get('/api/fleet')).body.presets.map((v: any) => v.vehicle_id);
    expect(ids).not.toContain('RESTORE-ME');
    expect(ids).toContain('TATA-PRIMA-5530');
  });

  it('keeps customer records out of the backup replica but in the store', async () => {
    await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'REPLICA-A' });
    await call(ownerA).post('/api/backup/record', { type: 'diagnostic', data: { id: 'D-REPLICA', vehicle_id: 'REPLICA-A' } });
    await call(ownerA).post('/api/backup/record', { type: 'work_order', data: { id: 'WO-REPLICA', vehicle_id: 'REPLICA-A' } });
    const exported = JSON.stringify((await call(dev).get('/api/backup/export')).body);
    for (const marker of ['REPLICA-A', 'D-REPLICA', 'WO-REPLICA']) expect(exported).not.toContain(marker);
    expect((await getStoredVehicles(fleetA.id)).map((v: any) => v.vehicle_id)).toContain('REPLICA-A');
    const history = await getStoredHistory(fleetA.id);
    expect(history.diagnostics.map((d: any) => d.id)).toContain('D-REPLICA');
    expect(history.workOrders.map((w: any) => w.id)).toContain('WO-REPLICA');
  });

  it('a customer reusing a Demo vehicle_id cannot change the Demo vehicle through a restore', async () => {
    const res = await call(ownerA).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'TATA-PRIMA-5530', customer_secret: 'leak' });
    expect(res.status).toBe(201);
    const created = await call(dev).post('/api/backup/create', { reason: 'collision test' });
    expect((await call(dev).post('/api/backup/restore', { filename: created.body.snapshot.filename })).body.success).toBe(true);
    const demo = (await call(director).get('/api/fleet')).body.presets.find((v: any) => v.vehicle_id === 'TATA-PRIMA-5530');
    expect(demo).toBeTruthy();
    expect(demo.customer_secret).toBeUndefined();
    expect(demo.fleet_id).toBe('flt_demo');
  });

  it('keeps backing up Demo fleet records', async () => {
    await call(director).post('/api/vehicles', { ...VEHICLE, vehicle_id: 'DEMO-REPLICA' });
    await call(director).post('/api/backup/record', { type: 'diagnostic', data: { id: 'D-DEMO-REPLICA', vehicle_id: 'DEMO-REPLICA' } });
    const exported = (await call(dev).get('/api/backup/export')).body;
    expect(exported.vehicles.map((v: any) => v.vehicle_id)).toContain('DEMO-REPLICA');
    expect(exported.diagnostics.map((d: any) => d.id)).toContain('D-DEMO-REPLICA');
  });
});
