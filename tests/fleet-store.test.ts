import { describe, it, expect, vi } from 'vitest';
import { kv } from '../server/kvStore';
import {
  DEMO_FLEET_ID,
  createFleet,
  getFleets,
  getStoredHistory,
  getStoredVehicles,
  isRecordTooLarge,
  migrateFleetData,
  saveStoredDiagnostic,
  saveStoredVehicle,
  saveStoredWorkOrder,
  setFleetStatus,
} from '../server/fleetStore';

describe('fleet store', () => {
  it('keeps one copy of a vehicle, newest first', async () => {
    await saveStoredVehicle('flt_t', { vehicle_id: 'A', health_score: 50 });
    await saveStoredVehicle('flt_t', { vehicle_id: 'B', health_score: 60 });
    await saveStoredVehicle('flt_t', { vehicle_id: 'A', health_score: 70 });
    const vehicles = await getStoredVehicles('flt_t');
    expect(vehicles.map((v) => v.vehicle_id)).toEqual(['A', 'B']);
    expect(vehicles[0].health_score).toBe(70);
  });

  it('caps history so one key cannot grow forever', async () => {
    for (let i = 0; i < 205; i++) await saveStoredDiagnostic('flt_t', { id: `d-${i}` });
    const { diagnostics } = await getStoredHistory('flt_t');
    expect(diagnostics).toHaveLength(200);
    expect(diagnostics[0].id).toBe('d-204');
  });

  it('updates a work order instead of duplicating it', async () => {
    await saveStoredWorkOrder('flt_t', { id: 'WO-1', status: 'OPEN' });
    await saveStoredWorkOrder('flt_t', { id: 'WO-1', status: 'COMPLETED' });
    const { workOrders } = await getStoredHistory('flt_t');
    expect(workOrders).toEqual([{ id: 'WO-1', status: 'COMPLETED', fleet_id: 'flt_t' }]);
  });

  it('flags records that are too large to store', () => {
    expect(isRecordTooLarge({ a: 'x'.repeat(100) })).toBe(false);
    expect(isRecordTooLarge({ a: 'x'.repeat(30_000) })).toBe(true);
  });

  it('keeps fleets apart, including the same vehicle_id', async () => {
    await saveStoredVehicle('flt_a', { vehicle_id: 'X', health_score: 1 });
    await saveStoredVehicle('flt_b', { vehicle_id: 'X', health_score: 2 });
    expect((await getStoredVehicles('flt_a'))[0].health_score).toBe(1);
    expect((await getStoredVehicles('flt_b'))[0].fleet_id).toBe('flt_b');
  });

  it('applies the history limit per fleet', async () => {
    await saveStoredDiagnostic('flt_keep', { id: 'keep' });
    for (let i = 0; i < 205; i++) await saveStoredDiagnostic('flt_busy', { id: `d-${i}` });
    expect((await getStoredHistory('flt_keep')).diagnostics).toHaveLength(1);
    expect((await getStoredHistory('flt_busy')).diagnostics).toHaveLength(200);
  });

  it('migrates old records into the Demo fleet, twice safely, leaving the old key', async () => {
    const old = { vehicles: [{ vehicle_id: 'OLD' }], workOrders: [{ id: 'W' }], diagnostics: [{ id: 'D' }] };
    await kv.set('fleetdiag_records_v1', old);
    await migrateFleetData();
    await saveStoredVehicle(DEMO_FLEET_ID, { vehicle_id: 'NEW' });
    await migrateFleetData();
    const ids = (await getStoredVehicles(DEMO_FLEET_ID)).map((v) => v.vehicle_id);
    expect(ids).toEqual(['NEW', 'OLD']);
    expect((await getStoredHistory(DEMO_FLEET_ID)).workOrders[0].fleet_id).toBe(DEMO_FLEET_ID);
    expect(await kv.get('fleetdiag_records_v1')).toEqual(old);
    expect((await getFleets()).filter((f) => f.isDemo)).toHaveLength(1);
  });

  it('creates fleets with unique IDs and updates status', async () => {
    const f = await createFleet('Acme');
    expect(f).toMatchObject({ name: 'Acme', status: 'active', isDemo: false });
    expect(f.id).toMatch(/^flt_[0-9a-f]{6}$/);
    expect((await setFleetStatus(f.id, 'suspended'))?.status).toBe('suspended');
    expect(await setFleetStatus('flt_none', 'suspended')).toBeNull();
  });
});

/** A fresh store and fleet module, as a newly started instance would have. */
async function freshInstance() {
  vi.resetModules();
  const { kv: freshKv } = await import('../server/kvStore');
  const store = await import('../server/fleetStore');
  return { freshKv, store };
}

