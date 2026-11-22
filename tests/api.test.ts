import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server';

// Each request gets its own client IP so the per-IP rate limiter does not interfere,
// except in the rate-limit test, which deliberately reuses one.
let ipCounter = 10;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const call = (agent: ReturnType<typeof request.agent>) => ({
  get: (url: string) => agent.get(url).set('X-Forwarded-For', nextIp()),
  post: (url: string, body: unknown = {}) => agent.post(url).set('X-Forwarded-For', nextIp()).send(body as object),
});

const DEMO = {
  developer: { id: 'sarthak', pw: 'Test-developer-1' },
  technician: { id: 'tech', pw: 'Test-technician-1' },
  manager: { id: 'manager', pw: 'Test-manager-1' },
  director: { id: 'director', pw: 'Test-director-1' },
  dispatcher: { id: 'dispatch', pw: 'Test-dispatcher-1' },
};

async function login(who: keyof typeof DEMO) {
  const agent = request.agent(app);
  const res = await call(agent).post('/api/auth/login', { identifier: DEMO[who].id, password: DEMO[who].pw });
  expect(res.status, `login ${who}`).toBe(200);
  return agent;
}

let dev: ReturnType<typeof request.agent>;
let tech: ReturnType<typeof request.agent>;

beforeAll(async () => {
  dev = await login('developer');
  tech = await login('technician');
});

const COMPLETE_VEHICLE = {
  unit_name: 'Test Unit',
  make_model: 'Test Truck',
  location: 'NH-44',
  engine_hours: 100,
  coordinates: { lat: 18.5, lng: 73.8 },
  telemetry: {},
};

describe('authentication', () => {
  it('health is public', async () => {
    const res = await request(app).get('/api/health').set('X-Forwarded-For', nextIp());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('blocks every other API route without a session', async () => {
    for (const url of ['/api/fleet', '/api/backup/export', '/api/security/audit-log', '/api/dtc-database']) {
      const res = await request(app).get(url).set('X-Forwarded-For', nextIp());
      expect(res.status, url).toBe(401);
    }
  });

  it('login sets an HttpOnly SameSite=Strict cookie and never returns a token or password hash', async () => {
    const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'tech', password: DEMO.technician.pw });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|token|scrypt/i);
  });

  it('rejects wrong passwords with a generic message (no user enumeration)', async () => {
    const wrong = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'sarthak', password: 'nope' });
    const unknown = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'nobody@example.com', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('ignores a forged user object (old login bypass)', async () => {
    const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ user: { email: 'x', role: 'developer' } });
    expect(res.status).toBe(400);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a tampered session cookie', async () => {
    const res = await request(app).get('/api/fleet').set('X-Forwarded-For', nextIp()).set('Cookie', 'fd_session=eyJ1aWQiOiJ4Iiwicm9sZSI6ImRldmVsb3BlciJ9.forged');
    expect(res.status).toBe(401);
  });

  it('/api/auth/me is 200 with user:null when signed out, and returns the user when signed in', async () => {
    const out = await request(app).get('/api/auth/me').set('X-Forwarded-For', nextIp());
    expect(out.status).toBe(200);
    expect(out.body.user).toBeNull();
    const me = await call(tech).get('/api/auth/me');
    expect(me.body.user.role).toBe('technician');
  });
});

describe('authorisation', () => {
  it('a technician can read the fleet but not developer-only endpoints', async () => {
    expect((await call(tech).get('/api/fleet')).status).toBe(200);
    for (const url of ['/api/backup/export', '/api/backup/snapshots', '/api/security/status', '/api/security/audit-log']) {
      expect((await call(tech).get(url)).status, url).toBe(403);
    }
    expect((await call(tech).post('/api/security/pen-test')).status).toBe(403);
    expect((await call(tech).post('/api/python-run', { mode: 'info' })).status).toBe(403);
  });

  it('the old x-dev-role header does not grant access', async () => {
    const res = await call(tech).get('/api/security/audit-log').set('x-dev-role', 'developer');
    expect(res.status).toBe(403);
  });

  it('a developer can use admin endpoints and the pen-test suite is all defended', async () => {
    expect((await call(dev).get('/api/security/status')).status).toBe(200);
    const pen = await call(dev).post('/api/security/pen-test');
    expect(pen.status).toBe(200);
    expect(pen.body.allVectorsDefended).toBe(true);
  });

  it('snapshot restore rejects path traversal', async () => {
    for (const filename of ['../../package.json', '..\\..\\package.json', '/etc/passwd', 'snapshot-x.json/../../a']) {
      const res = await call(dev).post('/api/backup/restore', { filename });
      expect(res.body.success, filename).toBe(false);
      expect(res.body.message).toMatch(/Invalid snapshot file name/);
    }
  });

  it('python-run refuses unknown modes', async () => {
    const res = await call(dev).post('/api/python-run', { mode: 'rm -rf /' });
    expect(res.status).toBe(400);
  });

  it('only privileged users can create accounts, and nobody can grant a higher role', async () => {
    const body = { name: 'New Person', email: 'new.person@example.com', role: 'technician' };
    expect((await call(tech).post('/api/auth/accounts', body)).status).toBe(403);
    const mgr = await login('manager');
    expect((await call(mgr).post('/api/auth/accounts', { ...body, role: 'developer' })).status).toBe(403);
    expect((await call(mgr).post('/api/auth/accounts', { ...body, role: 'fleet_director' })).status).toBe(403);
    const ok = await call(mgr).post('/api/auth/accounts', body);
    expect(ok.status).toBe(201);
    expect(ok.body.temporaryPassword).toBeTruthy();
    // the new account can sign in with the temporary password, but is not the approver
    const fresh = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: body.email, password: ok.body.temporaryPassword });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.role).toBe('technician');
    expect((await call(mgr).post('/api/auth/accounts', body)).status).toBe(409);
  });
});

