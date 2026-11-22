import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import app from '../server';
import { kv } from '../server/kvStore';
import { createAccount, isEmailTaken } from '../server/auth';
import { DEMO_FLEET_ID } from '../server/fleetStore';

// A browser that has signed in to an account before carries a known-device cookie for it (one per
// account). Strangers who lock the account with wrong passwords do not lock that browser out; its own
// mistakes lock only it.
let ipCounter = 0;
const nextIp = () => `10.15.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (url: string, body: object, cookie?: string) => {
  const r = request(app).post(url).set('X-Forwarded-For', nextIp());
  if (cookie) r.set('Cookie', cookie);
  return r.send(body);
};
const login = (identifier: string, password: string, cookie?: string) => post('/api/auth/login', { identifier, password }, cookie);

const DEVICE_NAME = /^fd_device_[0-9a-f]{16}=/;
function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  return Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
}
/** The known-device cookie this response sets (not one it removes). */
function deviceSetCookie(res: request.Response): string | undefined {
  return setCookies(res).find((c) => DEVICE_NAME.test(c) && !/Max-Age=0/.test(c));
}
/** Signs in and returns the known-device cookie, as `name=value`. */
async function knownDevice(identifier: string, password: string): Promise<string> {
  const res = await login(identifier, password);
  expect(res.status).toBe(200);
  const header = deviceSetCookie(res);
  expect(header).toBeTruthy();
  return header!.split(';')[0];
}
async function lockAccountWithoutCookie(identifier: string) {
  for (let i = 0; i < 5; i++) expect((await login(identifier, `Stranger-${i}-guess`)).status).toBe(401);
  expect((await login(identifier, 'Stranger-6-guess')).status).toBe(429);
}
/** A fresh account of its own, so a test never depends on what earlier tests did. */
async function freshAccount(tag: string) {
  const { user, temporaryPassword } = await createAccount({
    name: `Device ${tag}`,
    email: `device-${tag}@example.com`,
    role: 'technician',
    fleetId: DEMO_FLEET_ID,
  });
  return { id: user.id, email: user.email, password: temporaryPassword };
}
/** A device token signed with the test secret, as the server would sign one. */
function signDevice(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(body).digest('base64url');
  return `${body}.${sig}`;
}

beforeAll(async () => {
  await isEmailTaken('nobody@example.com');
});

afterEach(() => vi.restoreAllMocks());

describe('known-device cookie', () => {
  it('is set on sign-in: HttpOnly, SameSite=Strict, long-lived, sent only to sign-in, and not a session', async () => {
    const res = await login('manager', 'Test-manager-1');
    expect(res.status).toBe(200);
    const header = deviceSetCookie(res)!;
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Strict/);
    expect(header).toMatch(/Max-Age=15552000/); // 180 days
    expect(header).toMatch(/Path=\/api\/auth\/login/);
    expect(setCookies(res).some((c) => c.startsWith('fd_session='))).toBe(true);
    const [name, value] = header.split(';')[0].split('=');
    // The name never shows the account ID.
    expect(name).not.toContain(res.body.user.id);

    // It grants nothing on its own, not even when passed off as a session.
    for (const cookie of [`${name}=${value}`, `fd_session=${value}`]) {
      expect((await request(app).get('/api/fleet').set('X-Forwarded-For', nextIp()).set('Cookie', cookie)).status).toBe(401);
      expect((await request(app).get('/api/auth/me').set('X-Forwarded-For', nextIp()).set('Cookie', cookie)).body.user).toBeNull();
    }
  });

  it('is not set when the password is wrong, nor on sign-out (which keeps it)', async () => {
    const wrong = await login('manager', 'Not-it-123');
    expect(wrong.status).toBe(401);
    expect(deviceSetCookie(wrong)).toBeUndefined();
    const out = await post('/api/auth/logout', {});
    expect(setCookies(out).some((c) => c.startsWith('fd_device'))).toBe(false);
  });

  it('a locked account still accepts the right password from a known device, and refuses it without the cookie', async () => {
    const device = await knownDevice('director', 'Test-director-1');
    await lockAccountWithoutCookie('director');

    const withCookie = await login('director', 'Test-director-1', device);
    expect(withCookie.status).toBe(200);
    expect(withCookie.body.user.role).toBe('fleet_director');

    const without = await login('director', 'Test-director-1');
    expect(without.status).toBe(429);
    expect(without.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');
    // The owner's sign-in did not lift the lock for everyone else.
    expect((await login('director', 'Test-director-1')).status).toBe(429);
  });

  it('one browser remembers each account separately: A then B sign in, strangers lock A, A still gets in', async () => {
    const a = await freshAccount('jar-a');
    const b = await freshAccount('jar-b');
    const jar = request.agent(app);
    const signIn = (who: { email: string; password: string }) =>
      jar.post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: who.email, password: who.password });
    expect((await signIn(a)).status).toBe(200);
    const bRes = await signIn(b);
    expect(bRes.status).toBe(200);
    const bCookie = deviceSetCookie(bRes)!.split(';')[0];

    await lockAccountWithoutCookie(a.email);
    expect((await signIn(a)).status).toBe(200);
    // B's cookie on its own does not unlock A.
    expect((await login(a.email, a.password, bCookie)).status).toBe(429);
  });

  it('5 wrong passwords with the cookie lock only that device, and never touch the account-wide count', async () => {
    const device = await knownDevice('tech', 'Test-technician-1');
    const other = await knownDevice('tech', 'Test-technician-1');
    const me = (await login('tech', 'Test-technician-1')).body.user.id as string;
    const increment = vi.spyOn(kv, 'increment');

    for (let i = 0; i < 5; i++) expect((await login('tech', `Mistyped-${i}-pw`, device)).status).toBe(401);
    const locked = await login('tech', 'Test-technician-1', device);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');

    const keys = increment.mock.calls.map(([key]) => String(key));
    expect(keys.some((k) => k.startsWith(`fleetdiag_user_login_`) && k.includes(me))).toBe(false);
    // Five counted; the sixth is refused by the device's lock before it is counted.
    expect(keys.filter((k) => k.startsWith(`fleetdiag_user_device_fails_v3:${me}:`))).toHaveLength(5);

    // Another known device and a browser without the cookie are unaffected.
    expect((await login('tech', 'Test-technician-1', other)).status).toBe(200);
    expect((await login('tech', 'Test-technician-1')).status).toBe(200);
  });

  it('four wrong then the right password gets in on a known device, and a success clears its count', async () => {
    const device = await knownDevice('sarthak', 'Test-developer-1');
    for (let i = 0; i < 4; i++) expect((await login('sarthak', `Mistyped-${i}-pw`, device)).status).toBe(401);
    expect((await login('sarthak', 'Test-developer-1', device)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login('sarthak', `Mistyped-${i}-again`, device)).status).toBe(401);
    expect((await login('sarthak', 'Test-developer-1', device)).status).toBe(200);
  });

  it('a cookie for another account, a forged one, a session token, an expired or a malformed one is ignored', async () => {
    const target = await freshAccount('ignored');
    const own = await login(target.email, target.password);
    const ownCookie = deviceSetCookie(own)!.split(';')[0];
    const [name, value] = ownCookie.split('=');
    const [body, sig] = value.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    const session = setCookies(own).find((c) => c.startsWith('fd_session='))!.split(';')[0].slice('fd_session='.length);
    const managers = await knownDevice('manager', 'Test-manager-1');
    const managersValue = managers.split('=')[1];
    const forgedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(managersValue.split('.')[0], 'base64url').toString()), uid: target.id })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);

    await lockAccountWithoutCookie(target.email);

    // Control: a token signed the same way, but current, is accepted, so the expired one below is
    // refused for its expiry alone.
    const current = signDevice({ ...payload, iat: now - 100, exp: now + 3600 });
    expect((await login(target.email, target.password, `${name}=${current}`)).status).toBe(200);

    const candidates = [
      managers, // another account's genuine cookie, under its own name
      `${name}=${managersValue}`, // another account's genuine cookie, under this account's name
      `${name}=${forgedBody}.${managersValue.split('.')[1]}`, // re-pointed at this account, old signature
      `${name}=${body}.${sig.slice(0, -2)}xx`, // bad signature
      `${name}=${session}`, // this account's own session token
      `${name}=${signDevice({ ...payload, iat: now - 7200, exp: now - 60 })}`, // validly signed, expired
      `${name}=not-a-token`,
      `${name}=${'a'.repeat(5000)}`,
      `${name}=.`,
      `fd_device=${value}`, // the right token under a generic name
    ];
    for (const cookie of candidates) {
      const res = await login(target.email, target.password, cookie);
      expect(res.status, cookie.slice(0, 60)).toBe(429);
      expect(res.body.error).toBe('Too many failed attempts. Try again in 5 minutes.');
    }
  });

  it('a cookie from before a password change is ignored', async () => {
    const old = await knownDevice('dispatch', 'Test-dispatcher-1');
    const sent = await post('/api/auth/send-otp', { identifier: 'dispatch' });
    const verified = await post('/api/auth/verify-otp', { identifier: 'dispatch', code: sent.body.demoOtp });
    expect(verified.status).toBe(200);
    const reset = await post('/api/auth/reset-password', { resetToken: verified.body.resetToken, newPassword: 'Changed-dispatch-2' });
    expect(reset.status).toBe(200);

    await lockAccountWithoutCookie('dispatch');
    expect((await login('dispatch', 'Changed-dispatch-2', old)).status).toBe(429);
  });

  it('a browser with many device cookies is trimmed, oldest and invalid first, and only one is set', async () => {
    const who = await freshAccount('many');
    const junk = Array.from({ length: 14 }, (_, i) => `fd_device_${crypto.randomBytes(8).toString('hex')}=junk${i}`);
    const now = Math.floor(Date.now() / 1000);
    const valid = Array.from({ length: 3 }, (_, i) => {
      const n = `fd_device_${crypto.randomBytes(8).toString('hex')}`;
      return { n, cookie: `${n}=${signDevice({ uid: `usr-x${i}`, pwv: 1, typ: 'device', iat: now - i, exp: now + 3600, did: 'A'.repeat(22) })}` };
    });
    const res = await login(who.email, who.password, [...junk, ...valid.map((v) => v.cookie)].join('; '));
    expect(res.status).toBe(200);
    const set = setCookies(res).filter((c) => c.startsWith('fd_device'));
    const removed = set.filter((c) => /Max-Age=0/.test(c)).map((c) => c.split('=')[0]);
    expect(set.filter((c) => !/Max-Age=0/.test(c))).toHaveLength(1);
    // 17 others, 9 may stay beside this account's: the 8 removed are all junk.
    expect(removed).toHaveLength(8);
    expect(removed.every((n) => junk.some((j) => j.startsWith(`${n}=`)))).toBe(true);
    for (const c of setCookies(res).filter((c) => /Max-Age=0/.test(c))) expect(c).toMatch(/Path=\/api\/auth\/login/);
  });

  it('an unknown name gets the same answer and the same store calls, with or without a cookie', async () => {
    const device = await knownDevice('manager', 'Test-manager-1');
    const calls = async (identifier: string, cookie?: string) => {
      const spies = (['get', 'set', 'del', 'increment'] as const).map((m) => vi.spyOn(kv, m));
      try {
        const res = await login(identifier, 'Not-the-password-9', cookie);
        return { status: res.status, body: res.body, cookies: setCookies(res), calls: spies.map((s) => s.mock.calls.length) };
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
    };
    const plain = await calls('nobody-at-all@example.com');
    const withCookie = await calls('nobody-at-all@example.com', device);
    expect(withCookie).toEqual(plain);
    expect(plain.status).toBe(401);
    expect(plain.body).toEqual({ error: 'Incorrect email/username or password.' });
    expect(plain.cookies).toEqual([]);
    // A known name with its own cookie takes the same shape too.
    const known = await calls('manager', device);
    expect(known.calls).toEqual(plain.calls);
    expect(known.body).toEqual(plain.body);
  });
});
