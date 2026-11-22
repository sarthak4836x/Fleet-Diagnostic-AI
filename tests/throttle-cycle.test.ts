import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// Counting works, but every way of clearing an attempt counter fails (both the delete and the
// reset to 0). The lockout must still end on time: a stuck count may never lock the account again
// once its lock has run out, whatever the cleanup calls did.
vi.mock('../server/kvStore', async () => {
  const actual = await vi.importActual<typeof import('../server/kvStore')>('../server/kvStore');
  const inner = actual.memoryStore();
  const failsFor = (key: string) => key.includes('_fails_v3:') || key.includes('_attempts_v3:');
  const kv = {
    ...inner,
    kind: 'redis' as const,
    del: async (key: string) => {
      if (failsFor(key)) throw new Error('Redis DEL failed (503)');
      return inner.del(key);
    },
    resetCounter: async (key: string, ttl: number) => {
      if (failsFor(key)) throw new Error('Redis SET failed (503)');
      return inner.resetCounter(key, ttl);
    },
  };
  return { ...actual, kv };
});

import request from 'supertest';
import app from '../server';
import { isEmailTaken } from '../server/auth';

let ipCounter = 0;
const nextIp = () => `10.14.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (url: string, body: object) => request(app).post(url).set('X-Forwarded-For', nextIp()).send(body);
const login = (identifier: string, password: string) => post('/api/auth/login', { identifier, password });

const START = new Date('2026-11-15T10:00:00.000Z').getTime();
const at = (ms: number) => vi.setSystemTime(START + ms);
const MIN = 60 * 1000;

beforeAll(async () => {
  await isEmailTaken('nobody@example.com');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('when the delete and the reset of an attempt counter both fail', () => {
  it('a correct password is accepted as soon as the lock has expired', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    at(0);
    for (let i = 0; i < 5; i++) expect((await login('director', `Wrong-${i}-c`)).status).toBe(401);
    expect((await login('director', 'Test-director-1')).status).toBe(429);
    at(4 * MIN);
    expect((await login('director', 'Test-director-1')).status).toBe(429); // still locked
    at(5 * MIN + 1000);
    expect((await login('director', 'Test-director-1')).status).toBe(200);
  });

  it('and still once the lock key itself has gone from the store', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    at(20 * MIN);
    for (let i = 0; i < 5; i++) expect((await login('manager', `Wrong-${i}-d`)).status).toBe(401);
    expect((await login('manager', 'Test-manager-1')).status).toBe(429);
    at(20 * MIN + 7 * MIN); // past the lock key's own expiry (lock + 1 minute)
    expect((await login('manager', 'Test-manager-1')).status).toBe(200);
  });

  it('a stuck count never outlives a lock on the security questions either', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    at(40 * MIN);
    const verify = (answers: string[]) => post('/api/auth/verify-security-answers', { identifier: 'sarthak', answers });
    for (let i = 0; i < 5; i++) expect((await verify(['x', 'y', `z${i}`])).status).toBe(400);
    const right = ['pune engineering bay', 'patil', 'tata prima'];
    expect((await verify(right)).status).toBe(429);
    at(40 * MIN + 5 * MIN + 1000);
    expect((await verify(right)).status).toBe(200);
  });

  it('a new reset code gets fresh attempts even though the old count could not be cleared', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = await post('/api/auth/send-otp', { identifier: 'tech' });
    const bad = first.body.demoOtp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/verify-otp', { identifier: 'tech', code: bad })).status).toBe(400);
    expect((await post('/api/auth/verify-otp', { identifier: 'tech', code: first.body.demoOtp })).status).toBe(429);
    const second = await post('/api/auth/send-otp', { identifier: 'tech' });
    expect((await post('/api/auth/verify-otp', { identifier: 'tech', code: second.body.demoOtp })).status).toBe(200);
  });
});
