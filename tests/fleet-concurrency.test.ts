import { describe, it, expect, vi, beforeAll } from 'vitest';

// A shared store like Upstash: reads answer at once and every write lands 50 ms after it is sent,
// so two changes made at the same moment both read before either has written.
vi.mock('../server/kvStore', () => {
  const data = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const later = <T>(fn: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(fn()), 50));
  const kv = {
    kind: 'redis' as const,
    async get(key: string) {
      const v = data.get(key);
      return v == null ? null : JSON.parse(v);
    },
    set: (key: string, value: unknown) => later(() => void data.set(key, JSON.stringify(value))),
    del: (key: string) =>
      later(() => {
        data.delete(key);
        sets.delete(key);
      }),
    setIfAbsent: (key: string, value: unknown) =>
      later(() => {
        if (data.has(key)) return false;
        data.set(key, JSON.stringify(value));
        return true;
      }),
    addToSet: (key: string, member: string) =>
      later(() => {
        const s = sets.get(key) ?? new Set<string>();
        s.add(member);
        sets.set(key, s);
      }),
    async getSet(key: string) {
      return [...(sets.get(key) ?? [])];
    },
    async setSize(key: string) {
      return sets.get(key)?.size ?? 0;
    },
    async increment(key: string) {
      const next = Number(data.get(key) ?? 0) + 1;
      data.set(key, String(next));
      return next;
    },
  };
  return { kv, redisKeyPrefix: () => '' };
});

import { createFleet, getFleet, getFleets, setFleetStatus } from '../server/fleetStore';

let a: { id: string };
let b: { id: string };

beforeAll(async () => {
  a = await createFleet('Parallel A');
  b = await createFleet('Parallel B');
});

describe('fleets under concurrent writes', () => {
  it('two suspensions of different fleets at the same moment both land', async () => {
    await Promise.all([setFleetStatus(a.id, 'suspended'), setFleetStatus(b.id, 'suspended')]);
    expect((await getFleet(a.id))?.status).toBe('suspended');
    expect((await getFleet(b.id))?.status).toBe('suspended');
    const listed = await getFleets();
    expect(listed.find((f) => f.id === a.id)?.status).toBe('suspended');
    expect(listed.find((f) => f.id === b.id)?.status).toBe('suspended');
  });

  it('a create and a suspend at the same moment both land', async () => {
    await setFleetStatus(a.id, 'active');
    const [made] = await Promise.all([createFleet('Parallel C'), setFleetStatus(a.id, 'suspended')]);
    expect(await getFleet(made.id)).toEqual(made);
    expect((await getFleet(a.id))?.status).toBe('suspended');
    const ids = (await getFleets()).map((f) => f.id);
    expect(ids).toContain(made.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain('flt_demo');
  });

  it('many creates at the same moment all land with different IDs', async () => {
    const made = await Promise.all(Array.from({ length: 5 }, (_, i) => createFleet(`Burst ${i}`)));
    expect(new Set(made.map((f) => f.id)).size).toBe(5);
    const ids = (await getFleets()).map((f) => f.id);
    for (const f of made) expect(ids).toContain(f.id);
  });
});
