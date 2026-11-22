import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RequestHandler } from 'express';

type Limiter = RequestHandler;
type Result = { status: number; body?: any; headers: Record<string, unknown> };

/** Sends one request from `ip` through a limiter and reports what it answered (200 = passed on). */
function hit(limiter: Limiter, ip: string): Promise<Result> {
  return new Promise((resolve) => {
    const headers: Record<string, unknown> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: unknown) {
        headers[k] = v;
      },
      status(c: number) {
        this.statusCode = c;
        return this;
      },
      json(body: unknown) {
        resolve({ status: this.statusCode, body, headers });
        return this;
      },
    };
    const req: any = { ip, socket: {}, originalUrl: '/t', url: '/t' };
    limiter(req, res, () => resolve({ status: 200, headers }));
  });
}

/** A Redis-like counter store shared by every "instance" that is given it. */
function sharedRedis() {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const store = {
    kind: 'redis' as const,
    increment: vi.fn(async (key: string, ttlSeconds: number) => {
      const now = Date.now();
      const c = counters.get(key);
      const next = c && c.expiresAt > now ? { ...c, count: c.count + 1 } : { count: 1, expiresAt: now + ttlSeconds * 1000 };
      counters.set(key, next);
      return next.count;
    }),
  };
  return store;
}

/** A separate copy of the server module, as a second serverless instance would have. */
async function instance() {
  vi.resetModules();
  return import('../server');
}

