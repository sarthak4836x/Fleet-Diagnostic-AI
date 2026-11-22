import crypto from 'crypto';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app from '../server';
import { kv } from '../server/kvStore';
import { countUsersByFleet, createAccount, listUsersInFleet } from '../server/auth';
import { createFleet } from '../server/fleetStore';

let ipCounter = 0;
const nextIp = () => `10.8.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (agent: ReturnType<typeof request.agent>) => ({
  get: (url: string) => agent.get(url).set('X-Forwarded-For', nextIp()),
  post: (url: string, body: unknown = {}) => agent.post(url).set('X-Forwarded-For', nextIp()).send(body as object),
});
const loginWith = (target: unknown, identifier: string, password: string) =>
  request(target as never).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier, password });

let dev: ReturnType<typeof request.agent>;

beforeAll(async () => {
  dev = request.agent(app);
  const res = await call(dev).post('/api/auth/login', { identifier: 'sarthak', password: 'Test-developer-1' });
  expect(res.status).toBe(200);
});

describe('sign-in identifiers', () => {
  it('signs in by email or alias, not by name or badge', async () => {
    const pw = 'Test-manager-1';
    expect((await loginWith(app, 'David Hayes', pw)).status).toBe(401);
    expect((await loginWith(app, 'FM-3012', pw)).status).toBe(401);
    // Six wrong tries by name and badge: none of them counts against the account.
    for (let i = 0; i < 3; i++) {
      expect((await loginWith(app, 'david hayes', `wrong-${i}`)).status).toBe(401);
      expect((await loginWith(app, 'fm-3012', `wrong-${i}`)).status).toBe(401);
    }
    expect((await loginWith(app, 'manager', pw)).status).toBe(200);
    expect((await loginWith(app, ' Fleet.Manager@FleetDiag-Logistics.com ', pw)).status).toBe(200);
  });
});

describe('account limits', () => {
  it('limits accounts per fleet', async () => {
    const full = await createFleet('Full Co');
    const other = await createFleet('Roomy Co');
    for (let i = 0; i < 200; i++) await kv.addToSet(`fleetdiag_fleet_users_v3:${full.id}`, `usr-filler-${i}`);
    const body = { name: 'N', role: 'technician' };
    const refused = await call(dev).post('/api/auth/accounts', { ...body, email: 'limit1@example.com', fleetId: full.id });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('This fleet has reached its account limit.');
    const ok = await call(dev).post('/api/auth/accounts', { ...body, email: 'limit2@example.com', fleetId: other.id });
    expect(ok.status).toBe(201);
  });
});

describe('fleet membership lookups', () => {
  it('counts and lists users by fleet', async () => {
    const f = await createFleet('Counted Co');
    const empty = await createFleet('Empty Co');
    await createAccount({ name: 'One', email: 'one@counted.example', role: 'technician', fleetId: f.id });
    await createAccount({ name: 'Two', email: 'two@counted.example', role: 'dispatcher', fleetId: f.id });
    await createAccount({ name: 'Dev', email: 'dev2@counted.example', role: 'developer' });
    const counts = await countUsersByFleet([f.id, empty.id, 'flt_demo']);
    expect(counts[f.id]).toBe(2);
    expect(counts[empty.id]).toBe(0);
    expect(counts.flt_demo).toBe(4); // the seeded staff; the developer belongs to no fleet
    const listed = await listUsersInFleet(f.id);
    expect(listed.map((u) => u.email).sort()).toEqual(['one@counted.example', 'two@counted.example']);
    expect(listed.every((u) => u.fleetId === f.id && u.fleetName === 'Counted Co')).toBe(true);
    expect(JSON.stringify(listed)).not.toMatch(/passwordHash|answerHash/);
  });
});

describe('per-request reads and the gate', () => {
  it('reads the fleet once per request', async () => {
    const director = request.agent(app);
    expect((await call(director).post('/api/auth/login', { identifier: 'director', password: 'Test-director-1' })).status).toBe(200);
    const spy = vi.spyOn(kv, 'get');
    try {
      const me = await call(director).get('/api/auth/me');
      expect(me.body.user).toMatchObject({ fleetId: 'flt_demo', fleetName: 'Demo Fleet' });
      const fleetReads = spy.mock.calls.map(([key]) => key).filter((key) => /^fleetdiag_fleet(s_v1|_v2:|_ids_v2)/.test(key));
      expect(fleetReads).toEqual(['fleetdiag_fleet_v2:flt_demo']);
    } finally {
      spy.mockRestore();
    }
  });

  it('the session gate ignores letter case', async () => {
    const res = await request(app).get('/API/fleet').set('X-Forwarded-For', nextIp());
    expect(res.status).toBe(401);
    const login = await request(app).post('/API/AUTH/LOGIN').set('X-Forwarded-For', nextIp()).send({ identifier: 'tech', password: 'Test-technician-1' });
    expect(login.status).toBe(200);
  });
});

describe('migration', () => {
  it('migration is safe to run twice and leaves the old key', async () => {
    vi.resetModules();
    const { kv: freshKv } = await import('../server/kvStore');
    const auth = await import('../server/auth');
    const base = {
      aliases: [] as string[],
      avatarColor: 'x',
      permissions: [],
      passwordVersion: 1,
      securityQuestions: [],
      failedLogins: 0,
      lockedUntil: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const original = [
      { ...base, id: 'usr-m-a', email: 'mig-a@example.com', aliases: ['miga'], name: 'Mig A', role: 'technician', roleLabel: 'Diagnostic Technician', badgeNumber: 'FD-2001', fleetId: 'flt_demo', passwordHash: auth.hashSecret('Mig-Pass-111') },
      { ...base, id: 'usr-m-b', email: 'mig-b@example.com', name: 'Mig B', role: 'dispatcher', roleLabel: 'Fleet Dispatcher', badgeNumber: 'FD-2002', passwordHash: auth.hashSecret('Mig-Pass-222') },
      { ...base, id: 'usr-m-c', email: 'mig-c@example.com', name: 'Mig C', role: 'developer', roleLabel: 'Developer', badgeNumber: 'DEV-2003', passwordHash: auth.hashSecret('Mig-Pass-333'), otpHash: 'h', otpExpiresAt: 1 },
    ];
    await freshKv.set('fleetdiag_users_v2', original);
    const snapshot = JSON.parse(JSON.stringify(original));

    await auth.migrateAccounts();
    const freshApp = (await import('../server')).default;
    expect((await loginWith(freshApp, 'miga', 'Mig-Pass-111')).status).toBe(200);
    const stored = await freshKv.get<Record<string, unknown>>('fleetdiag_user_v3:usr-m-c');
    expect(stored).not.toHaveProperty('otpHash');
    expect(stored).not.toHaveProperty('failedLogins');

    // Change a password through the reset flow.
    const sent = await request(freshApp).post('/api/auth/send-otp').set('X-Forwarded-For', nextIp()).send({ identifier: 'mig-b@example.com' });
    const verified = await request(freshApp).post('/api/auth/verify-otp').set('X-Forwarded-For', nextIp()).send({ identifier: 'mig-b@example.com', code: sent.body.demoOtp });
    expect(verified.status).toBe(200);
    const reset = await request(freshApp).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ resetToken: verified.body.resetToken, newPassword: 'Mig-New-999' });
    expect(reset.status).toBe(200);

    await freshKv.del('fleetdiag_users_v3_ready');
    await auth.migrateAccounts();
    expect((await loginWith(freshApp, 'mig-b@example.com', 'Mig-New-999')).status).toBe(200);
    expect((await loginWith(freshApp, 'mig-b@example.com', 'Mig-Pass-222')).status).toBe(401);
    expect(await freshKv.get('fleetdiag_users_v2')).toEqual(snapshot);

    const all = await freshKv.getSet('fleetdiag_user_ids_v3');
    expect(all.sort()).toEqual(['usr-m-a', 'usr-m-b', 'usr-m-c']);
    expect((await freshKv.getSet('fleetdiag_fleet_users_v3:flt_demo')).sort()).toEqual(['usr-m-a', 'usr-m-b']);
    expect(await freshKv.getSet('fleetdiag_fleet_users_v3:_developers')).toEqual(['usr-m-c']);
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toMatchObject({ source: 'v2', count: 3 });
    vi.resetModules();
  });

  it('concurrent migrations agree', async () => {
    vi.resetModules();
    const auth = await import('../server/auth');
    await Promise.all([auth.migrateAccounts(), auth.migrateAccounts()]);
    const freshApp = (await import('../server')).default;
    const logins: Array<[string, string]> = [
      ['sarthak', 'Test-developer-1'],
      ['director', 'Test-director-1'],
      ['manager', 'Test-manager-1'],
      ['tech', 'Test-technician-1'],
      ['dispatch', 'Test-dispatcher-1'],
    ];
    for (const [id, pw] of logins) expect((await loginWith(freshApp, id, pw)).status, id).toBe(200);
    vi.resetModules();
  });
});

// ------------------------------------------------------------------
// Review fixes
// ------------------------------------------------------------------
const loginKeyOf = (identifier: string) =>
  `fleetdiag_user_login_v3:${crypto.createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')}`;

async function freshInstance() {
  vi.resetModules();
  const { kv: freshKv } = await import('../server/kvStore');
  const auth = await import('../server/auth');
  const v2User = (id: string, email: string, password: string, extra: Record<string, unknown> = {}) => ({
    id,
    email,
    aliases: [] as string[],
    name: id,
    role: 'technician',
    roleLabel: 'Diagnostic Technician',
    badgeNumber: `FD-${id}`,
    avatarColor: 'x',
    fleetId: 'flt_demo',
    permissions: [],
    passwordHash: auth.hashSecret(password),
    passwordVersion: 1,
    securityQuestions: [],
    failedLogins: 0,
    lockedUntil: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  });
  const appOf = async () => (await import('../server')).default;
  return { freshKv, auth, v2User, appOf };
}

describe('migration failures', () => {
  it('a non-array v2 does not seed and writes no marker', async () => {
    const { freshKv, auth, v2User, appOf } = await freshInstance();
    await freshKv.set('fleetdiag_users_v2', { corrupt: true });
    await expect(auth.migrateAccounts()).rejects.toThrow();
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toBeNull();
    expect(await freshKv.setSize('fleetdiag_user_ids_v3')).toBe(0);

    // The request that hits the bad value fails; once the value is repaired the next one migrates.
    const freshApp = await appOf();
    expect((await loginWith(freshApp, 'sarthak', 'Test-developer-1')).status).toBe(500);
    await freshKv.set('fleetdiag_users_v2', [v2User('usr-fix', 'fix@example.com', 'Fix-Pass-123')]);
    expect((await loginWith(freshApp, 'fix@example.com', 'Fix-Pass-123')).status).toBe(200);
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toMatchObject({ source: 'v2', count: 1 });
    vi.resetModules();
  });

  it('a v2 read that throws does not seed', async () => {
    const { freshKv, auth } = await freshInstance();
    const realGet = freshKv.get.bind(freshKv);
    const spy = vi.spyOn(freshKv, 'get').mockImplementation(async (key: string) => {
      if (key === 'fleetdiag_users_v2') throw new Error('store unavailable');
      return realGet(key);
    });
    try {
      await expect(auth.migrateAccounts()).rejects.toThrow('store unavailable');
    } finally {
      spy.mockRestore();
    }
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toBeNull();
    expect(await freshKv.setSize('fleetdiag_user_ids_v3')).toBe(0);
    vi.resetModules();
  });

  it('the first v2 account keeps a shared sign-in name', async () => {
    const { freshKv, auth, v2User, appOf } = await freshInstance();
    // The first account reaches 'shared' last in its own list, the second reaches it first.
    await freshKv.set('fleetdiag_users_v2', [
      v2User('usr-first', 'first@example.com', 'First-Pass-1', { aliases: ['f1', 'f2', 'f3', 'shared'] }),
      v2User('usr-second', 'second@example.com', 'Second-Pass-2', { aliases: ['shared'] }),
    ]);
    await auth.migrateAccounts();
    const freshApp = await appOf();
    expect((await loginWith(freshApp, 'shared', 'First-Pass-1')).status).toBe(200);
    expect((await loginWith(freshApp, 'second@example.com', 'Second-Pass-2')).status).toBe(200);
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toMatchObject({ source: 'v2', count: 2, collisions: 1 });
    vi.resetModules();
  });

  it('an interrupted migration completes without overwriting a record changed since', async () => {
    const { freshKv, auth, v2User, appOf } = await freshInstance();
    const a = v2User('usr-ia', 'ia@example.com', 'Old-Pass-111');
    const b = v2User('usr-ib', 'ib@example.com', 'Pass-B-222');
    const c = v2User('usr-ic', 'ic@example.com', 'Pass-C-333', { role: 'developer', fleetId: undefined });
    await freshKv.set('fleetdiag_users_v2', [a, b, c]);
    // The first run stopped after account A, and A's password was changed before the next run.
    const { failedLogins: _f, lockedUntil: _l, ...aRecord } = a;
    await freshKv.setIfAbsent('fleetdiag_user_v3:usr-ia', { ...aRecord, passwordHash: auth.hashSecret('Changed-Pass-9'), passwordVersion: 2 });
    await freshKv.setIfAbsent(loginKeyOf('ia@example.com'), 'usr-ia');
    await freshKv.addToSet('fleetdiag_fleet_users_v3:flt_demo', 'usr-ia');

    await auth.migrateAccounts();
    const freshApp = await appOf();
    expect((await loginWith(freshApp, 'ia@example.com', 'Changed-Pass-9')).status).toBe(200);
    expect((await loginWith(freshApp, 'ia@example.com', 'Old-Pass-111')).status).toBe(401);
    expect((await loginWith(freshApp, 'ib@example.com', 'Pass-B-222')).status).toBe(200);
    expect((await loginWith(freshApp, 'ic@example.com', 'Pass-C-333')).status).toBe(200);
    expect((await freshKv.getSet('fleetdiag_user_ids_v3')).sort()).toEqual(['usr-ia', 'usr-ib', 'usr-ic']);
    expect((await freshKv.getSet('fleetdiag_fleet_users_v3:flt_demo')).sort()).toEqual(['usr-ia', 'usr-ib']);
    expect(await freshKv.get('fleetdiag_users_v3_ready')).toMatchObject({ source: 'v2', count: 3 });
    vi.resetModules();
  });
});

describe('sessions and sign-in after the review', () => {
  it('a session whose account record was deleted is refused', async () => {
    const f = await createFleet('Vanishing Co');
    const { user, temporaryPassword } = await createAccount({ name: 'V', email: 'vanish@example.com', role: 'technician', fleetId: f.id });
    const agent = request.agent(app);
    expect((await call(agent).post('/api/auth/login', { identifier: user.email, password: temporaryPassword })).status).toBe(200);
    expect((await call(agent).get('/api/fleet')).status).toBe(200);
    await kv.del(`fleetdiag_user_v3:${user.id}`);
    expect((await call(agent).get('/api/fleet')).status).toBe(401);
    expect((await call(agent).get('/api/auth/me')).body).toEqual({ user: null });
  });

  it('sign-in costs the same store reads whether or not the account exists', async () => {
    const reads = async (identifier: string) => {
      const spy = vi.spyOn(kv, 'get');
      try {
        expect((await loginWith(app, identifier, 'Not-the-password-1')).status).toBe(401);
        return spy.mock.calls.length;
      } finally {
        spy.mockRestore();
      }
    };
    const known = await reads('dispatch');
    const unknown = await reads('nobody-here@example.com');
    expect(unknown).toBe(known);
  });

  it('a wrong password makes the same store calls whether or not the account exists', async () => {
    const calls = async (identifier: string) => {
      const spies = (['get', 'set', 'del', 'increment'] as const).map((m) => vi.spyOn(kv, m));
      try {
        expect((await loginWith(app, identifier, 'Not-the-password-2')).status).toBe(401);
        return spies.map((s) => s.mock.calls.length);
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
    };
    const known = await calls('dispatch');
    const unknown = await calls('nobody-else@example.com');
    expect(unknown).toEqual(known);
    expect(known[3]).toBe(2); // the attempt is counted twice: the short count and the day count
  });

  it('a lock is stored with an expiry a little longer than the lock', async () => {
    const f = await createFleet('Lock Expiry Co');
    const { user } = await createAccount({ name: 'L', email: 'lock-ttl@example.com', role: 'technician', fleetId: f.id });
    const spy = vi.spyOn(kv, 'set');
    try {
      for (let i = 0; i < 5; i++) expect((await loginWith(app, user.email, `Wrong-${i}-x`)).status).toBe(401);
      const lockWrites = spy.mock.calls.filter(([key]) => key === `fleetdiag_user_login_lock_v3:${user.id}`);
      expect(lockWrites).toHaveLength(1);
      const [, until, ttl] = lockWrites[0] as [string, number, number];
      expect(ttl).toBe(5 * 60 + 60);
      expect(until - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
      expect(until - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    } finally {
      spy.mockRestore();
    }
  });

  it('a lock cleared in the store (say, by a reset on another instance) is cleared here too', async () => {
    const f = await createFleet('Lock Clear Co');
    const { user, temporaryPassword } = await createAccount({ name: 'C', email: 'lock-clear@example.com', role: 'technician', fleetId: f.id });
    for (let i = 0; i < 5; i++) expect((await loginWith(app, user.email, `Wrong-${i}-y`)).status).toBe(401);
    expect((await loginWith(app, user.email, temporaryPassword)).status).toBe(429);
    await kv.del(`fleetdiag_user_login_lock_v3:${user.id}`); // what reset-password does, wherever it ran
    expect((await loginWith(app, user.email, temporaryPassword)).status).toBe(200);
  });

  it('limits and counts use set sizes, not member lists', async () => {
    const f = await createFleet('Sized Co');
    const spy = vi.spyOn(kv, 'getSet');
    try {
      await createAccount({ name: 'Z', email: 'sized@example.com', role: 'technician', fleetId: f.id });
      expect(await countUsersByFleet([f.id])).toEqual({ [f.id]: 1 });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
