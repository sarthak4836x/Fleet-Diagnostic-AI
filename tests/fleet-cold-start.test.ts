import { describe, it, expect, vi, afterEach } from 'vitest';

// One store shared by every module reset in this file, so a reset behaves like a new instance
// (a cold start) reading the same Redis, as in a rolling deploy or a rollback.
const shared = vi.hoisted(() => ({ kv: null as any }));
vi.mock('../server/kvStore', async () => {
  const actual = await vi.importActual<typeof import('../server/kvStore')>('../server/kvStore');
  shared.kv ??= actual.memoryStore();
  return { ...actual, kv: shared.kv };
});

/** The shared store (importing the mocked module creates it on first use). */
async function store() {
  return (await import('../server/kvStore')).kv;
}

async function coldStart() {
  vi.resetModules();
  return import('../server/fleetStore');
}

const OLD_FLEETS = 'fleetdiag_fleets_v1';
const fleet = (id: string, name: string, status = 'active') => ({
  id,
  name,
  status,
  isDemo: false,
  createdAt: `2026-01-0${id.slice(-1)}T00:00:00.000Z`,
});

afterEach(() => vi.restoreAllMocks());

describe('fleets written to the old list after migration', () => {
  it('a cold start copies fleets missing from v2, and never overwrites an existing record', async () => {
    await (await store()).set(OLD_FLEETS, [fleet('flt_c0ld01', 'First Co', 'suspended')]);
    const first = await coldStart();
    expect((await first.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_c0ld01']);
    await first.setFleetStatus('flt_c0ld01', 'active'); // changed in v2 after migration

    // An instance still running the old code (rolling deploy or rollback) adds a fleet to v1 only.
    await (await store()).set(OLD_FLEETS, [fleet('flt_c0ld01', 'First Co', 'suspended'), fleet('flt_c0ld02', 'Second Co')]);
    // The same instance does not look again; it re-checks once per cold start.
    expect((await first.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_c0ld01']);

    const second = await coldStart();
    expect((await second.getFleets()).map((f) => f.id)).toEqual(['flt_demo', 'flt_c0ld01', 'flt_c0ld02']);
    expect((await second.getFleet('flt_c0ld02'))?.name).toBe('Second Co');
    expect((await second.getFleet('flt_c0ld01'))?.status).toBe('active'); // not overwritten from v1
    expect(await (await store()).get(OLD_FLEETS)).toHaveLength(2); // v1 is still never written
  });

  it('a corrupt old list after migration is logged, not fatal', async () => {
    await (await store()).set(OLD_FLEETS, { corrupt: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const third = await coldStart();
    expect((await third.getFleets()).map((f) => f.id)).toContain('flt_c0ld02');
    expect(warn.mock.calls.some(([m]) => String(m).includes('fleetdiag_fleets_v1'))).toBe(true);
  });

  it('a re-check that throws is logged once, and fleets and sign-in keep working', async () => {
    const kv = await store();
    const realGet = kv.get.bind(kv);
    let oldListReads = 0;
    // The old list cannot be read at all (not JSON, wrong Redis type, or the store call failing).
    vi.spyOn(kv, 'get').mockImplementation(((key: string) => {
      if (key !== OLD_FLEETS) return realGet(key);
      oldListReads += 1;
      return Promise.reject(new Error('WRONGTYPE Operation against a key'));
    }) as typeof kv.get);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    const fleets = await import('../server/fleetStore');
    const app = (await import('../server')).default;
    const request = (await import('supertest')).default;

    expect((await fleets.getFleet('flt_c0ld02'))?.name).toBe('Second Co');
    expect((await fleets.getFleet('flt_demo'))?.isDemo).toBe(true);
    const signIn = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.12.0.1')
      .send({ identifier: 'director', password: 'Test-director-1' });
    expect(signIn.status).toBe(200);
    await fleets.getFleets();
    expect(oldListReads).toBe(1); // done for this process, not retried on every request
    expect(warn.mock.calls.some(([m]) => String(m).includes('may be missing'))).toBe(true);
  });
});
