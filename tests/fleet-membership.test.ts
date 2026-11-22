import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app, { getAuditLog } from '../server';
import { resolveFleetId, fleetAccessError, requireFleet } from '../server/fleetAccess';
import { createAccount } from '../server/auth';
import { createFleet, setFleetStatus } from '../server/fleetStore';

let ipCounter = 100;
const nextIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (agent: ReturnType<typeof request.agent>) => ({
  get: (url: string) => agent.get(url).set('X-Forwarded-For', nextIp()),
  post: (url: string, body: unknown = {}) => agent.post(url).set('X-Forwarded-For', nextIp()).send(body as object),
});

const DEMO_LOGINS = {
  developer: { id: 'sarthak', pw: 'Test-developer-1' },
  technician: { id: 'tech', pw: 'Test-technician-1' },
  director: { id: 'director', pw: 'Test-director-1' },
};

const rawLogin = (identifier: string, password: string) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier, password });

async function signInWith(identifier: string, password: string) {
  const agent = request.agent(app);
  const res = await call(agent).post('/api/auth/login', { identifier, password });
  expect(res.status, `login ${identifier}`).toBe(200);
  return agent;
}

async function signIn(who: keyof typeof DEMO_LOGINS) {
  const agent = request.agent(app);
  const res = await call(agent).post('/api/auth/login', { identifier: DEMO_LOGINS[who].id, password: DEMO_LOGINS[who].pw });
  expect(res.status, `login ${who}`).toBe(200);
  return { agent, res };
}

let dev: ReturnType<typeof request.agent>;
let director: ReturnType<typeof request.agent>;

beforeAll(async () => {
  dev = (await signIn('developer')).agent;
  director = (await signIn('director')).agent;
});

