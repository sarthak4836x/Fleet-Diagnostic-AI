import { describe, it, expect, vi, beforeAll } from 'vitest';

// A shared store like Upstash: reads answer at once, every write lands 1 s after it is sent (so
// parallel requests all read before any of them has written), and increment is atomic, as INCR is.
// kind "redis" makes the server count on the store, as separate instances would.
vi.mock('../server/kvStore', () => {
  const data = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const later = <T>(fn: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(fn()), 1000));
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
        counters.delete(key);
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
    async increment(key: string, ttlSeconds: number) {
      const now = Date.now();
      const c = counters.get(key);
      const next = c && c.expiresAt > now ? { ...c, count: c.count + 1 } : { count: 1, expiresAt: now + ttlSeconds * 1000 };
      counters.set(key, next);
      return next.count;
    },
  };
  return { kv, redisKeyPrefix: () => '' };
});

import request from 'supertest';
import app from '../server';
import { isEmailTaken } from '../server/auth';

let ipCounter = 0;
const nextIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (url: string, body: object) => request(app).post(url).set('X-Forwarded-For', nextIp()).send(body);
const login = (identifier: string, password: string) => post('/api/auth/login', { identifier, password });

beforeAll(async () => {
  await isEmailTaken('nobody@example.com'); // set up the accounts before the races start
});

describe('lockout counters under parallel guesses', () => {
  it('parallel wrong passwords all count towards the lockout, and only for that account', async () => {
    const wrong = await Promise.all(Array.from({ length: 5 }, (_, i) => login('director', `Wrong-guess-${i}`)));
    expect(wrong.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    const right = await login('director', 'Test-director-1');
    expect(right.status).toBe(429);
    expect(right.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');
    // Another account's counter is untouched.
    expect((await login('manager', 'Test-manager-1')).status).toBe(200);
  });

  it('a burst of 20 parallel wrong passwords gets at most 5 password checks', async () => {
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => login('tech', `Burst-guess-${i}`)));
    const statuses = res.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(20 - statuses.filter((s) => s === 401).length);
    for (const r of res.filter((x) => x.status === 429)) {
      expect(r.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');
    }
    expect((await login('tech', 'Test-technician-1')).status).toBe(429);
  });

  it('a burst of 20 parallel wrong security answers gets at most 5 checks', async () => {
    const res = await Promise.all(
      Array.from({ length: 20 }, () => post('/api/auth/verify-security-answers', { identifier: 'manager', answers: ['a', 'b', 'c'] }))
    );
    const statuses = res.map((r) => r.status);
    expect(statuses.filter((s) => s === 400).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(20 - statuses.filter((s) => s === 400).length);
  });

  it('parallel wrong reset codes all count', async () => {
    const sent = await post('/api/auth/send-otp', { identifier: 'dispatch' });
    const code: string = sent.body.demoOtp;
    const bad = code === '000000' ? '111111' : '000000';
    const wrong = await Promise.all(Array.from({ length: 5 }, () => post('/api/auth/verify-otp', { identifier: 'dispatch', code: bad })));
    expect(wrong.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
    expect(wrong.map((r) => r.body.error).sort()).toEqual(
      [4, 3, 2, 1, 0].map((left) => `Incorrect code. ${left} attempt(s) left.`).sort()
    );
    const right = await post('/api/auth/verify-otp', { identifier: 'dispatch', code });
    expect(right.status).toBe(429);
    expect(right.body.error).toBe('Too many attempts. Request a new code.');
  });

  it('parallel wrong security answers all count', async () => {
    const wrong = await Promise.all(
      Array.from({ length: 5 }, () => post('/api/auth/verify-security-answers', { identifier: 'sarthak', answers: ['a', 'b', 'c'] }))
    );
    expect(wrong.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
    const right = await post('/api/auth/verify-security-answers', {
      identifier: 'sarthak',
      answers: ['pune engineering bay', 'patil', 'tata prima'],
    });
    expect(right.status).toBe(429);
    expect(right.body.error).toBe('Too many attempts. Try again in a few minutes.');
  });
});
