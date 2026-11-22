import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { isLiveDeployment, otpEnabled } from '../server/auth';
import { redisKeyPrefix } from '../server/kvStore';

describe('isLiveDeployment', () => {
  it('treats only the production deployment as live on Vercel', () => {
    expect(isLiveDeployment({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' })).toBe(true);
    expect(isLiveDeployment({ VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' })).toBe(false);
  });

  it('uses NODE_ENV on other servers', () => {
    expect(isLiveDeployment({ NODE_ENV: 'production' })).toBe(true);
    expect(isLiveDeployment({ NODE_ENV: 'development' })).toBe(false);
    expect(isLiveDeployment({})).toBe(false);
  });
});

describe('otpEnabled', () => {
  it('can never be turned on for the live site', () => {
    expect(otpEnabled({ VERCEL: '1', VERCEL_ENV: 'production', OTP_DEMO_MODE: 'true' })).toBe(false);
    expect(otpEnabled({ NODE_ENV: 'production', OTP_DEMO_MODE: 'true' })).toBe(false);
  });

  it('is on for local demos unless switched off', () => {
    expect(otpEnabled({})).toBe(true);
    expect(otpEnabled({ OTP_DEMO_MODE: 'false' })).toBe(false);
    expect(otpEnabled({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(true);
  });
});

describe('redisKeyPrefix', () => {
  it('keeps preview data apart from live data', () => {
    expect(redisKeyPrefix({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe('');
    expect(redisKeyPrefix({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe('preview:');
    expect(redisKeyPrefix({})).toBe('');
  });
});

// The whole server, loaded the way Vercel's production deployment runs it.
describe('live site', () => {
  const REAL_PASSWORD = 'A-private-password-42';
  let app: Express;
  let ipCounter = 10;
  const ip = () => `10.9.0.${++ipCounter}`;
  const post = (url: string, body: object) => request(app).post(url).set('X-Forwarded-For', ip()).send(body);

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('OTP_DEMO_MODE', 'true'); // someone leaves it on: it must be ignored
    vi.stubEnv('FLEETDIAG_PASSWORD_DEVELOPER', REAL_PASSWORD);
    vi.stubEnv('FLEETDIAG_PASSWORD_TECHNICIAN', ''); // never configured
    app = (await import('../server')).default as unknown as Express;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('never hands out a reset code, even with OTP_DEMO_MODE=true', async () => {
    const options = await request(app).get('/api/auth/reset-options').set('X-Forwarded-For', ip());
    expect(options.body).toEqual({ otp: false });

    const send = await post('/api/auth/send-otp', { identifier: 'sarthak' });
    expect(send.status).toBe(404);
    expect(JSON.stringify(send.body)).not.toMatch(/\d{6}/);
    expect(send.body.demoOtp).toBeUndefined();

    const verify = await post('/api/auth/verify-otp', { identifier: 'sarthak', code: '123456' });
    expect(verify.status).toBe(404);
  });

  it('only accepts the password from the environment, and locks accounts that have none', async () => {
    const wrong = await post('/api/auth/login', { identifier: 'sarthak', password: 'Test-developer-1' });
    expect(wrong.status).toBe(401);
    const unconfigured = await post('/api/auth/login', { identifier: 'tech', password: 'Test-technician-1' });
    expect(unconfigured.status).toBe(401);
  });

  it('rejects the demo security answers from the public repo', async () => {
    const res = await post('/api/auth/verify-security-answers', {
      identifier: 'sarthak',
      answers: ['Pune Engineering Bay', 'Patil', 'Tata Prima'],
    });
    expect(res.status).toBe(400);
    expect(res.body.resetToken).toBeUndefined();
  });

  it('lets an account set private answers and use them to reset its password', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').set('X-Forwarded-For', ip()).send({ identifier: 'sarthak', password: REAL_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.hasSecurityQuestions).toBe(false);

    const questions = { q1: 'First depot?', q2: 'First supervisor?', q3: 'First truck?' };
    const save = (answers: object) =>
      agent.post('/api/security/save-questions').set('X-Forwarded-For', ip()).send({ ...questions, ...answers });

    const tooShort = await save({ a1: 'abc', a2: 'long enough', a3: 'long enough too' });
    expect(tooShort.status).toBe(400);
    const usesBadge = await save({ a1: 'dev-lead-01', a2: 'long enough', a3: 'long enough too' });
    expect(usesBadge.status).toBe(400);
    expect((await save({ a1: 'Private one', a2: 'Private two', a3: 'Private three' })).status).toBe(200);

    const me = await agent.get('/api/auth/me').set('X-Forwarded-For', ip());
    expect(me.body.user.hasSecurityQuestions).toBe(true);

    const verified = await post('/api/auth/verify-security-answers', {
      identifier: 'sarthak',
      answers: ['private one', 'private two', 'private three'],
    });
    expect(verified.status).toBe(200);
    const reset = await post('/api/auth/reset-password', { resetToken: verified.body.resetToken, newPassword: 'Brand-new-pass-77' });
    expect(reset.status).toBe(200);
    expect((await post('/api/auth/login', { identifier: 'sarthak', password: 'Brand-new-pass-77' })).status).toBe(200);
  });
});
