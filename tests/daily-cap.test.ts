import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import { createAccount, isEmailTaken } from '../server/auth';
import { DEMO_FLEET_ID } from '../server/fleetStore';

// A guesser who paces 4 wrong tries per 4 minutes never fills the short counter. A second count,
// kept for a day and only added to once a wrong password is confirmed, ends that at 20 with a
// one-hour lock. It is only consulted for wrong passwords, so it never refuses a right one by itself.
let ipCounter = 0;
const nextIp = () => `10.16.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (url: string, body: object, cookie?: string) => {
  const r = request(app).post(url).set('X-Forwarded-For', nextIp());
  if (cookie) r.set('Cookie', cookie);
  return r.send(body);
};
const login = (identifier: string, password: string, cookie?: string) => post('/api/auth/login', { identifier, password }, cookie);

const MIN = 60 * 1000;
let clock = new Date('2026-11-16T08:00:00.000Z').getTime();
const advance = (ms: number) => {
  clock += ms;
  vi.setSystemTime(clock);
};

/** n wrong tries, 4 at a time, a little over 4 minutes apart, so the short counter never reaches 5. */
async function paced(n: number, attempt: (i: number) => Promise<number>, wrongStatus = 401) {
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 4 === 0) advance(4 * MIN + 1000);
    expect(await attempt(i), `wrong try ${i + 1}`).toBe(wrongStatus);
  }
}
const wrongLogin = (who: string, cookie?: string) => async (i: number) => (await login(who, `Paced-guess-${i}-x`, cookie)).status;

let n = 0;
async function freshAccount() {
  const { user, temporaryPassword } = await createAccount({
    name: `Daily ${++n}`,
    email: `daily-${n}@example.com`,
    role: 'technician',
    fleetId: DEMO_FLEET_ID,
  });
  return { email: user.email, password: temporaryPassword };
}

beforeAll(async () => {
  await isEmailTaken('nobody@example.com');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function useClock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  advance(6 * 60 * MIN); // well past anything an earlier test left behind
}

describe('daily cap on wrong passwords', () => {
  it('20 wrong passwords paced under the short limit still end in a one-hour lock, which is logged', async () => {
    useClock();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const who = await freshAccount();
    await paced(20, wrongLogin(who.email));
    expect(warn.mock.calls.some(([m]) => /AUTH_LOCKOUT.*locked after repeated failures/.test(String(m)))).toBe(true);

    const locked = await login(who.email, who.password);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('Too many failed attempts. Try again in 60 minutes.');
    advance(30 * MIN);
    expect((await login(who.email, who.password)).status).toBe(429);
    advance(31 * MIN);
    // The day's count is still 20, but it never refuses a right password by itself.
    expect((await login(who.email, who.password)).status).toBe(200);
  });

  it('a right password before the cap clears the day count', async () => {
    useClock();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const who = await freshAccount();
    await paced(19, wrongLogin(who.email));
    advance(4 * MIN + 1000);
    expect((await login(who.email, who.password)).status).toBe(200);
    advance(4 * MIN + 1000);
    await paced(19, wrongLogin(who.email));
    advance(4 * MIN + 1000);
    expect((await login(who.email, who.password)).status).toBe(200); // 38 wrong today, but never 20 in a row
  });

  it('the same on a known device: its own day count and one-hour lock, and the account is untouched', async () => {
    useClock();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const who = await freshAccount();
    const first = await login(who.email, who.password);
    const raw = first.headers['set-cookie'] as unknown as string[];
    const device = raw.find((c) => c.startsWith('fd_device_'))!.split(';')[0];

    await paced(20, wrongLogin(who.email, device));
    const locked = await login(who.email, who.password, device);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('Too many failed attempts. Try again in 60 minutes.');
    expect((await login(who.email, who.password)).status).toBe(200); // without the cookie: the account is fine
    advance(61 * MIN);
    expect((await login(who.email, who.password, device)).status).toBe(200);
  });
});

describe('daily cap on security answers', () => {
  const verify = (answers: string[]) => post('/api/auth/verify-security-answers', { identifier: 'manager', answers });
  const right = ['western freight corridor hub', 'rao', 'tata lpt'];
  const wrong = async (i: number) => (await verify(['x', 'y', `paced-${i}`])).status;

  it('a right answer set before the cap clears the day count', async () => {
    useClock();
    await paced(19, wrong, 400);
    advance(4 * MIN + 1000);
    expect((await verify(right)).status).toBe(200);
    advance(4 * MIN + 1000);
    await paced(19, wrong, 400);
    advance(4 * MIN + 1000);
    expect((await verify(right)).status).toBe(200);
  });

  it('20 wrong answer sets paced under the short limit end in a one-hour lock', async () => {
    useClock();
    await paced(20, wrong, 400);
    expect((await verify(right)).status).toBe(429);
    advance(30 * MIN);
    expect((await verify(right)).status).toBe(429);
    advance(31 * MIN);
    expect((await verify(right)).status).toBe(200);
  });
});
