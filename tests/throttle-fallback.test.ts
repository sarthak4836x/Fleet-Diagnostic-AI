import { describe, it, expect, vi, beforeAll } from 'vitest';

// A shared store whose counter call always fails (e.g. Redis rejecting the script) while plain reads
// and writes work. Sign-in, reset codes and the lockout must keep working by counting in this process.
vi.mock('../server/kvStore', async () => {
  const actual = await vi.importActual<typeof import('../server/kvStore')>('../server/kvStore');
  const inner = actual.memoryStore();
  const kv = {
    ...inner,
    kind: 'redis' as const,
    increment: async () => {
      throw new Error('Redis EVAL (increment) failed: ERR unknown command');
    },
  };
  return { ...actual, kv };
});

import request from 'supertest';
import app from '../server';
import { isEmailTaken } from '../server/auth';

let ipCounter = 0;
const nextIp = () => `10.11.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (url: string, body: object) => request(app).post(url).set('X-Forwarded-For', nextIp()).send(body);
const login = (identifier: string, password: string) => post('/api/auth/login', { identifier, password });

beforeAll(async () => {
  await isEmailTaken('nobody@example.com');
});

describe('when the counter call fails', () => {
  it('a wrong password still counts and the account still locks', async () => {
    const warn = vi.spyOn(console, 'warn');
    for (let i = 0; i < 5; i++) expect((await login('director', `Wrong-${i}`)).status).toBe(401);
    const right = await login('director', 'Test-director-1');
    expect(right.status).toBe(429);
    expect(right.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');
    expect(warn.mock.calls.some(([m]) => String(m).startsWith('[auth] Counter store unavailable'))).toBe(true);
    warn.mockRestore();
  });

  it('if the lock write fails too, this process still keeps the lock', async () => {
    const { kv } = await import('../server/kvStore');
    const realSet = kv.set.bind(kv);
    const spy = vi.spyOn(kv, 'set').mockImplementation(((key: string, ...rest: unknown[]) =>
      key.startsWith('fleetdiag_user_login_lock_v3:')
        ? Promise.reject(new Error('Redis SET failed (503)'))
        : (realSet as any)(key, ...rest)) as typeof kv.set);
    try {
      for (let i = 0; i < 5; i++) expect((await login('tech', `Wrong-${i}`)).status).toBe(401);
      expect((await login('tech', 'Test-technician-1')).status).toBe(429);
    } finally {
      spy.mockRestore();
    }
  });

  it('a correct password on an account that is not locked still signs in', async () => {
    expect((await login('manager', 'Test-manager-1')).status).toBe(200);
  });

  it('a correct reset code still works, and wrong codes are still limited', async () => {
    const sent = await post('/api/auth/send-otp', { identifier: 'dispatch' });
    const code: string = sent.body.demoOtp;
    const good = await post('/api/auth/verify-otp', { identifier: 'dispatch', code });
    expect(good.status).toBe(200);

    const again = await post('/api/auth/send-otp', { identifier: 'dispatch' });
    const bad = again.body.demoOtp === '000000' ? '111111' : '000000';
    const wrong = [];
    for (let i = 0; i < 5; i++) wrong.push((await post('/api/auth/verify-otp', { identifier: 'dispatch', code: bad })).body.error);
    expect(wrong).toEqual([4, 3, 2, 1, 0].map((n) => `Incorrect code. ${n} attempt(s) left.`));
    const sixth = await post('/api/auth/verify-otp', { identifier: 'dispatch', code: again.body.demoOtp });
    expect(sixth.status).toBe(429);
  });
});