const OLD_FLEETS = 'fleetdiag_fleets_v1';
const READY = 'fleetdiag_fleets_v2_ready';
const oldFleet = {
  id: 'flt_0ld001',
  name: 'Old Co',
  status: 'suspended',
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('fleet list migration', () => {
  it('moves the old list into one record per fleet, twice safely, leaving the old key', async () => {
    const { freshKv, store } = await freshInstance();
    await freshKv.set(OLD_FLEETS, [oldFleet]);
    await store.migrateFleetData();
    expect((await store.getFleets()).map((f) => [f.id, f.name, f.status])).toEqual([
      ['flt_demo', 'Demo Fleet', 'active'],
      ['flt_0ld001', 'Old Co', 'suspended'],
    ]);
    expect(await store.getFleet('flt_0ld001')).toEqual(oldFleet);

    // A change made after the first run survives a second run.
    await store.setFleetStatus('flt_0ld001', 'active');
    await freshKv.del(READY);
    await store.migrateFleetData();
    expect((await store.getFleet('flt_0ld001'))?.status).toBe('active');
    expect((await store.getFleets()).filter((f) => f.isDemo)).toHaveLength(1);
    expect(await freshKv.get(OLD_FLEETS)).toEqual([oldFleet]); // read, never written
    vi.resetModules();
  });

  it('two instances migrating at once agree', async () => {
    const { freshKv, store } = await freshInstance();
    await freshKv.set(OLD_FLEETS, [oldFleet]);
    await Promise.all([store.migrateFleetData(), store.migrateFleetData(), store.getFleets()]);
    expect((await store.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_0ld001']);
    vi.resetModules();
  });

  it('an interrupted migration completes without overwriting a record changed since', async () => {
    const { freshKv, store } = await freshInstance();
    await freshKv.set(OLD_FLEETS, [oldFleet, { ...oldFleet, id: 'flt_0ld002', name: 'Second Co' }]);
    // The first run copied Old Co, which was reactivated before the run was finished.
    await freshKv.setIfAbsent('fleetdiag_fleet_v2:flt_0ld001', { ...oldFleet, status: 'active' });
    await store.migrateFleetData();
    expect((await store.getFleet('flt_0ld001'))?.status).toBe('active');
    expect((await store.getFleet('flt_0ld002'))?.name).toBe('Second Co');
    expect((await store.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_0ld001', 'flt_0ld002']);
    vi.resetModules();
  });

  it('with no old list there is just the Demo fleet', async () => {
    const { store } = await freshInstance();
    expect(await store.getFleets()).toEqual([
      { id: 'flt_demo', name: 'Demo Fleet', status: 'active', isDemo: true, createdAt: new Date(0).toISOString() },
    ]);
    vi.resetModules();
  });

  it('a corrupt old list throws instead of resetting to the Demo fleet alone', async () => {
    const { freshKv, store } = await freshInstance();
    await freshKv.set(OLD_FLEETS, { corrupt: true });
    await expect(store.getFleets()).rejects.toThrow();
    await expect(store.getFleet('flt_demo')).rejects.toThrow();
    await expect(store.createFleet('Too Soon')).rejects.toThrow();
    expect(await freshKv.get(READY)).toBeNull();
    expect(await freshKv.getSet('fleetdiag_fleet_ids_v2')).toEqual([]);
    expect(await freshKv.get(OLD_FLEETS)).toEqual({ corrupt: true });

    await freshKv.set(OLD_FLEETS, [{ name: 'no id' }]);
    await expect(store.getFleets()).rejects.toThrow();
    expect(await freshKv.get(READY)).toBeNull();

    // Once the value is repaired the next call migrates.
    await freshKv.set(OLD_FLEETS, [oldFleet]);
    expect((await store.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_0ld001']);
    vi.resetModules();
  });

  it('a first migration whose old-list read fails still fails closed', async () => {
    const { freshKv, store } = await freshInstance();
    const realGet = freshKv.get.bind(freshKv);
    const spy = vi.spyOn(freshKv, 'get').mockImplementation(((key: string) =>
      key === OLD_FLEETS ? Promise.reject(new Error('WRONGTYPE')) : realGet(key)) as typeof freshKv.get);
    try {
      await expect(store.migrateFleetData()).rejects.toThrow('WRONGTYPE');
      await expect(store.getFleet('flt_demo')).rejects.toThrow('WRONGTYPE');
    } finally {
      spy.mockRestore();
    }
    expect(await freshKv.get(READY)).toBeNull();
    vi.resetModules();
  });

  it('the Demo fleet is always there, even if its record goes missing', async () => {
    const { freshKv, store } = await freshInstance();
    await store.getFleets();
    await freshKv.del('fleetdiag_fleet_v2:flt_demo');
    const demo = { id: 'flt_demo', name: 'Demo Fleet', status: 'active', isDemo: true, createdAt: new Date(0).toISOString() };
    expect(await store.getFleet('flt_demo')).toEqual(demo);
    expect((await store.getFleets())[0]).toEqual(demo);
    vi.resetModules();
  });

  it('the store itself refuses to change the Demo fleet', async () => {
    const { store } = await freshInstance();
    expect(await store.setFleetStatus('flt_demo', 'suspended')).toBeNull();
    expect((await store.getFleet('flt_demo'))?.status).toBe('active');
    vi.resetModules();
  });

  it('reads one fleet with one store read, and never by a look-alike ID', async () => {
    const { freshKv, store } = await freshInstance();
    const made = await store.createFleet('Single Read Co');
    const spy = vi.spyOn(freshKv, 'get');
    try {
      expect(await store.getFleet(made.id)).toEqual(made);
      expect(spy.mock.calls.map(([key]) => key)).toEqual([`fleetdiag_fleet_v2:${made.id}`]);
    } finally {
      spy.mockRestore();
    }
    await freshKv.set('fleetdiag_fleet_v2:flt_alias', made); // a record stored under the wrong ID
    expect(await store.getFleet('flt_alias')).toBeNull();
    vi.resetModules();
  });
});
