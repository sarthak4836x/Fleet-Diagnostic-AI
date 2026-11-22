import { describe, it, expect, vi, beforeAll } from 'vitest';

// A shared store like Upstash: every write lands 50 ms after it is sent, and setIfAbsent decides
// when it lands. kind "redis" makes the account code re-read on every call, as separate instances would.
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
    // Atomic, as INCR is; expiry is not needed by these tests.
    async increment(key: string) {
      const next = Number(data.get(key) ?? 0) + 1;
      data.set(key, String(next));
      return next;
    },
  };
  return { kv, redisKeyPrefix: () => '' };
});

import request from 'supertest';
import app from '../server';
import { AccountError, createAccount, isEmailTaken } from '../server/auth';
import { createFleet } from '../server/fleetStore';

let ipCounter = 0;
const nextIp = () => `10.7.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const login = (identifier: string, password: string) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier, password });

let f1: { id: string };
let f2: { id: string };
let f3: { id: string };

beforeAll(async () => {
  await isEmailTaken('nobody@example.com'); // set up the accounts before the races start
  f1 = await createFleet('Race One');
  f2 = await createFleet('Race Two');
  f3 = await createFleet('Race Three');
});

describe('accounts under concurrent writes', () => {
  it('concurrent account creation in two fleets keeps both', async () => {
    const [a, b] = await Promise.all([
      createAccount({ name: 'A', email: 'a@one.example', role: 'technician', fleetId: f1.id }),
      createAccount({ name: 'B', email: 'b@two.example', role: 'technician', fleetId: f2.id }),
    ]);
    expect(await isEmailTaken('a@one.example')).toBe(true);
    expect(await isEmailTaken('b@two.example')).toBe(true);
    expect((await login('a@one.example', a.temporaryPassword)).status).toBe(200);
    expect((await login('b@two.example', b.temporaryPassword)).status).toBe(200);
  });

  it('a failed sign-in does not erase an account created at the same moment', async () => {
    const [made, wrong] = await Promise.all([
      createAccount({ name: 'C', email: 'c@three.example', role: 'technician', fleetId: f3.id }),
      login('director', 'Wrong-password-1'),
    ]);
    expect(wrong.status).toBe(401);
    expect((await login('c@three.example', made.temporaryPassword)).status).toBe(200);
  });

  it('the same email cannot be created twice at once', async () => {
    const results = await Promise.allSettled([
      createAccount({ name: 'S1', email: 'same@race.example', role: 'technician', fleetId: f1.id }),
      createAccount({ name: 'S2', email: 'same@race.example', role: 'technician', fleetId: f2.id }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(AccountError);
    expect(rejected[0].reason.status).toBe(409);
  });
});