describe('request hardening', () => {
  it('blocks cross-site state-changing requests', async () => {
    const res = await call(dev).post('/api/backup/create', {}).set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });

  it('answers malformed and oversized JSON with clean JSON errors', async () => {
    const bad = await call(dev).post('/api/diagnose', '{not json').set('Content-Type', 'application/json');
    expect(bad.status).toBe(400);
    expect(bad.headers['content-type']).toMatch(/json/);
    const big = await call(dev).post('/api/diagnose', { a: 'x'.repeat(200_000) });
    expect(big.status).toBe(413);
  });

  it('unknown API routes return a JSON 404', async () => {
    const res = await call(dev).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('strips prototype-pollution keys and does not pollute Object.prototype', async () => {
    const res = await call(dev).post('/api/vehicles').set('Content-Type', 'application/json').send('{"vehicle_id":"P-1","__proto__":{"polluted":true}}');
    expect(res.status).toBe(400);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health').set('X-Forwarded-For', nextIp());
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('vehicles API', () => {
  it.each([
    [{ vehicle_id: 'G-1', adminOverride: true }],
    [{ vehicle_id: '../x' }],
    [{ vehicle_id: 'H-1', health_score: 999 }],
    [{ vehicle_id: 'S-1', status: 'SUPER_ADMIN_BYPASS' }],
  ])('rejects %j', async (payload) => {
    expect((await call(dev).post('/api/vehicles', payload)).status).toBe(400);
  });

  it('refuses a vehicle missing fields the screens depend on, so it can never reach other users', async () => {
    const res = await call(dev).post('/api/vehicles', { vehicle_id: 'INCOMPLETE-1', status: 'NORMAL' });
    expect(res.status).toBe(400);
    const fleet = await call(dev).get('/api/fleet');
    expect(fleet.body.presets.some((v: { vehicle_id: string }) => v.vehicle_id === 'INCOMPLETE-1')).toBe(false);
  });

  it('creates then updates a valid vehicle', async () => {
    const id = `TEST-${Date.now()}`;
    const created = await call(dev).post('/api/vehicles', { ...COMPLETE_VEHICLE, vehicle_id: id, make_model: 'Test Truck', status: 'NORMAL', health_score: 88 });
    expect(created.status).toBe(201);
    const updated = await call(dev).post('/api/vehicles', { vehicle_id: id, health_score: 70 });
    expect(updated.body.status).toBe('updated');
    const fleet = await call(dev).get('/api/fleet');
    expect(fleet.body.presets.some((v: any) => v.vehicle_id === id)).toBe(true);
  });
});

describe('diagnostic engines (heuristic fallback, no AI key)', () => {
  let snapshot: any;
  beforeAll(async () => {
    snapshot = (await call(dev).get('/api/fleet')).body.initialMock;
  });

  it('diagnose returns a bounded health score and a status', async () => {
    const res = await call(dev).post('/api/diagnose', snapshot);
    expect(res.status).toBe(200);
    expect(res.body.health_score).toBeGreaterThanOrEqual(0);
    expect(res.body.health_score).toBeLessThanOrEqual(100);
    expect(['HEALTHY', 'WARNING', 'CRITICAL_STOP']).toContain(res.body.status);
  });

  it('a hot, soot-clogged truck scores worse than a healthy one', async () => {
    const healthy = { ...snapshot, telemetry: { ...snapshot.telemetry, coolant_temp_c: 88, soot_level_g: 5, nox_ppm: 80, active_dtc_codes: [] } };
    const sick = { ...snapshot, telemetry: { ...snapshot.telemetry, coolant_temp_c: 112, soot_level_g: 42, nox_ppm: 1200 } };
    const [a, b] = await Promise.all([call(dev).post('/api/diagnose', healthy), call(dev).post('/api/diagnose', sick)]);
    expect(b.body.health_score).toBeLessThan(a.body.health_score);
  });

  it('diagnose requires a vehicle_id', async () => {
    expect((await call(dev).post('/api/diagnose', {})).status).toBe(400);
  });

  it('fuel, predictive and technical-query answer', async () => {
    const fuel = await call(dev).post('/api/fuel-efficiency', snapshot);
    expect(fuel.status).toBe(200);
    expect(typeof fuel.body.current_kml).toBe('number');
    const pred = await call(dev).post('/api/predictive-maintenance', { vehicle_id: snapshot.vehicle_id, snapshot });
    expect(pred.status).toBe(200);
    expect(Array.isArray(pred.body.predicted_maintenance_needs)).toBe(true);
    const q = await call(dev).post('/api/technical-query', { question: 'Why is the coolant hot?', snapshot });
    expect(q.status).toBe(200);
    expect(String(q.body.answer).length).toBeGreaterThan(20);
  });
});

describe('password reset', () => {
  it('OTP flow: wrong code fails, right code gives a single-use token, old sessions are revoked', async () => {
    const victim = await login('dispatcher');
    const ip = nextIp();
    const send = await request(app).post('/api/auth/send-otp').set('X-Forwarded-For', ip).send({ identifier: 'dispatch' });
    const otp = send.body.demoOtp as string;
    expect(otp).toMatch(/^\d{6}$/);

    const wrong = await request(app).post('/api/auth/verify-otp').set('X-Forwarded-For', nextIp()).send({ identifier: 'dispatch', code: otp === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);

    const good = await request(app).post('/api/auth/verify-otp').set('X-Forwarded-For', nextIp()).send({ identifier: 'dispatch', code: otp });
    expect(good.status).toBe(200);
    const token = good.body.resetToken as string;

    // the same code cannot be used twice
    const again = await request(app).post('/api/auth/verify-otp').set('X-Forwarded-For', nextIp()).send({ identifier: 'dispatch', code: otp });
    expect(again.status).toBe(400);

    const weak = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ resetToken: token, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const done = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ resetToken: token, newPassword: 'Brand9NewPass' });
    expect(done.status).toBe(200);

    const reuse = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ resetToken: token, newPassword: 'Another9Pass1' });
    expect(reuse.status).toBe(400);

    expect((await call(victim).get('/api/auth/me')).body.user).toBeNull(); // old session revoked
    const relog = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'dispatch', password: 'Brand9NewPass' });
    expect(relog.status).toBe(200);
  });

  it('cannot reset without verification', async () => {
    const res = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ identifier: 'sarthak', securityAnswer: 'x', newPassword: 'Hacked12345' });
    expect(res.status).toBe(400);
  });

  it('security questions: all three must match; the answers never come back', async () => {
    const qs = await request(app).post('/api/auth/security-questions').set('X-Forwarded-For', nextIp()).send({ identifier: 'sarthak' });
    expect(qs.body.questions).toHaveLength(3);
    expect(JSON.stringify(qs.body)).not.toMatch(/Pune Engineering|Patil|Tata Prima/i);
    const wrong = await request(app).post('/api/auth/verify-security-answers').set('X-Forwarded-For', nextIp()).send({ identifier: 'sarthak', answers: ['pune', 'x', 'y'] });
    expect(wrong.status).toBe(400);
    const right = await request(app).post('/api/auth/verify-security-answers').set('X-Forwarded-For', nextIp()).send({ identifier: 'sarthak', answers: ['pune engineering bay', 'patil', 'tata prima'] });
    expect(right.status).toBe(200);
    expect(right.body.resetToken).toBeTruthy();
  });
});

describe('abuse protection', () => {
  it('locks an account after repeated wrong passwords', async () => {
    let last: any;
    for (let i = 0; i < 6; i++) {
      last = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'director', password: `wrong-${i}` });
    }
    expect(last.status).toBe(429);
    // even the right password is refused while locked
    const right = await request(app).post('/api/auth/login').set('X-Forwarded-For', nextIp()).send({ identifier: 'director', password: DEMO.director.pw });
    expect(right.status).toBe(429);
  });

  it('rate-limits one IP hammering the login endpoint', async () => {
    const ip = '203.0.113.9';
    let tooMany = 0;
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ identifier: 'nobody', password: 'x' });
      if (res.status === 429) tooMany++;
    }
    expect(tooMany).toBeGreaterThan(0);
  });
});