describe('fleet membership', () => {
  it('resolves fleets from the stored account', () => {
    expect(resolveFleetId({ role: 'technician', fleetId: 'flt_a', activeFleetId: 'flt_b' })).toBe('flt_a');
    expect(resolveFleetId({ role: 'technician' })).toBeNull();
    expect(resolveFleetId({ role: 'developer' })).toBe('flt_demo');
    expect(resolveFleetId({ role: 'developer', activeFleetId: 'flt_a' })).toBe('flt_a');
  });

  it('puts seeded staff in the Demo fleet with the Fleet Owner label', async () => {
    const { res } = await signIn('director');
    expect(res.body.user).toMatchObject({ fleetId: 'flt_demo', fleetName: 'Demo Fleet', isDemoFleet: true, roleLabel: 'Fleet Owner' });
    const me = await call(director).get('/api/auth/me');
    expect(me.body.user).toMatchObject({ fleetId: 'flt_demo', fleetName: 'Demo Fleet', isDemoFleet: true });
  });

  it('migrates stored accounts that have no fleet', async () => {
    vi.resetModules();
    const { kv } = await import('../server/kvStore');
    const auth = await import('../server/auth');
    const base = {
      aliases: [],
      avatarColor: 'x',
      permissions: [],
      passwordHash: auth.hashSecret('Old-Pass-12345'),
      passwordVersion: 1,
      securityQuestions: [],
      failedLogins: 0,
      lockedUntil: 0,
      createdAt: new Date().toISOString(),
    };
    await kv.set('fleetdiag_users_v2', [
      { ...base, id: 'usr-old-t', email: 'oldtech@example.com', name: 'Old Tech', role: 'technician', roleLabel: 'Diagnostic Technician', badgeNumber: 'FD-1111' },
      { ...base, id: 'usr-old-d', email: 'olddir@example.com', name: 'Old Dir', role: 'fleet_director', roleLabel: 'Executive Fleet Director', badgeNumber: 'DIR-1111' },
    ]);
    const freshApp = (await import('../server')).default;
    const login = (id: string) =>
      request(freshApp).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: id, password: 'Old-Pass-12345' });
    const tech = await login('oldtech@example.com');
    expect(tech.status).toBe(200);
    expect(tech.body.user).toMatchObject({ fleetId: 'flt_demo' });
    const dir = await login('olddir@example.com');
    expect(dir.body.user).toMatchObject({ fleetId: 'flt_demo', roleLabel: 'Fleet Owner' });
    vi.resetModules();
  });

  it('refuses an account with no fleet', async () => {
    expect(await fleetAccessError({ role: 'technician' })).toBeTruthy();
    expect(await fleetAccessError({ role: 'developer' })).toBeNull();
  });

  it('blocks a suspended fleet at sign-in and on an existing session', async () => {
    const f = await createFleet('Suspended Co');
    const { temporaryPassword, user } = await createAccount({ name: 'S', email: 's@example.com', role: 'technician', fleetId: f.id });
    const agent = await signInWith(user.email, temporaryPassword);
    await setFleetStatus(f.id, 'suspended');
    const res = await call(agent).get('/api/fleet');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('This fleet has been suspended.');
    const login = await rawLogin(user.email, temporaryPassword);
    expect(login.status).toBe(403);
    expect(login.body.error).toBe('This fleet has been suspended.');
    const me = await call(agent).get('/api/auth/me');
    expect(me.body.user).toBeNull();

    expect(res.body.code).toBe('FLEET_REFUSED');
    expect(login.body.code).toBe('FLEET_REFUSED');
    expect(me.body.reason).toBe('This fleet has been suspended.');
    const again = await call(agent).get('/api/auth/me'); // the refused session was cleared, so the reason shows once
    expect(again.body).toEqual({ user: null });

    const events = getAuditLog(50).map((e: { type: string; details: string }) => `${e.type} ${e.details}`);
    expect(events).toContain('AUTH_FAILURE Sign-in of s@example.com refused: This fleet has been suspended.');
    expect(events).toContain('UNAUTHORIZED_ACCESS_BLOCKED Session of s@example.com refused: This fleet has been suspended.');
  });

  it('marks only fleet refusals, not an ordinary permission refusal', async () => {
    const tech = (await signIn('technician')).agent;
    const res = await call(tech).post('/api/auth/accounts', { name: 'N', email: 'perm@example.com', role: 'technician' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You do not have permission to perform this action.');
    expect(res.body).not.toHaveProperty('code');
    const me = await call(tech).get('/api/auth/me');
    expect(me.body).not.toHaveProperty('reason');
    const signedOut = await request(app).get('/api/auth/me').set('X-Forwarded-For', nextIp());
    expect(signedOut.body).toEqual({ user: null });
  });

  it('never marks a developer as refused when the active fleet is missing', async () => {
    const run = async (role: string) => {
      const res: { statusCode?: number; body?: any; status: (c: number) => any; json: (b: any) => any } = {
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
      };
      const next = vi.fn();
      await requireFleet({ user: { role, fleetId: 'flt_missing' } } as never, res as never, next);
      expect(next).not.toHaveBeenCalled();
      return res;
    };
    const devRes = await run('developer');
    expect(devRes.statusCode).toBe(403);
    expect(devRes.body.error).toBe('This account is not linked to a fleet. Contact your administrator.');
    expect(devRes.body).not.toHaveProperty('code');
    expect((await run('technician')).body.code).toBe('FLEET_REFUSED');
  });

  it('account creation follows the fleet rules', async () => {
    const f = await createFleet('Other Co');
    const body = { name: 'N', email: 'n1@example.com', role: 'technician' };
    const made = await call(director).post('/api/auth/accounts', { ...body, fleetId: f.id });
    expect(made.status).toBe(201);
    expect(made.body.user.fleetId).toBe('flt_demo'); // a supplied fleet is ignored
    const refused = await call(dev).post('/api/auth/accounts', { ...body, email: 'n2@example.com' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('Add this user from the Fleets screen.');
    const unknown = await call(dev).post('/api/auth/accounts', { ...body, email: 'n3@example.com', fleetId: 'flt_none' });
    expect(unknown.status).toBe(400);
    const ok = await call(dev).post('/api/auth/accounts', { ...body, email: 'n4@example.com', fleetId: f.id });
    expect(ok.body.user.fleetId).toBe(f.id);
  });
});
