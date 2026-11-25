import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { envLoginAliases } from '../server/auth';

let ip = 0;
const login = (identifier: string, password: string) =>
  request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', `10.77.${Math.floor(++ip / 250)}.${ip % 250}`)
    .send({ identifier, password });

describe('FLEETDIAG_LOGIN_ALIASES_<ROLE>', () => {
  it('parses a trimmed, lower-cased, comma-separated list per role', () => {
    const aliases = envLoginAliases({ FLEETDIAG_LOGIN_ALIASES_DEVELOPER: ' A@B.com, ,name ', FLEETDIAG_LOGIN_ALIASES_DISPATCHER: 'route-boss' });
    expect(aliases.get('a@b.com')).toBe('usr-developer-dev-lead-01');
    expect(aliases.get('name')).toBe('usr-developer-dev-lead-01');
    expect(aliases.get('route-boss')).toMatch(/^usr-dispatcher-/);
    expect(aliases.has('')).toBe(false);
  });

  it('signs in to the developer account with the email or the username, in any letter case', async () => {
    for (const id of ['owner@example.com', 'OWNER@EXAMPLE.COM', 'owner-name']) {
      const res = await login(id, 'Test-developer-1');
      expect(res.status, id).toBe(200);
      expect(res.body.user.role, id).toBe('developer');
    }
  });

  it('still needs the right password', async () => {
    const res = await login('owner@example.com', 'wrong-password-1');
    expect(res.status).toBe(401);
  });

  it('never takes a name another account already uses', async () => {
    const res = await login('tech', 'Test-technician-1');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('technician');
    expect((await login('tech', 'Test-developer-1')).status).toBe(401);
  });
});
