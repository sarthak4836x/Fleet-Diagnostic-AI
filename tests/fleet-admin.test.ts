import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server';

let ipCounter = 100;
const nextIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (agent: ReturnType<typeof request.agent>) => ({
  get: (url: string) => agent.get(url).set('X-Forwarded-For', nextIp()),
  post: (url: string, body: unknown = {}) => agent.post(url).set('X-Forwarded-For', nextIp()).send(body as object),
  patch: (url: string, body: unknown = {}) => agent.patch(url).set('X-Forwarded-For', nextIp()).send(body as object),
});

const DEMO = {
  developer: { id: 'sarthak', pw: 'Test-developer-1' },
  technician: { id: 'tech', pw: 'Test-technician-1' },
  director: { id: 'director', pw: 'Test-director-1' },
};

async function loginAs(identifier: string, password: string) {
  const agent = request.agent(app);
  const res = await call(agent).post('/api/auth/login', { identifier, password });
  expect(res.status, `login ${identifier}`).toBe(200);
  return agent;
}

let dev: ReturnType<typeof request.agent>;
let director: ReturnType<typeof request.agent>;
let tech: ReturnType<typeof request.agent>;

beforeAll(async () => {
  dev = await loginAs(DEMO.developer.id, DEMO.developer.pw);
  director = await loginAs(DEMO.director.id, DEMO.director.pw);
  tech = await loginAs(DEMO.technician.id, DEMO.technician.pw);
});

const fleetCount = async () => (await call(dev).get('/api/fleets')).body.fleets.length as number;

describe('developer fleet API', () => {
  it('refuses non-developers on every route', async () => {
    for (const who of [director, tech]) {
      expect((await call(who).get('/api/fleets')).status).toBe(403);
      expect((await call(who).post('/api/fleets', { name: 'Nope', ownerName: 'N', ownerEmail: 'n@nope.example' })).status).toBe(403);
      expect((await call(who).patch('/api/fleets/flt_demo', { status: 'suspended' })).status).toBe(403);
      expect((await call(who).post('/api/fleets/active', { fleetId: 'flt_demo' })).status).toBe(403);
    }
  });

  it('lists fleets with vehicle and user counts', async () => {
    const res = await call(dev).get('/api/fleets');
    expect(res.status).toBe(200);
    const demo = res.body.fleets.find((f: any) => f.id === 'flt_demo');
    expect(demo).toBeTruthy();
    expect(typeof demo.vehicleCount).toBe('number');
    expect(demo.userCount).toBeGreaterThan(0);
  });

  it('creates a fleet with an owner whose temporary password signs in', async () => {
    const res = await call(dev).post('/api/fleets', { name: 'Acme', ownerName: 'Asha', ownerEmail: 'asha@acme.example' });
    expect(res.status).toBe(201);
    expect(res.body.owner.role).toBe('fleet_director');
    expect(res.body.owner.fleetId).toBe(res.body.fleet.id);
    const owner = await loginAs('asha@acme.example', res.body.temporaryPassword);
    expect((await call(owner).get('/api/auth/me')).body.user.fleetId).toBe(res.body.fleet.id);
  });

  it('rejects a repeated owner email without creating a fleet', async () => {
    const before = await fleetCount();
    const res = await call(dev).post('/api/fleets', { name: 'Acme Two', ownerName: 'Asha', ownerEmail: 'asha@acme.example' });
    expect(res.status).toBe(409);
    expect(await fleetCount()).toBe(before);
  });

  it('validates name and owner before creating anything', async () => {
    const before = await fleetCount();
    const owner = { ownerName: 'Bo', ownerEmail: 'bo@bad.example' };
    expect((await call(dev).post('/api/fleets', { name: 'A', ...owner })).status).toBe(400);
    expect((await call(dev).post('/api/fleets', { name: 'A'.repeat(81), ...owner })).status).toBe(400);
    expect((await call(dev).post('/api/fleets', { name: 'Valid', ownerName: 'Bo', ownerEmail: 'not-an-email' })).status).toBe(400);
    expect((await call(dev).post('/api/fleets', { name: 'Valid', ownerName: '', ownerEmail: 'bo@bad.example' })).status).toBe(400);
    expect(await fleetCount()).toBe(before);
  });

  it('validates PATCH requests', async () => {
    expect((await call(dev).patch('/api/fleets/flt_demo', { status: 'suspended' })).status).toBe(400);
    expect((await call(dev).patch('/api/fleets/flt_missing', { status: 'suspended' })).status).toBe(404);
    const created = await call(dev).post('/api/fleets', { name: 'Patchable', ownerName: 'Pat', ownerEmail: 'pat@patch.example' });
    const id = created.body.fleet.id;
    expect((await call(dev).patch(`/api/fleets/${id}`, { status: 'closed' })).status).toBe(400);
    const ok = await call(dev).patch(`/api/fleets/${id}`, { status: 'suspended' });
    expect(ok.status).toBe(200);
    expect(ok.body.fleet.status).toBe('suspended');
  });

  it('switches the active fleet, including a suspended one, and switches back', async () => {
    expect((await call(dev).post('/api/fleets/active', { fleetId: 'flt_missing' })).status).toBe(404);
    const created = await call(dev).post('/api/fleets', { name: 'Switchable', ownerName: 'Sam', ownerEmail: 'sam@switch.example' });
    const id = created.body.fleet.id;
    await call(dev).patch(`/api/fleets/${id}`, { status: 'suspended' });
    const sw = await call(dev).post('/api/fleets/active', { fleetId: id });
    expect(sw.status).toBe(200);
    expect(sw.body.user.fleetId).toBe(id);
    expect((await call(dev).get('/api/auth/me')).body.user.fleetId).toBe(id);
    expect((await call(dev).get('/api/fleet')).status).toBe(200);
    const back = await call(dev).post('/api/fleets/active', { fleetId: 'flt_demo' });
    expect(back.status).toBe(200);
    expect((await call(dev).get('/api/auth/me')).body.user.fleetId).toBe('flt_demo');
  });
});