const config = { windowMs: 60_000, maxRequests: 3, bucketName: 'test_bucket' };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('rate limits across instances', () => {
  it('two instances sharing a Redis store share one limit', async () => {
    const store = sharedRedis();
    const a = (await instance()).createRateLimiter(config, { store } as any);
    const b = (await instance()).createRateLimiter(config, { store } as any);
    const ip = '203.0.113.7';

    expect((await hit(a, ip)).status).toBe(200);
    expect((await hit(b, ip)).status).toBe(200);
    expect((await hit(a, ip)).status).toBe(200);

    const over = await hit(b, ip);
    expect(over.status).toBe(429);
    expect(over.headers['Retry-After']).toBe(30);
    expect(over.body).toEqual({
      error: 'Too Many Requests',
      message: 'Rate limit threshold exceeded for test_bucket. Throttled for 30s.',
      retryAfterSeconds: 30,
    });

    const again = await hit(a, ip);
    expect(again.status).toBe(429);
    const wait = again.body.retryAfterSeconds;
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(60);
    expect(again.headers['Retry-After']).toBe(wait);
    expect(again.body).toEqual({
      error: 'Too Many Requests',
      message: `Security throttle triggered for test_bucket. Please retry in ${wait} seconds.`,
      retryAfterSeconds: wait,
    });

    // Another client is not affected, and each request cost exactly one store call.
    expect((await hit(b, '203.0.113.8')).status).toBe(200);
    expect(store.increment).toHaveBeenCalledTimes(6);
  });

  it('once a client is over the limit, refusals in that window cost no store call', async () => {
    const store = sharedRedis();
    const limiter = (await instance()).createRateLimiter(config, { store } as any);
    const now = vi.spyOn(Date, 'now').mockReturnValue(9_000_000);
    const ip = '198.51.100.20';
    for (let i = 0; i < 3; i++) expect((await hit(limiter, ip)).status).toBe(200);
    expect((await hit(limiter, ip)).body.message).toBe('Rate limit threshold exceeded for test_bucket. Throttled for 30s.');
    expect(store.increment).toHaveBeenCalledTimes(4);

    now.mockReturnValue(9_000_000 + 20_000);
    for (let i = 0; i < 50; i++) {
      const r = await hit(limiter, ip);
      expect(r.status).toBe(429);
      expect(r.headers['Retry-After']).toBe(40);
      expect(r.body).toEqual({
        error: 'Too Many Requests',
        message: 'Security throttle triggered for test_bucket. Please retry in 40 seconds.',
        retryAfterSeconds: 40,
      });
    }
    expect(store.increment).toHaveBeenCalledTimes(4); // the flood never reached the store

    now.mockReturnValue(9_000_000 + 60_000); // next window: the store decides again
    expect((await hit(limiter, ip)).status).toBe(200);
    expect(store.increment).toHaveBeenCalledTimes(5);
  });

  it('the over-limit cache is bounded, dropping the oldest entry', async () => {
    const store = sharedRedis();
    const limiter = (await instance()).createRateLimiter({ ...config, maxRequests: 1 }, { store, overLimitCacheSize: 2 } as any);
    vi.spyOn(Date, 'now').mockReturnValue(12_000_000);
    for (const ip of ['192.0.2.31', '192.0.2.32', '192.0.2.33']) {
      await hit(limiter, ip);
      expect((await hit(limiter, ip)).status).toBe(429); // now cached as over the limit
    }
    const calls = store.increment.mock.calls.length;
    expect((await hit(limiter, '192.0.2.33')).status).toBe(429);
    expect((await hit(limiter, '192.0.2.32')).status).toBe(429);
    expect(store.increment.mock.calls.length).toBe(calls); // still cached
    expect((await hit(limiter, '192.0.2.31')).status).toBe(429); // dropped, so the store answers
    expect(store.increment.mock.calls.length).toBe(calls + 1);
  });

  it('a new window starts the count again', async () => {
    const store = sharedRedis();
    const limiter = (await instance()).createRateLimiter(config, { store } as any);
    const now = vi.spyOn(Date, 'now').mockReturnValue(6_000_000);
    for (let i = 0; i < 3; i++) expect((await hit(limiter, '198.51.100.1')).status).toBe(200);
    expect((await hit(limiter, '198.51.100.1')).status).toBe(429);
    now.mockReturnValue(6_000_000 + 60_000);
    expect((await hit(limiter, '198.51.100.1')).status).toBe(200);
  });

  it('a failing store falls back to counting in memory, without locking everyone out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = { kind: 'redis' as const, increment: vi.fn(async () => Promise.reject(new Error('redis down'))) };
    const limiter = (await instance()).createRateLimiter(config, { store } as any);

    // Many different clients all get through.
    for (let i = 0; i < 20; i++) expect((await hit(limiter, `192.0.2.${i}`)).status, `client ${i}`).toBe(200);
    // One client is still limited: the outage is not an open door.
    for (let i = 0; i < 3; i++) expect((await hit(limiter, '192.0.2.200')).status).toBe(200);
    const over = await hit(limiter, '192.0.2.200');
    expect(over.status).toBe(429);
    expect(over.body.message).toBe('Rate limit threshold exceeded for test_bucket. Throttled for 30s.');

    expect(store.increment).toHaveBeenCalledTimes(24);
    const outageWarnings = warn.mock.calls.filter(([msg]) => String(msg).startsWith('[rate-limit]'));
    expect(outageWarnings).toHaveLength(1); // logged once, not once per request
  });

  it('a store that throws instead of rejecting also falls back', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = {
      kind: 'redis' as const,
      increment: vi.fn(() => {
        throw new Error('not a function, say');
      }),
    };
    const limiter = (await instance()).createRateLimiter(config, { store } as any);
    expect((await hit(limiter, '192.0.2.250')).status).toBe(200);
  });

  it('with the memory or file store the limiter never calls the store', async () => {
    const store = { kind: 'memory' as const, increment: vi.fn() };
    const limiter = (await instance()).createRateLimiter(config, { store } as any);
    for (let i = 0; i < 3; i++) expect((await hit(limiter, '198.51.100.9')).status).toBe(200);
    expect((await hit(limiter, '198.51.100.9')).status).toBe(429);
    expect(store.increment).not.toHaveBeenCalled();
  });
});
