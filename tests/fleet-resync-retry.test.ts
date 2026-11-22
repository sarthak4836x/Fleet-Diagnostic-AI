import { describe, it, expect, vi, afterAll } from 'vitest';

// The cold-start re-check of the old fleet list fails. It is tried again later in the same process,
// at most once a minute and never by a request waiting on it, until it succeeds; then never again.
vi.mock('../server/kvStore', async () => {
  const actual = await vi.importActual<typeof import('../server/kvStore')>('../server/kvStore');
  return { ...actual, kv: actual.memoryStore() };
});

import { kv } from '../server/kvStore';

const OLD_FLEETS = 'fleetdiag_fleets_v1';
const START = new Date('2026-11-15T10:00:00.000Z').getTime();
const at = (ms: number) => vi.setSystemTime(START + ms);
const fleet = (id: string, name: string) => ({ id, name, status: 'active', isDemo: false, createdAt: '2026-01-01T00:00:00.000Z' });

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a failed cold-start re-check of the old fleet list', () => {
  it('is retried after a minute, not before, and stops once it succeeds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at(0);
    // First instance migrates, so the next one only re-checks.
    await (await import('../server/fleetStore')).getFleets();
    await kv.set(OLD_FLEETS, [fleet('flt_retry1', 'Retry Co')]);

    let failing = true;
    let oldListReads = 0;
    const realGet = kv.get.bind(kv);
    vi.spyOn(kv, 'get').mockImplementation(((key: string) => {
      if (key !== OLD_FLEETS) return realGet(key);
      oldListReads += 1;
      return failing ? Promise.reject(new Error('Redis GET failed (503)')) : realGet(key);
    }) as typeof kv.get);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.resetModules();
    const fleets = await import('../server/fleetStore');
    const ids = async () => (await fleets.getFleets()).map((f) => f.id);

    expect(await ids()).toEqual(['flt_demo']); // the request is answered; the re-check failed
    expect(oldListReads).toBe(1);

    // Not before the interval, however many requests come in.
    at(30 * 1000);
    for (let i = 0; i < 5; i++) await ids();
    at(59 * 1000);
    await ids();
    expect(oldListReads).toBe(1);

    // After it: one more try, still failing, and the request is not failed by it.
    at(61 * 1000);
    expect(await ids()).toEqual(['flt_demo']);
    await vi.waitFor(() => expect(oldListReads).toBe(2));
    for (let i = 0; i < 5; i++) await ids();
    expect(oldListReads).toBe(2);

    // The store recovers: the next try (a minute after the last) copies the missing fleet.
    failing = false;
    at(122 * 1000);
    await ids();
    await vi.waitFor(() => expect(oldListReads).toBe(3));
    await vi.waitFor(async () => expect(await ids()).toEqual(['flt_demo', 'flt_retry1']));

    // Done: never again in this process.
    for (const later of [200, 400, 3600]) {
      at(later * 1000);
      await ids();
    }
    await new Promise((r) => setTimeout(r, 20));
    expect(oldListReads).toBe(3);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('may be missing')).length).toBe(2);
  });
});
